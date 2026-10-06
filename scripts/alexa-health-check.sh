#!/usr/bin/env bash
# Post-deploy Alexa health check (ALEXA-009): simulates „öffne tenner board“ on the development stage through SMAPI and
# fails unless the skill answers with a text that names Tenner (the welcome, or the link prompt when the
# simulating account is not linked). Uses the same ASK credentials as scripts/deploy-alexa-skill.sh.
#
# Usage: scripts/alexa-health-check.sh <skill-id>
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <skill-id>" >&2
  exit 2
fi

readonly SKILL_ID="$1" STAGE="development" LOCALE="de-DE"
readonly ASK_CLI_VERSION="2.30.7"
readonly MAX_WAIT_SECONDS=60

: "${ASK_REFRESH_TOKEN:?ASK_REFRESH_TOKEN is not set}"
: "${ASK_VENDOR_ID:?ASK_VENDOR_ID is not set}"
export ASK_DEFAULT_PROFILE="__ENVIRONMENT_ASK_PROFILE__"

ask() {
  npx --yes "ask-cli@${ASK_CLI_VERSION}" "$@"
}

simulation_id="$(ask smapi simulate-skill -s "${SKILL_ID}" -g "${STAGE}" --input-content "öffne tenner board" --device-locale "${LOCALE}" | jq -r '.id')"
waited=0
while true; do
  result="$(ask smapi get-skill-simulation -s "${SKILL_ID}" -g "${STAGE}" -i "${simulation_id}")"
  status="$(jq -r '.status' <<<"${result}")"
  if [[ "${status}" != "IN_PROGRESS" ]]; then
    python3 "$(dirname "$0")/check_alexa_simulation.py" "Tenner" <<<"${result}"
    exit $?
  fi
  if (( waited >= MAX_WAIT_SECONDS )); then
    echo "Alexa health check failed: simulation still in progress after ${MAX_WAIT_SECONDS} seconds." >&2
    exit 1
  fi
  sleep 5
  waited=$((waited + 5))
done
