# HOUSEHOLD-ADMIN-006: Members Without Login

## Type

Full-Stack Feature

---

## Priority

High (prerequisite for the household seed, DATA-008)

---

## Phase

V2

---

## Goal

A household member that never signs in (e.g. the household help) can be created and assigned Tenners without
becoming a free place that a stranger could claim.

---

# Background

`docs/human/householdTaskSeed.md` (owner, 2026-10-07) adds the member „Haushaltshilfe“. Every member is a free
place until its person signs in, and anyone with a Google account can claim a free place (TD-020). Owner decision
2026-10-07: „Mitglied ohne Login“.

---

# Dependencies

```text
HOUSEHOLD-ADMIN-001
HOTFIX-001 (self-assignment)
```

---

# Scope

- Member field `canSignIn` (default true; stored members without it read as true).
- `POST /users` accepts `canSignIn: false`; immutable afterwards (`PUT` rejects it).
- Onboarding never offers such members; `POST /onboarding/assignment` answers 404 for them.
- Settings: switch „Ohne Anmeldung (z. B. Haushaltshilfe)“ when adding a member; the list marks such members.

---

# Acceptance Criteria

- [x] A member without login can be created, listed and assigned Tenners like any member
- [x] It is never offered on the first login and cannot be claimed (404), also when all other members are taken
- [x] Existing stored members keep working (missing flag = can sign in)
- [x] The flag cannot be changed after creation
- [x] Tests passing: backend 868, frontend 387; lint and typecheck clean

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated (`backend/README.md` API table, TD-020 note)
- [x] Technical debt documented (none new)
- [x] Acceptance criteria verified
- [x] Git commit created

---

# Assumptions

- Immutable flag: switching a claimed member to "no login" would need the Cognito group revoked first. Deactivating
  and re-adding covers the rare case.
- Members without login still get the internal log channel in the notifier. They have no user channels, so nothing
  reaches a person.

---

# Out of Scope

- Roles (HOUSEHOLD-ADMIN-005), closing the open sign-up itself (TD-020).

---

# Implementation Status

Done (2026-10-07).
