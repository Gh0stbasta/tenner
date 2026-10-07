"""Tests for scripts/render_alexa_widget.py (MAINT-003). Run: python3 -m unittest discover -s scripts/tests"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import render_alexa_widget as render  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
PACKAGES = sorted((ROOT / "alexa" / "skill-package" / "dataStorePackages").glob("*/manifest.json"))
URL = "https://d1234abcd.cloudfront.net"


class RenderWidgetManifestTest(unittest.TestCase):
    def test_repository_packages_render_with_images_that_exist(self):
        self.assertTrue(PACKAGES)
        for path in PACKAGES:
            with self.subTest(package=path.parent.name):
                manifest = json.loads(path.read_text(encoding="utf-8"))
                rendered = render.render_widget_manifest(manifest, URL + "/")
                self.assertNotIn(render.PLACEHOLDER, json.dumps(rendered))
                for entry in (entry for locale in rendered["publishingInformation"]["locales"].values() for entry in locale):
                    for url in [entry["metadata"]["iconUri"], *entry["metadata"]["previews"]]:
                        self.assertTrue(url.startswith(URL + "/"))
                        # The image is part of the web app build (frontend/public), so the URL is live after the deploy.
                        self.assertTrue((ROOT / "frontend" / "public" / url[len(URL) + 1 :]).is_file(), url)
                self.assertIn(render.PLACEHOLDER, json.dumps(manifest))

    def test_rejects_bad_urls_and_missing_images(self):
        manifest = json.loads(PACKAGES[0].read_text(encoding="utf-8"))
        for url in ["", "http://example.com", "https://example.com/path", "example.com"]:
            with self.subTest(url=url), self.assertRaises(render.WidgetManifestError):
                render.render_widget_manifest(manifest, url)
        no_preview = {"publishingInformation": {"locales": {"de-DE": [{"metadata": {"iconUri": "${WEB_APP_URL}/a.png"}}]}}}
        with self.assertRaises(render.WidgetManifestError):
            render.render_widget_manifest(no_preview, URL)
        foreign = {"publishingInformation": {"locales": {"de-DE": [{"metadata": {"iconUri": "https://other.example/a.png", "previews": ["${WEB_APP_URL}/b.png"]}}]}}}
        with self.assertRaises(render.WidgetManifestError):
            render.render_widget_manifest(foreign, URL)
        with self.assertRaises(render.WidgetManifestError):
            render.render_widget_manifest({}, URL)

    def test_main_writes_output_and_reports_errors(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "manifest.json"
            self.assertEqual(render.main(["x", str(PACKAGES[0]), str(target), URL]), 0)
            self.assertIn(URL, target.read_text(encoding="utf-8"))
            self.assertEqual(render.main(["x", str(PACKAGES[0]), str(target), "http://bad"]), 1)
            self.assertEqual(render.main(["x"]), 2)


if __name__ == "__main__":
    unittest.main()
