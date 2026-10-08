#!/usr/bin/env bash
# Post-deploy Alexa health check (ALEXA-009): simulates „öffne familien zentrale“ on the development stage through SMAPI and
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
readonly SIMULATOR_ATTEMPTS=3 SIMULATOR_RETRY_SECONDS=20

: "${ASK_REFRESH_TOKEN:?ASK_REFRESH_TOKEN is not set}"
: "${ASK_VENDOR_ID:?ASK_VENDOR_ID is not set}"
export ASK_DEFAULT_PROFILE="__ENVIRONMENT_ASK_PROFILE__"

ask() {
  npx --yes "ask-cli@${ASK_CLI_VERSION}" "$@"
}

# Amazon's simulation service sometimes fails before the skill is reached ("An unexpected error occurred.", exit
# code 3 of the checker) while the skill works on devices and in the console (HOTFIX-006). Retry it; if it never
# answers, report a warning instead of failing the deploy. A wrong answer or a skill error still fails.
simulate_once() {
  local simulation_id result status waited=0
  simulation_id="$(ask smapi simulate-skill -s "${SKILL_ID}" -g "${STAGE}" --input-content "öffne familien zentrale" --device-locale "${LOCALE}" | jq -r '.id')"
  while true; do
    result="$(ask smapi get-skill-simulation -s "${SKILL_ID}" -g "${STAGE}" -i "${simulation_id}")"
    status="$(jq -r '.status' <<<"${result}")"
    if [[ "${status}" != "IN_PROGRESS" ]]; then
      python3 "$(dirname "$0")/check_alexa_simulation.py" "Zentrale" <<<"${result}"
      return $?
    fi
    if (( waited >= MAX_WAIT_SECONDS )); then
      echo "Alexa health check failed: simulation still in progress after ${MAX_WAIT_SECONDS} seconds." >&2
      return 1
    fi
    sleep 5
    waited=$((waited + 5))
  done
}

for attempt in $(seq 1 "${SIMULATOR_ATTEMPTS}"); do
  code=0
  simulate_once || code=$?
  if (( code != 3 )); then
    exit "${code}"
  fi
  if (( attempt < SIMULATOR_ATTEMPTS )); then
    echo "Retrying in ${SIMULATOR_RETRY_SECONDS} seconds (attempt ${attempt}/${SIMULATOR_ATTEMPTS})..." >&2
    sleep "${SIMULATOR_RETRY_SECONDS}"
  fi
done
echo "::warning title=Alexa health check skipped::Amazon's skill simulator failed ${SIMULATOR_ATTEMPTS} times; the skill was not checked. Test "Alexa, öffne Familien Zentrale" by hand (docs/runbooks/alexa.md)."
exit 0
