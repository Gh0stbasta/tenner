#!/usr/bin/env bash
# Post-deployment smoke tests (OPERATIONS-006). Read-only: only GET requests, no household data is touched.
#
# Usage: scripts/smoke-test.sh <frontend-url> <api-endpoint>
#   e.g. scripts/smoke-test.sh https://d111111abcdef8.cloudfront.net https://abc.execute-api.eu-central-1.amazonaws.com/prod
#
# Checks:
#   frontend /            200, contains the app root element, CSP header present
#   frontend /dashboard   200 (SPA routing through CloudFront), contains the app root element
#   api /health           200, "status":"ok" and "database":"connected"
#   api /dashboard        401 without a token (the JWT authorizer protects the API, SECURITY-002)
#   api /onboarding       401 without a token
#   api /meals/today      401 without a token (release 2.0, FOOD-025)
#   api /meals/calendar/x 404 for an unknown calendar token (public route, FOOD-015)
# Signed-in requests are not tested: sign-in is Google only, so there is no non-interactive test user (TD-024).
set -uo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <frontend-url> <api-endpoint>" >&2
  exit 2
fi

readonly FRONTEND="${1%/}" API="${2%/}"
readonly ROOT_ELEMENT='<div id="root">'
readonly RUNBOOK="README.md#rollback"
BODY="$(mktemp)" HEADERS="$(mktemp)"
readonly BODY HEADERS
trap 'rm -f "$BODY" "$HEADERS"' EXIT
failures=0

fail() {
  failures=$((failures + 1))
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then echo "::error title=Smoke test failed::$1"; else echo "FAIL  $1"; fi
}

# fetch <url>: GET with retries for transient failures only (refused/timeouts, 408, 429, 5xx); an expected 401
# is not retried. Sets STATUS, fills $BODY and $HEADERS.
fetch() {
  STATUS="$(curl --silent --location --max-time 15 --retry 3 --retry-delay 3 --retry-connrefused \
    --dump-header "$HEADERS" --output "$BODY" --write-out '%{http_code}' "$1" 2>/dev/null || true)"
}

# check <name> <url> <expected-status> [<required text> ...]
check() {
  local name="$1" url="$2" expected="$3"
  shift 3
  fetch "$url"
  if [[ "$STATUS" != "$expected" ]]; then
    fail "$name: expected HTTP $expected, got ${STATUS:-no response} ($url)"
    return
  fi
  local text
  for text in "$@"; do
    if ! grep -qF -- "$text" "$BODY"; then
      fail "$name: response does not contain '$text' ($url)"
      return
    fi
  done
  echo "OK    $name ($STATUS)"
}

check "frontend index" "$FRONTEND/" 200 "$ROOT_ELEMENT"
if [[ "$STATUS" == "200" ]] && ! grep -qi '^content-security-policy:' "$HEADERS"; then
  fail "frontend index: Content-Security-Policy header missing ($FRONTEND/)"
fi
check "frontend SPA route" "$FRONTEND/dashboard" 200 "$ROOT_ELEMENT"
check "api health" "$API/health" 200 '"status":"ok"' '"database":"connected"'
check "api requires login (dashboard)" "$API/dashboard" 401
check "api requires login (onboarding)" "$API/onboarding" 401
check "api requires login (meals today)" "$API/meals/today" 401
check "calendar feed rejects unknown token" "$API/meals/calendar/default.unknown.ics" 404

if ((failures > 0)); then
  echo "$failures smoke test(s) failed. Rollback: see $RUNBOOK" >&2
  exit 1
fi
echo "All smoke tests passed."
