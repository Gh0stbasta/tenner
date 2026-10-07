"""Render the Echo Show widget package manifests for deployment (MAINT-003).

Amazon requires an icon and preview images on public HTTPS URLs for every widget package
(``publishingInformation.locales.<locale>[].metadata.iconUri`` and ``previews``). The images are served by the web
app (``frontend/public``), so the manifests in ``alexa/skill-package/dataStorePackages/*/manifest.json`` use the
placeholder ``${WEB_APP_URL}``; this script replaces it with the deployed web app URL (Terraform output
``frontend_url``), so no CloudFront domain is committed.

Usage: python3 scripts/render_alexa_widget.py <manifest.json> <output.json> <web-app-url>
"""

import json
import re
import sys
from pathlib import Path

PLACEHOLDER = "${WEB_APP_URL}"
WEB_APP_URL_PATTERN = re.compile(r"^https://[a-z0-9.-]+(?::\d+)?$")


class WidgetManifestError(ValueError):
    """Raised when the widget manifest or the web app URL is not usable."""


def render_widget_manifest(manifest: dict, web_app_url: str) -> dict:
    """Return a copy of ``manifest`` with icon and preview URLs on ``web_app_url``; every entry needs both."""
    base = web_app_url.rstrip("/")
    if not WEB_APP_URL_PATTERN.match(base):
        raise WidgetManifestError(f"not an https origin: {web_app_url!r}")
    try:
        entries = [entry for locale in manifest["publishingInformation"]["locales"].values() for entry in locale]
    except (KeyError, TypeError, AttributeError) as error:
        raise WidgetManifestError("manifest has no publishingInformation.locales") from error
    for entry in entries:
        metadata = entry.get("metadata", {})
        if not metadata.get("iconUri") or not metadata.get("previews"):
            raise WidgetManifestError("every locale entry needs metadata.iconUri and metadata.previews")
    rendered = json.loads(json.dumps(manifest).replace(PLACEHOLDER, base))
    for entry in (entry for locale in rendered["publishingInformation"]["locales"].values() for entry in locale):
        for url in [entry["metadata"]["iconUri"], *entry["metadata"]["previews"]]:
            if not url.startswith(base + "/"):
                raise WidgetManifestError(f"image not on the web app: {url!r}")
    return rendered


def main(argv: list[str]) -> int:
    """Command-line entry point; returns the process exit code."""
    if len(argv) != 4:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    source, target, web_app_url = Path(argv[1]), Path(argv[2]), argv[3]
    try:
        rendered = render_widget_manifest(json.loads(source.read_text(encoding="utf-8")), web_app_url)
    except (OSError, json.JSONDecodeError, WidgetManifestError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    target.write_text(json.dumps(rendered, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
