"""Render the Alexa skill manifest for deployment (ALEXA-001).

Replaces every ``${SKILL_LAMBDA_ARN}`` placeholder in ``alexa/skill-package/skill.json`` (the custom endpoint and,
since ALEXA-008, the events endpoint) with the ARN of the deployed skill Lambda (Terraform output
``alexa_skill_lambda_arn``), so no account ID is committed.

Usage: python3 scripts/render_alexa_manifest.py <skill.json> <output.json> <lambda-arn>
"""

import json
import re
import sys
from pathlib import Path

PLACEHOLDER = "${SKILL_LAMBDA_ARN}"
LAMBDA_ARN_PATTERN = re.compile(r"^arn:aws:lambda:[a-z0-9-]+:\d{12}:function:[A-Za-z0-9_-]+$")


class ManifestError(ValueError):
    """Raised when the manifest or the Lambda ARN is not usable."""


def render_manifest(manifest: dict, lambda_arn: str) -> dict:
    """Return a copy of ``manifest`` whose custom endpoint points to ``lambda_arn``."""
    if not LAMBDA_ARN_PATTERN.match(lambda_arn):
        raise ManifestError(f"not a Lambda function ARN: {lambda_arn!r}")
    try:
        endpoint = manifest["manifest"]["apis"]["custom"]["endpoint"]
    except (KeyError, TypeError) as error:
        raise ManifestError("manifest has no apis.custom.endpoint") from error
    if endpoint.get("uri") != PLACEHOLDER:
        raise ManifestError(f"endpoint uri must be the placeholder {PLACEHOLDER}")
    return json.loads(json.dumps(manifest).replace(PLACEHOLDER, lambda_arn))


def main(argv: list[str]) -> int:
    """Command-line entry point; returns the process exit code."""
    if len(argv) != 4:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    source, target, lambda_arn = Path(argv[1]), Path(argv[2]), argv[3]
    try:
        rendered = render_manifest(json.loads(source.read_text(encoding="utf-8")), lambda_arn)
    except (OSError, json.JSONDecodeError, ManifestError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    target.write_text(json.dumps(rendered, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
