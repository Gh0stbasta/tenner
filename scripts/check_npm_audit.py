#!/usr/bin/env python3
"""Fail on high or critical npm vulnerabilities in production dependencies (SECURITY-007).

Reads the JSON report of `npm audit --omit=dev --json` and an allowlist of time-boxed exceptions.
Every high/critical advisory must be fixed or listed in the allowlist with a reason and an expiry date.
Expired exceptions fail too, so they cannot be forgotten.

Usage:
    npm audit --omit=dev --json > audit.json || true
    python3 scripts/check_npm_audit.py audit.json .github/npm-audit-allowlist.json
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path

BLOCKING_SEVERITIES = frozenset({"high", "critical"})
GHSA_PATTERN = re.compile(r"GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}")


@dataclass(frozen=True)
class Advisory:
    advisory_id: str
    package: str
    severity: str
    title: str


@dataclass(frozen=True)
class AuditException:
    advisory_id: str
    package: str
    reason: str
    expires: date


class ReportError(ValueError):
    """The audit report or the allowlist is unusable."""


def blocking_advisories(report: dict) -> list[Advisory]:
    """High/critical advisories from an npm audit (v7+) JSON report, deduplicated."""
    if "error" in report:
        raise ReportError(f"npm audit failed: {report['error']}")
    vulnerabilities = report.get("vulnerabilities")
    if not isinstance(vulnerabilities, dict):
        raise ReportError("Not an npm audit JSON report (missing 'vulnerabilities').")
    found: dict[str, Advisory] = {}
    for package, entry in vulnerabilities.items():
        for via in entry.get("via", []):
            # Strings point to another vulnerable package; that package lists the advisory itself.
            if not isinstance(via, dict) or via.get("severity") not in BLOCKING_SEVERITIES:
                continue
            match = GHSA_PATTERN.search(str(via.get("url", "")))
            advisory_id = match.group(0) if match else str(via.get("source", "unknown"))
            found.setdefault(
                advisory_id,
                Advisory(advisory_id, str(via.get("name", package)), str(via["severity"]), str(via.get("title", ""))),
            )
    return sorted(found.values(), key=lambda advisory: advisory.advisory_id)


def load_exceptions(allowlist: dict) -> list[AuditException]:
    exceptions = []
    for entry in allowlist.get("exceptions", []):
        try:
            exceptions.append(
                AuditException(
                    advisory_id=str(entry["advisory"]),
                    package=str(entry["package"]),
                    reason=str(entry["reason"]).strip(),
                    expires=date.fromisoformat(str(entry["expires"])),
                )
            )
        except (KeyError, ValueError) as error:
            raise ReportError(f"Invalid allowlist entry {entry!r}: {error}") from error
        if not exceptions[-1].reason:
            raise ReportError(f"Allowlist entry {entry!r} needs a reason.")
    return exceptions


def evaluate(advisories: list[Advisory], exceptions: list[AuditException], today: date) -> tuple[list[str], list[str]]:
    """Return (errors, notes). Errors fail the build."""
    by_id = {exception.advisory_id: exception for exception in exceptions}
    errors, notes = [], []
    for advisory in advisories:
        exception = by_id.get(advisory.advisory_id)
        label = f"{advisory.advisory_id} ({advisory.severity}) in {advisory.package}: {advisory.title}"
        if exception is None:
            errors.append(f"Unresolved {label}")
        elif exception.expires < today:
            errors.append(f"Expired exception ({exception.expires}) for {label}")
        else:
            notes.append(f"Allowed until {exception.expires}: {label} - {exception.reason}")
    used = {advisory.advisory_id for advisory in advisories}
    notes.extend(f"Unused exception {e.advisory_id} ({e.package}) can be removed." for e in exceptions if e.advisory_id not in used)
    return errors, notes


def main(argv: list[str], today: date | None = None) -> int:
    if len(argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    try:
        report = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
        allowlist = json.loads(Path(argv[2]).read_text(encoding="utf-8"))
        errors, notes = evaluate(blocking_advisories(report), load_exceptions(allowlist), today or date.today())
    except (OSError, json.JSONDecodeError, ReportError) as error:
        print(f"npm audit check failed: {error}", file=sys.stderr)
        return 1
    for note in notes:
        print(note)
    for error in errors:
        print(error, file=sys.stderr)
    if errors:
        print(f"{len(errors)} high/critical production vulnerabilities. Fix them or add a time-boxed exception.", file=sys.stderr)
        return 1
    print("No unresolved high/critical vulnerabilities in production dependencies.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
