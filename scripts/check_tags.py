#!/usr/bin/env python3
"""Enforce mandatory AWS tags on a Terraform plan (TICKET-001A).

Reads the JSON form of a saved plan (`terraform show -json tfplan`) and fails if a
taggable managed resource is missing a mandatory tag or has an empty value.

The mandatory tag keys come from the plan's `mandatory_tag_keys` output
(terraform/locals.tf), so the list is defined only once.

Usage:
    python3 scripts/check_tags.py plan.json
"""

from __future__ import annotations

import json
import sys
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

MANDATORY_KEYS_OUTPUT = "mandatory_tag_keys"
TAGS_ATTRIBUTE = "tags_all"


@dataclass(frozen=True)
class Violation:
    """A resource that lacks one or more mandatory tags."""

    address: str
    missing: tuple[str, ...]


def iter_resources(module: dict) -> Iterator[dict]:
    """Yield all resources of a planned module, including child modules."""
    yield from module.get("resources", [])
    for child in module.get("child_modules", []):
        yield from iter_resources(child)


def mandatory_keys(plan: dict) -> list[str]:
    """Return the mandatory tag keys from the plan output."""
    outputs = plan.get("planned_values", {}).get("outputs", {})
    try:
        keys = outputs[MANDATORY_KEYS_OUTPUT]["value"]
    except KeyError as error:
        raise ValueError(f"Plan has no '{MANDATORY_KEYS_OUTPUT}' output.") from error
    if not isinstance(keys, list) or not keys:
        raise ValueError(f"Output '{MANDATORY_KEYS_OUTPUT}' must be a non-empty list.")
    return keys


def find_violations(plan: dict) -> list[Violation]:
    """Return all taggable managed resources that miss mandatory tags."""
    keys = mandatory_keys(plan)
    root = plan.get("planned_values", {}).get("root_module", {})
    violations = []
    for resource in iter_resources(root):
        values = resource.get("values") or {}
        if resource.get("mode") != "managed" or TAGS_ATTRIBUTE not in values:
            continue  # data sources and resource types without tags
        tags = values.get(TAGS_ATTRIBUTE) or {}
        missing = tuple(k for k in keys if not str(tags.get(k, "")).strip())
        if missing:
            violations.append(Violation(resource["address"], missing))
    return violations


def main(argv: list[str]) -> int:
    """Check the plan file given on the command line. Return a process exit code."""
    if len(argv) != 2:
        print(f"Usage: {argv[0]} <plan.json>", file=sys.stderr)
        return 2
    try:
        plan = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
        violations = find_violations(plan)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2

    if violations:
        print("Resources missing mandatory tags:")
        for violation in violations:
            print(f"  {violation.address}: {', '.join(violation.missing)}")
        return 1
    print("All taggable resources carry the mandatory tags.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
