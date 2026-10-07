# HOTFIX-005: Enable Alexa Skill Testing in the Deployment

## Type

CI/CD

---

## Priority

High (blocks every deployment)

---

## Goal

The deployment enables the skill for testing on the development stage, so the Alexa health check can simulate
„öffne tenner board“. When the check fails, it shows Amazon's reason.

---

# Background

After HOTFIX-004 the skill package was deployed (manifest and interaction model SUCCEEDED). The deployment (run
37445434324, 2026-10-06) then failed in "Alexa health check" with only `simulation status 'FAILED'`:

- `check_alexa_simulation.py` dropped the error message Amazon returns with a failed simulation.
- Enabling testing ("Skill testing is enabled in: Development") was a manual console step in `alexa/README.md`
  and missing from the owner's activation list. SMAPI simulations fail while testing is disabled.

---

# Requirements

- `scripts/deploy-alexa-skill.sh` runs `ask smapi set-skill-enablement` on the development stage after a successful
  package update (idempotent, what `ask deploy` does).
- `scripts/check_alexa_simulation.py` includes `result.error.message` when the simulation status is not SUCCESSFUL.
- `alexa/README.md` describes the automated step.

---

# Acceptance Criteria

- [x] The deploy script enables testing only on the `development` stage; the privacy test (ALEXA-010) still passes.
- [x] A failed simulation reports Amazon's reason (new unit test).
- [x] Script tests pass, `bash -n` and shellcheck are clean.
- [x] `alexa/README.md` updated.

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented (TD-034 stays open until the first green Alexa deploy)
- [x] Acceptance criteria verified
- [x] Git commit created

---

# Assumptions

- The simulation failed because testing was not enabled. The log did not show the reason. If the cause is
  different, the next run prints it.
- Enabling testing on the development stage publishes nothing. It makes the skill usable on the developer's own
  Amazon account, which the owner wants anyway.

---

# Out of Scope

- Account linking and the other manual activation steps.

---

# Implementation Status

Done (2026-10-06). `scripts/deploy-alexa-skill.sh`, `scripts/check_alexa_simulation.py`,
`scripts/tests/test_check_alexa_simulation.py`, `alexa/README.md`.
