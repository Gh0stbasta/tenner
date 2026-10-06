#!/usr/bin/env bash
# Deploy the Alexa skill package (manifest + de-DE interaction model) to the development stage (ALEXA-001).
#
# Usage: scripts/deploy-alexa-skill.sh <skill-package-dir> <skill-id> <skill-lambda-arn>
#
# Credentials (GitHub Actions secrets, never committed): ASK_REFRESH_TOKEN (LWA refresh token for SMAPI, created
# once with `ask util generate-lwa-tokens`) and ASK_VENDOR_ID. The ASK CLI reads them from the environment.
# Run after `terraform apply`: Alexa checks that it may invoke the endpoint Lambda when the manifest is updated.
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <skill-package-dir> <skill-id> <skill-lambda-arn>" >&2
  exit 2
fi

readonly PACKAGE_DIR="$1" SKILL_ID="$2" LAMBDA_ARN="$3"
readonly STAGE="development" LOCALE="de-DE"
readonly ASK_CLI_VERSION="2.30.7"
readonly MAX_WAIT_SECONDS=300

: "${ASK_REFRESH_TOKEN:?ASK_REFRESH_TOKEN is not set (GitHub secret, see alexa/README.md)}"
: "${ASK_VENDOR_ID:?ASK_VENDOR_ID is not set (GitHub secret, see alexa/README.md)}"
export ASK_DEFAULT_PROFILE="__ENVIRONMENT_ASK_PROFILE__"

work_dir="$(mktemp -d)"
trap 'rm -rf "${work_dir}"' EXIT

ask() {
  npx --yes "ask-cli@${ASK_CLI_VERSION}" "$@"
}

echo "Rendering manifest for ${LAMBDA_ARN}..."
python3 "$(dirname "$0")/render_alexa_manifest.py" "${PACKAGE_DIR}/skill.json" "${work_dir}/skill.json" "${LAMBDA_ARN}"

echo "Updating skill manifest (${STAGE})..."
ask smapi update-skill-manifest -s "${SKILL_ID}" -g "${STAGE}" --manifest "file:${work_dir}/skill.json"

echo "Updating interaction model (${LOCALE})..."
ask smapi set-interaction-model -s "${SKILL_ID}" -g "${STAGE}" -l "${LOCALE}" \
  --interaction-model "file:${PACKAGE_DIR}/interactionModels/custom/${LOCALE}.json"

echo "Waiting for the interaction model build..."
waited=0
while true; do
  status_json="$(ask smapi get-skill-status -s "${SKILL_ID}")"
  manifest_status="$(jq -r '.manifest.lastUpdateRequest.status // "UNKNOWN"' <<<"${status_json}")"
  model_status="$(jq -r --arg l "${LOCALE}" '.interactionModel[$l].lastUpdateRequest.status // "UNKNOWN"' <<<"${status_json}")"
  echo "  manifest=${manifest_status} interactionModel=${model_status}"
  if [[ "${manifest_status}" == "FAILED" || "${model_status}" == "FAILED" ]]; then
    echo "Error: skill update failed:" >&2
    echo "${status_json}" >&2
    exit 1
  fi
  if [[ "${manifest_status}" == "SUCCEEDED" && "${model_status}" == "SUCCEEDED" ]]; then
    echo "Skill package deployed."
    break
  fi
  if (( waited >= MAX_WAIT_SECONDS )); then
    echo "Error: skill update did not finish within ${MAX_WAIT_SECONDS} seconds." >&2
    exit 1
  fi
  sleep 10
  waited=$((waited + 10))
done

# Enable testing on the development stage (as `ask deploy` does); idempotent. It only makes the skill usable on the
# developer's own Amazon account and by the health check's simulation; it does not publish anything (ALEXA-010).
echo "Enabling the skill for testing (${STAGE})..."
ask smapi set-skill-enablement -s "${SKILL_ID}" -g "${STAGE}"
