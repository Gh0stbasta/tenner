# HOUSEHOLD-ADMIN-001: Implement Household Member Management

## Type

Full-Stack Feature

---

## Priority

High

---

## Phase

V2

---

## Goal

Replace the hardcoded household users (`STEFAN`, `JULIA`) with managed
household member records.

---

# Background

The architecture states for Version 1:

```text
Manually configured users only.
No registration process.
No self-service onboarding.
```

Users are currently hardcoded in backend validation and frontend dropdowns
(TICKET-013, FRONTEND-008). Adding a household member (e.g. a child) requires a
code change in several places.

---

# Dependencies

```text
TICKET-008
FRONTEND-008
```

---

# Scope

## Storage

Create table (Terraform):

```text
tenner-users
  PK tenantId
  SK userId
```

Attributes:

```text
userId        stable identifier (uppercase slug, immutable)
displayName   1 - 40 chars
color         one of a fixed palette
active        boolean
createdAt / updatedAt
```

PAY_PER_REQUEST, PITR enabled, encryption, mandatory tags.

## Seed

Idempotent seed creating `STEFAN` and `JULIA` so that existing data remains valid.

## API

```text
GET    /users
POST   /users
PUT    /users/{userId}
```

No DELETE: members are deactivated (HOUSEHOLD-ADMIN-004).

## Validation Refactoring

Replace hardcoded user enums in:

```text
Create / Update validation (assignedTo)
Complete validation (completedBy)
Dashboard and analytics user lists
Frontend dropdowns
```

with lookups against `tenner-users` (cached per Lambda invocation).

## Frontend

Settings section "Household members": list, add, rename, color.

---

# Security

Until authentication exists (SECURITY-002), member management is available to
anyone with access to the app. Document this explicitly as a known limitation.

---

# Testing Requirements

```text
List Members
Create Member
Duplicate userId Rejected
Rename Member
Seed Idempotency
Validation Uses Stored Members
Unknown User Rejected
Frontend Member Editor
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
tenner-users table
Seed script
Users API
Validation refactoring
Settings UI section
Tests
docs/architecture.md (domain model: User)
```

---

# Validation

```bash
terraform fmt -check

terraform validate

npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- Members stored in DynamoDB
- Existing users preserved via seed
- No hardcoded user lists remain
- Members manageable in settings
- Architecture documentation updated
- Tests passing

---

# Definition of Done

- Household composition changes need no code change
- Feature deploys through GitHub Actions

---

# Out of Scope

- Login accounts per member (SECURITY-002)
- Roles (HOUSEHOLD-ADMIN-005)
- Deactivation (HOUSEHOLD-ADMIN-004)

---

# Implementation Status

Implemented 2026-10-05.

- [x] Members stored in DynamoDB: `members` + `membersVersion` (optimistic locking) in the household item of
  `tenner-households` — deviation from the proposed `tenner-users` table, see decision below
- [x] Existing users preserved via seed: `STEFAN` and `JULIA` apply as read-time default until the first change
  (idempotent, no migration, no seed script needed)
- [x] No hardcoded user lists remain: backend validation (`assignedTo`, `completedBy`), identity, onboarding,
  dashboard workload and all frontend dropdowns, filters, labels and preferences use the managed members; the seed
  is the only constant
- [x] Members manageable in settings: "Haushaltsmitglieder" with list, add, rename and color
- [x] Architecture documentation updated (`docs/architecture.md` → Domain Model → User)
- [x] Tests passing: backend 598 (list, create, duplicate rejected, rename, seed idempotency, validation uses
  stored members, unknown user rejected, Cognito group creation, repository locking), frontend 278 (member
  editor, pickers, workload names), Terraform 51; lint, build, `terraform fmt`/`validate` clean
- [ ] Deploys through GitHub Actions: verified after merge

Decisions and assumptions:

- **Storage:** one attribute in the existing household item instead of a new table. A household has a handful of
  members; one GetItem returns them with timezone and vacation; no new table, IAM or deploy-role permissions.
- **API:** `GET/POST /users`, `PUT /users/{userId}`; `userId` is derived from the name if omitted ("Jörg" → `JOERG`)
  and immutable. At most 20 members.
- **Validation:** schemas check only the ID format; services check `assignedTo` and explicit `completedBy` against
  active members (400). List/dashboard/history filters accept any valid ID (unknown → empty result). No per-
  invocation cache: each check is one GetItem (small item, on-demand cost negligible).
- **Cognito:** groups of new members are created by the API on their first assignment; the Lambda role gets
  `cognito-idp:CreateGroup` on the Tenner user pool (managed in `terraform/iam.tf`, applied by the pipeline).
- **Security:** member management is open to every household member (authentication exists since SECURITY-002;
  roles follow with HOUSEHOLD-ADMIN-005). Every new member is a free place for the Google self-assignment until
  its person signs in (TD-020).
- Member colors are shown in the settings; using them elsewhere (avatars, chips) is left to later UX work.

Technical debt: TD-007 resolved for users; TD-020 and TD-023 updated.
