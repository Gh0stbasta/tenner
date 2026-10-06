"""Tests for scripts/render_alexa_manifest.py. Run: python3 -m unittest discover -s scripts/tests"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import render_alexa_manifest as render  # noqa: E402

REPO_MANIFEST = Path(__file__).resolve().parents[2] / "alexa" / "skill-package" / "skill.json"
ARN = "arn:aws:lambda:eu-west-1:123456789012:function:tenner-alexa-skill"


class RenderManifestTest(unittest.TestCase):
    def test_repository_manifest_renders_with_arn(self):
        manifest = json.loads(REPO_MANIFEST.read_text(encoding="utf-8"))
        rendered = render.render_manifest(manifest, ARN)
        self.assertEqual(rendered["manifest"]["apis"]["custom"]["endpoint"]["uri"], ARN)
        self.assertEqual(rendered["manifest"]["events"]["endpoint"]["uri"], ARN)
        self.assertNotIn(render.PLACEHOLDER, json.dumps(rendered))
        # The input stays untouched (placeholder remains for the next deployment).
        self.assertEqual(manifest["manifest"]["apis"]["custom"]["endpoint"]["uri"], render.PLACEHOLDER)

    def test_rejects_invalid_arn(self):
        manifest = json.loads(REPO_MANIFEST.read_text(encoding="utf-8"))
        for arn in ["", "tenner-alexa-skill", "arn:aws:lambda:eu-west-1:123:function:x"]:
            with self.subTest(arn=arn), self.assertRaises(render.ManifestError):
                render.render_manifest(manifest, arn)

    def test_rejects_manifest_without_placeholder(self):
        with self.assertRaises(render.ManifestError):
            render.render_manifest({"manifest": {"apis": {"custom": {"endpoint": {"uri": ARN}}}}}, ARN)
        with self.assertRaises(render.ManifestError):
            render.render_manifest({"manifest": {}}, ARN)

    def test_main_writes_output_and_reports_errors(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "skill.json"
            self.assertEqual(render.main(["x", str(REPO_MANIFEST), str(target), ARN]), 0)
            self.assertIn(ARN, target.read_text(encoding="utf-8"))
            self.assertEqual(render.main(["x", str(REPO_MANIFEST), str(target), "bad"]), 1)
            self.assertEqual(render.main(["x", str(Path(directory) / "missing.json"), str(target), ARN]), 1)
            self.assertEqual(render.main(["x"]), 2)


if __name__ == "__main__":
    unittest.main()
