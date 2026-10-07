# HOTFIX-004: Alexa Manifest Notifications Permission

## Type

Alexa skill package

---

## Priority

High (blocks every deployment)

---

## Goal

The deployment uploads the skill manifest: Amazon accepts it, and the Alexa health check runs.

---

# Background

After HOTFIX-003, Terraform apply, the frontend publish and the smoke tests passed. The deployment (run 37438739108,
2026-10-06) then failed in "Deploy Alexa skill package":

```text
manifest=FAILED
"When specifying event publications you must include alexa::devices:all:notifications:write as a permission"
```

ALEXA-008 added the `AMAZON.MessageAlert.Activated` publication (Proactive Events) without that permission. The
manifest had never been validated by Amazon before (TD-034).

---

# Requirements

- `alexa/skill-package/skill.json` requests `alexa::devices:all:notifications:write`.
- A skill-package test fails when the manifest publishes events without that permission.

---

# Acceptance Criteria

- [x] The manifest lists the permission next to `person_id:read` and the reminders permission.
- [x] The new test fails without the permission and passes with it.
- [x] alexa tests (147), lint and script tests pass.
- [x] `alexa/README.md` names the permission.

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented (TD-034 stays open: the remaining Amazon-side validations show on the next deploy)
- [x] Acceptance criteria verified
- [x] Git commit created

---

# Assumptions

- Amazon accepts the rest of the manifest. Its validation reported this single error; further errors can surface
  on the next deploy.
- In the Alexa app the user grants "Benachrichtigungen" for the skill, as `alexa/README.md` already describes.

---

# Out of Scope

- Changes to the deploy script or the health check.

---

# Implementation Status

Done (2026-10-06). `alexa/skill-package/skill.json`, `alexa/tests/skillPackage.test.ts`, `alexa/README.md`.
