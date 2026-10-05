"""Tests for scripts/check_npm_audit.py. Run: python3 -m unittest discover -s scripts/tests"""

import json
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import check_npm_audit as audit  # noqa: E402

TODAY = date(2026, 10, 5)
GHSA = "GHSA-abcd-efgh-ijkl"


def report(*vias, package="lodash"):
    return {"vulnerabilities": {package: {"severity": "high", "via": list(vias)}}, "metadata": {}}


def via(severity="high", url=f"https://github.com/advisories/{GHSA}", name="lodash"):
    return {"source": 1, "name": name, "title": "Prototype pollution", "url": url, "severity": severity}


def allow(expires="2026-12-31", advisory=GHSA, reason="No fix yet; not reachable"):
    return {"exceptions": [{"advisory": advisory, "package": "lodash", "reason": reason, "expires": expires}]}


class BlockingAdvisoriesTest(unittest.TestCase):
    def test_clean_report(self):
        self.assertEqual(audit.blocking_advisories({"vulnerabilities": {}}), [])

    def test_high_and_critical_block_moderate_does_not(self):
        found = audit.blocking_advisories(report(via("high"), via("moderate", url="x"), via("critical", url="https://github.com/advisories/GHSA-1111-2222-3333")))
        self.assertEqual([a.advisory_id for a in found], ["GHSA-1111-2222-3333", GHSA])

    def test_transitive_string_refs_and_duplicates(self):
        data = {"vulnerabilities": {"a": {"via": ["lodash"]}, "lodash": {"via": [via()]}, "b": {"via": [via()]}}}
        self.assertEqual(len(audit.blocking_advisories(data)), 1)

    def test_falls_back_to_source_id_without_ghsa(self):
        self.assertEqual(audit.blocking_advisories(report(via(url="")))[0].advisory_id, "1")

    def test_rejects_npm_errors_and_other_json(self):
        with self.assertRaises(audit.ReportError):
            audit.blocking_advisories({"error": {"code": "ENOTFOUND"}})
        with self.assertRaises(audit.ReportError):
            audit.blocking_advisories({"foo": 1})


class EvaluateTest(unittest.TestCase):
    def run_check(self, data, allowlist):
        return audit.evaluate(audit.blocking_advisories(data), audit.load_exceptions(allowlist), TODAY)

    def test_unresolved_vulnerability_fails(self):
        errors, _ = self.run_check(report(via()), {"exceptions": []})
        self.assertEqual(len(errors), 1)
        self.assertIn(GHSA, errors[0])

    def test_valid_exception_passes_with_note(self):
        errors, notes = self.run_check(report(via()), allow())
        self.assertEqual(errors, [])
        self.assertIn("Allowed until 2026-12-31", notes[0])

    def test_expired_exception_fails(self):
        errors, _ = self.run_check(report(via()), allow(expires="2026-10-04"))
        self.assertIn("Expired exception", errors[0])

    def test_unused_exception_is_reported(self):
        errors, notes = self.run_check({"vulnerabilities": {}}, allow())
        self.assertEqual(errors, [])
        self.assertIn("Unused exception", notes[0])

    def test_invalid_allowlist_entries(self):
        for bad in (allow(expires="soon"), allow(reason="  "), {"exceptions": [{"advisory": GHSA}]}):
            with self.assertRaises(audit.ReportError):
                audit.load_exceptions(bad)


class MainTest(unittest.TestCase):
    def files(self, data, allowlist):
        directory = Path(tempfile.mkdtemp())
        (directory / "audit.json").write_text(json.dumps(data))
        (directory / "allow.json").write_text(json.dumps(allowlist))
        return ["check", str(directory / "audit.json"), str(directory / "allow.json")]

    def test_exit_codes(self):
        self.assertEqual(audit.main(self.files({"vulnerabilities": {}}, {"exceptions": []}), TODAY), 0)
        self.assertEqual(audit.main(self.files(report(via()), {"exceptions": []}), TODAY), 1)
        self.assertEqual(audit.main(self.files(report(via()), allow()), TODAY), 0)
        self.assertEqual(audit.main(["check"], TODAY), 2)
        self.assertEqual(audit.main(["check", "/missing.json", "/missing.json"], TODAY), 1)

    def test_repository_allowlist_is_valid(self):
        path = Path(__file__).resolve().parents[2] / ".github" / "npm-audit-allowlist.json"
        audit.load_exceptions(json.loads(path.read_text()))


if __name__ == "__main__":
    unittest.main()
