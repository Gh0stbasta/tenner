# MAINT-001: Alexa skill — time budget instead of a fixed 2 s per API call

## Goal

„Alexa, öffne Tenner Board“ answers after a longer pause (cold start) instead of failing with „Tenner ist gerade
nicht erreichbar“.

## Context

Owner report (2026-10-07, first launch on an Echo Show 21): alarm `tenner-alexa-skill-error-rate` went to ALARM and
back to OK. Skill log of 17:46:42 UTC: `LaunchRequest`, `apiCalls 1`, `apiMs 2004`, `apiStatus 0`, `outcome ERROR`;
the skill Lambda had just started a new instance (`platform.initStart` 17:46:40). The first Tenner API call of a cold
instance (new TLS connection eu-west-1 → eu-central-1, API Gateway, JWT authorizer, possibly a cold API Lambda) took
longer than the fixed 2 s per call. The 2 s were chosen so that three sequential calls (household context, list,
write) always fit into Alexa's 8 seconds — on a warm path every call takes 50 – 200 ms, so the split wastes the budget
exactly when it is needed.

## Requirements

- A time budget per skill request (6.5 s from the start of the handler, below the 7 s Lambda timeout and Alexa's 8 s)
  instead of a fixed timeout per call.
- One API call may use up to 4 s, never more than the remaining budget minus a reserve for building the answer.
- A read (GET) that fails without a response (timeout, connection error) is retried once if at least 1 s of budget
  is left. Writes are not retried (a completion must not be sent twice without its idempotency key logic).
- Every attempt stays visible in the request log (`apiCalls`, `apiMs`, `apiStatus`).
- Behaviour on a hanging API stays: a friendly „nicht erreichbar“ answer inside the budget.

## Acceptance Criteria

- [x] A slow first call (cold start) inside the attempt limit succeeds (no error, one call)
- [x] A read that fails once without a response is retried and succeeds
- [x] Writes are not retried
- [x] A hanging API still gets the friendly answer inside the budget
- [x] Tests passing (`cd alexa && npm run lint && npm run typecheck && npm test`)

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Assumptions

- The 6.5 s budget counts from the start of the request handling; the Lambda init before it was about 0.1 s in the
  reported case. Alexa's 8 s include it, so 1.5 s are left for init and the network to Alexa.
- The API Lambda keeps 256 MB; whether it was cold too is not visible in the skill log. Raise it only if cold
  starts of the API still show up (cost: a few cents per month).

## Out of Scope

- Keeping Lambdas warm (scheduled pings, provisioned concurrency): costs money for a rare case.
- The Echo Show widget (MAINT-002).

---

# Implementation Status

Done (2026-10-07).

- `alexa/src/config.ts`: `DEFAULT_API_TIMEOUT_MS` 4 000 (one attempt), `RESPONSE_BUDGET_MS` 6 500, `MIN_RETRY_MS`
  1 000.
- `alexa/src/tennerApi.ts`: per-call timeout from the request deadline; one retry for GET without a response.
- `alexa/src/session.ts`: the deadline is set when the request starts.
- Tests: `alexa/tests/tennerApi.test.ts` (scaled times: slow first call, retry after a failure and after a timeout,
  no retry for writes, no run past the deadline), `alexa/tests/skill.test.ts` (budget constants),
  `alexa/tests/requestLog.test.ts` (a retried read logs two calls), `alexa/tests/linking.test.ts` (hanging API).
- Verified on the device: not yet (owner: open the skill after a longer pause).
