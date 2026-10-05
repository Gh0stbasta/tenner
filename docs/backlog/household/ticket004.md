# HOUSEHOLD-004: Implement Temporary Handover

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

Allow a household member to hand over their Tenners temporarily to another member
(e.g. during a business trip or illness) with automatic return.

---

# Background

Vacation mode (SCHEDULING-005) pauses Tenners when **nobody** is home.
When only one member is away, their Tenners should be covered by someone else
rather than paused.

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
POST   /users/{userId}/handover   { "to": "JULIA", "until": "2026-10-12", "categories": [...] }
DELETE /users/{userId}/handover
```

## Behavior

- Matching Tenners get `assignedTo = to` and `originalAssignee = userId`.
- At `until` (checked by the scheduled notifier job or on read), assignments revert.
- Manual reassignment during handover clears `originalAssignee` for that Tenner.

## Frontend

"Hand over my Tenners" dialog in the user's profile/settings with a summary preview.

---

# Testing Requirements

```text
Handover Applies
Automatic Revert
Manual Revert
Category Filter
Manual Reassignment During Handover
Rotating Tenners Interaction
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Handover endpoints
Revert job
UI dialog
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

- Tenners can be handed over temporarily
- Assignments revert automatically
- Tests passing

---

# Definition of Done

- Absences of one member are covered without manual bookkeeping
- Feature deploys through GitHub Actions

---

# Out of Scope

- Approval workflow for handover

---

# Implementation Status

Implemented 2026-10-05.

- [x] Tenners can be handed over temporarily: `POST /users/{userId}/handover` `{ to, until, categories? }` moves the
  member's non-archived Tenners to `to` with `originalAssignee = userId`; `DELETE /users/{userId}/handover` gives
  them back early. Settings → "Haushaltsmitglieder": "Tenner von X übergeben" dialog (cover, last day, optional
  categories, live preview "N Tenner gehen bis … an …"), running handovers shown as "Vertreten von … bis …" with
  "Vertretung beenden"; cards show "Julia (für Stefan)"
- [x] Assignments revert automatically: after the last day (inclusive, household timezone) the next
  `GET /dashboard`, `GET /tenners` or `GET /household` gives the Tenners back and removes the handover
- [x] Tests passing: backend 680 (Handover Applies, Automatic Revert, Manual Revert, Category Filter, Manual
  Reassignment During Handover, Rotating Tenners Interaction, repository mapping, routes), frontend 309, Terraform 51;
  lint and build clean; new service code fully covered
- [ ] Deploys through GitHub Actions: two new API routes (Terraform), no IAM change; verified after merge

Decisions and assumptions:

- **No scheduler** (architecture decision in `docs/architecture.md`): give-back runs on read; limits in TD-031.
- The handover is stored on the household item (`handovers` + `handoversVersion`), at most one per member. Any
  member may start or end a handover for any active member (illness case; roles are HOUSEHOLD-ADMIN-005).
- `to` must be another active member who is not away; shared (`HOUSEHOLD`) is not a target.
- A manual change of `assignedTo` clears `originalAssignee`; the Tenner then stays with whoever it was given to.
- Rotating Tenners: completion continues from the original assignee's turn; an away next member is covered.
- Tenners the member covers for someone else move on with their original owner.
- A member deactivated during the handover gets nothing back; the cover keeps the Tenners.
- Fixed on the way: the frontend's "assigned Tenners" lookups (deactivation count, handover preview) counted shared
  Tenners, because member filters include them since HOUSEHOLD-002; they now filter by exact assignee.
