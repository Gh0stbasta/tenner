# HOUSEHOLD-ADMIN-004: Implement Member Deactivation

## Type

Full-Stack Feature

---

## Priority

Low

---

## Phase

V2

---

## Goal

Allow a household member to be deactivated (e.g. a child moving out)
while preserving their history.

---

# Background

Completion history is immutable and references `completedBy`. Deleting members
would orphan history. Deactivation keeps history intact.

---

# Dependencies

```text
HOUSEHOLD-ADMIN-001
PRODUCTIVITY-005
```

---

# Scope

## API

```text
POST /users/{userId}/deactivate   { "reassignTo": "JULIA" }
POST /users/{userId}/reactivate
```

## Rules

```text
the last active member cannot be deactivated
active Tenners assigned to the member must be reassigned (reassignTo required if any exist)
rotations (HOUSEHOLD-001) remove the member
deactivated members cannot be assigned or complete Tenners
history keeps showing the member's display name
```

## Frontend

Deactivate action in member settings with a reassignment step and summary.

---

# Testing Requirements

```text
Deactivate With Reassignment
Reassignment Required
Last Active Member Protected
Deactivated Member Rejected In Validation
History Still Shows Name
Reactivate
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Deactivate/reactivate endpoints
Reassignment logic
UI flow
Tests
Documentation
```

---

# Validation

```bash
npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- Members can be deactivated and reactivated
- Open Tenners are reassigned
- History preserved
- Tests passing

---

# Definition of Done

- Household changes are handled without data loss
- Feature deploys through GitHub Actions

---

# Out of Scope

- Erasure of personal data (DATA-005)

---

# Implementation Status

Implemented 2026-10-05.

- [x] Members can be deactivated and reactivated: `POST /users/{userId}/deactivate` (`reassignTo`) and
  `/reactivate`; settings show "deaktivieren" (with a reassignment step and summary) and "reaktivieren"
- [x] Open Tenners are reassigned: all non-archived Tenners (active and inactive) of the member move to
  `reassignTo`, which is required if any exist and must be another active member
- [x] History preserved: the member stays in the list (inactive), history shows its name unchanged
- [x] Last active member protected; deactivating yourself is rejected (you would lock yourself out)
- [x] Deactivated members are rejected as assignee and as `completedBy`; onboarding does not offer them
- [x] Access revoked: every account is removed from the member's Cognito group (no new IAM permission needed)
- [x] Tests passing: backend 638 (deactivate with reassignment, reassignment required, last active member, validation
  rejects deactivated member, history still shows name, reactivate, Cognito group cleanup), frontend 295, Terraform 51
- [ ] Deploys through GitHub Actions: two new API routes; verified after merge

Decisions and assumptions:

- PRODUCTIVITY-005 (bulk operations) does not exist; reassignment uses sequential updates before the member is
  deactivated, so a failure leaves the member active and a retry completes the move.
- Rotations (HOUSEHOLD-001) do not exist yet; nothing to remove.
- An already issued ID token of the deactivated member stays valid for up to 60 minutes (documented as residual risk
  in `docs/security.md`).
- Reactivation does not restore Cognito membership; the person picks the member again on the next login.
