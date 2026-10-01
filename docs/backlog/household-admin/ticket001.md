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
