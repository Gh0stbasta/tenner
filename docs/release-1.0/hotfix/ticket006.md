# HOTFIX-006: Alexa Health Check Tolerates Simulator Outages

## Type

CI/CD

---

## Priority

High (blocks every deployment)

---

## Goal

The deploy is green when the skill works, even when Amazon's simulator fails. Real skill errors still fail the
deploy.

---

# Background

After HOTFIX-005 the deployment (run 37448126167, four attempts on 2026-10-06) kept failing in "Alexa health
check":

```text
Alexa health check failed: simulation status 'FAILED': An unexpected error occurred.
```

At the same time the owner's test in the developer console („öffne tenner board“, account linked) answered
correctly. The SMAPI simulator fails before it reaches the skill and gives no reason. A failure we can neither
diagnose nor influence should not block every deploy.

---

# Requirements

- `check_alexa_simulation.py` separates a simulator failure (status not SUCCESSFUL, exit code 3) from a wrong answer
  or a skill error (exit code 1).
- `alexa-health-check.sh` retries a simulator failure up to three times, 20 s apart. Then it reports a GitHub
  warning and exits 0. Every other failure fails the step as before.
- The simulation JSON is never printed: once the account is linked, it contains the request envelope with access
  tokens.
- The runbook explains the warning and the manual check.

---

# Acceptance Criteria

- [x] Exit code 3 for status FAILED, exit code 1 for a skill error or a wrong answer (unit tests).
- [x] The health check retries, then warns and does not fail on repeated simulator failures.
- [x] Script tests (45), `bash -n` and shellcheck pass.
- [x] `docs/runbooks/alexa.md` and `alexa/README.md` updated.

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented (see Assumptions; TD-034 still covers the unverified Amazon shapes)
- [x] Acceptance criteria verified
- [x] Git commit created

---

# Assumptions

- The simulator failure is on Amazon's side: the same utterance works in the console with the same account.
- The skill's own monitoring (skill error alarm, ALEXA-009) catches real outages that a skipped check would miss.

---

# Out of Scope

- Replacing the simulator with a direct Lambda invocation (would need an extra IAM permission for the deploy role).

---

# Implementation Status

Done (2026-10-06). `scripts/check_alexa_simulation.py`, `scripts/alexa-health-check.sh`,
`scripts/tests/test_check_alexa_simulation.py`, `docs/runbooks/alexa.md`, `alexa/README.md`.
