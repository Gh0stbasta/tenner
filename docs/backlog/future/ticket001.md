# FUTURE-001: Support Multiple Households per User

## Type

Product Feature (Postponed)

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Allow one person to belong to more than one household (e.g. own home and
parents' house, or shared flat and family home) and switch between them.

---

# Background

The architecture lists "Multiple households" as a future Cognito feature.
The data model is prepared: every item is partitioned by `tenantId` (TICKET-006).
Currently a user's `tenantId` is a single immutable token claim (SECURITY-002).

Postponed because the current household does not need it.

---

# Dependencies

```text
SECURITY-004
HOUSEHOLD-ADMIN-001
HOUSEHOLD-ADMIN-005
```

---

# Scope

- Membership table: `userSub → [tenantId, role]`.
- Active household selected per request (header or path), validated against memberships
  server-side; never trusted from the client alone.
- Household switcher in the UI.
- Invitations to a household (email link, expiring, single-use).
- Notifications and analytics per household.

---

# Deliverables

```text
ADR (tenant selection mechanism)
Membership model
Switcher UI
Invitation flow
Tests
```

---

# Acceptance Criteria

- Users can belong to and switch between households
- Cross-household data access impossible
- Invitations secure and expiring

---

# Definition of Done

- Multi-household use is supported securely

---

# Out of Scope

- Public self-service sign-up (FUTURE-003)
