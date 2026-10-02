# HOUSEHOLD-ADMIN-005: Introduce Household Roles

## Type

Full-Stack Feature

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Introduce simple roles so that household administration can be restricted.

```text
ADMIN    manage members, categories, household settings, integrations
MEMBER   manage and complete Tenners
CHILD    complete assigned Tenners only (optional)
```

---

# Background

Without authentication every user can do everything. Once authentication
(SECURITY-002) and authorization (SECURITY-004) exist, administrative
functions should be limited, especially when children use the app.

---

# Dependencies

```text
SECURITY-002
SECURITY-004
HOUSEHOLD-ADMIN-001
```

---

# Scope

## Model

Add `role` to member records. At least one ADMIN must always exist.

## Enforcement

Role checks in the backend authorization layer (SECURITY-004), not in route handlers.

Permission matrix documented in `docs/architecture.md`:

```text
Action                         ADMIN  MEMBER  CHILD
Manage members/categories        ✓
Household settings               ✓
Create/Edit/Delete Tenners       ✓      ✓
Complete any Tenner              ✓      ✓
Complete own Tenners             ✓      ✓      ✓
View analytics                   ✓      ✓      (own)
```

## Frontend

Hide unavailable actions; backend remains the source of truth.

---

# Testing Requirements

```text
Each Role Against Each Action
Last Admin Protection
Frontend Hides Actions
Backend Rejects Forbidden Actions (403)
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Role model
Authorization rules
Permission matrix documentation
UI adjustments
Tests
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

- Roles enforced in backend
- Permission matrix documented
- Last admin protected
- Tests passing

---

# Definition of Done

- Administrative actions are restricted appropriately
- Feature deploys through GitHub Actions

---

# Out of Scope

- Custom roles
- Per-Tenner permissions
