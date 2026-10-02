"""Tests for scripts/check_tags.py. Run: python3 -m unittest discover -s scripts/tests"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import check_tags  # noqa: E402

KEYS = ["Project", "Name"]


def plan(resources, child_resources=None, keys=KEYS):
    """Build a minimal plan JSON structure."""
    root = {"resources": resources}
    if child_resources is not None:
        root["child_modules"] = [{"resources": child_resources}]
    outputs = {} if keys is None else {"mandatory_tag_keys": {"value": keys}}
    return {"planned_values": {"outputs": outputs, "root_module": root}}


def resource(address, tags, mode="managed"):
    values = {} if tags is None else {"tags_all": tags}
    return {"address": address, "mode": mode, "values": values}


class FindViolationsTest(unittest.TestCase):
    def test_compliant_resource(self):
        p = plan([resource("aws_s3_bucket.a", {"Project": "Tenner", "Name": "a"})])
        self.assertEqual(check_tags.find_violations(p), [])

    def test_missing_tag(self):
        p = plan([resource("aws_s3_bucket.a", {"Project": "Tenner"})])
        self.assertEqual(
            check_tags.find_violations(p),
            [check_tags.Violation("aws_s3_bucket.a", ("Name",))],
        )

    def test_empty_tag_value(self):
        p = plan([resource("aws_s3_bucket.a", {"Project": "Tenner", "Name": "  "})])
        self.assertEqual(check_tags.find_violations(p)[0].missing, ("Name",))

    def test_null_tags_all(self):
        p = plan([resource("aws_s3_bucket.a", None)])
        p["planned_values"]["root_module"]["resources"][0]["values"]["tags_all"] = None
        self.assertEqual(check_tags.find_violations(p)[0].missing, ("Project", "Name"))

    def test_untaggable_resource_ignored(self):
        p = plan([resource("aws_s3_bucket_versioning.a", None)])
        self.assertEqual(check_tags.find_violations(p), [])

    def test_data_source_ignored(self):
        p = plan([resource("data.aws_region.current", {}, mode="data")])
        self.assertEqual(check_tags.find_violations(p), [])

    def test_child_module_checked(self):
        p = plan([], child_resources=[resource("module.x.aws_s3_bucket.b", {"Project": "Tenner"})])
        self.assertEqual(check_tags.find_violations(p)[0].address, "module.x.aws_s3_bucket.b")

    def test_missing_output_raises(self):
        with self.assertRaises(ValueError):
            check_tags.find_violations(plan([], keys=None))

    def test_empty_key_list_raises(self):
        with self.assertRaises(ValueError):
            check_tags.find_violations(plan([], keys=[]))


class MainTest(unittest.TestCase):
    def run_main(self, content):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            f.write(content)
        try:
            return check_tags.main(["check_tags.py", f.name])
        finally:
            Path(f.name).unlink()

    def test_exit_codes(self):
        ok = plan([resource("aws_s3_bucket.a", {"Project": "Tenner", "Name": "a"})])
        bad = plan([resource("aws_s3_bucket.a", {})])
        self.assertEqual(self.run_main(json.dumps(ok)), 0)
        self.assertEqual(self.run_main(json.dumps(bad)), 1)
        self.assertEqual(self.run_main("not json"), 2)

    def test_usage(self):
        self.assertEqual(check_tags.main(["check_tags.py"]), 2)


if __name__ == "__main__":
    unittest.main()
