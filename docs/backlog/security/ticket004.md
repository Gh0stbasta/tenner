# SECURITY-004: Enforce Identity-Based Authorization in the Backend

## Type

Backend Feature / Security

---

## Priority

High

---

## Phase

MVP

---

## Goal

Derive tenant and user from the authenticated identity in the backend and stop
trusting client-supplied identity fields.

---

# Background

Today the backend uses `tenantId = "default"` and accepts `completedBy` from the
request body. After authentication (SECURITY-002), identity must come from JWT claims:

```text
custom:tenantId → tenantId for all data access
custom:userId   → acting user
```

---

# Dependencies

```text
SECURITY-002
SECURITY-003
```

---

# Scope

## Request Context

Create a central request context built once per invocation:

```typescript
RequestContext { tenantId: string; userId: string; correlationId: string }
```

Built from `event.requestContext.authorizer.jwt.claims`.
Missing claims → `401`/`403`, never a fallback to `"default"` in production.

## Data Access

All repository calls receive `tenantId` from `RequestContext`. Remove any
hardcoded tenant constant from request paths (keep only for migration scripts).

## Acting User

```text
completedBy defaults to RequestContext.userId
completedBy different from the acting user is allowed (covering for someone)
  but the record additionally stores recordedBy = RequestContext.userId
```

## Audit Fields

Set `createdBy` / `updatedBy` from the identity on Tenner writes.

## Tests

Add a reusable test helper to build authenticated events.

---

# Testing Requirements

```text
Tenant From Claims
Missing Claims Rejected
Cross-Tenant Access Impossible (repository-level test)
completedBy Default
recordedBy Stored
Audit Fields Set
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
RequestContext module
Refactored handlers and services
Audit fields
Tests
docs/architecture.md (authorization model)
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

- Tenant and user derived exclusively from verified claims
- No client-controlled tenant selection possible
- Completion records the acting user
- Audit fields populated
- Tests passing

---

# Definition of Done

- Data access is bound to the authenticated identity
- Feature deploys through GitHub Actions

---

# Out of Scope

- Roles (HOUSEHOLD-ADMIN-005)
- Multi-household switching (FUTURE-001)
