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

---

# Implementation Status

Implemented 2026-10-02.

- [x] Tenant and user derived exclusively from verified claims: `backend/src/auth/identity.ts` (`identityFromEvent`)
  reads `requestContext.authorizer.jwt.claims` (`custom:tenantId`, `custom:userId`) once per request in `src/index.ts`.
  No claims → 401; missing/unknown user or malformed tenant → 403 (`ForbiddenError`, new). `GET /health` stays public.
- [x] No client-controlled tenant selection: `AppConfig.tenantId` (`"default"`) removed; every repository call gets
  `identity.tenantId`. A `tenantId` in query or body is rejected by the strict schemas; headers are ignored.
- [x] Completion records the acting user: `completedBy` is optional and defaults to the user; a different member is
  allowed and `recordedBy` stores the acting user. `revertedBy` / `restoredBy` default to the user; another user → 403.
- [x] Audit fields populated: `createdBy` / `updatedBy` on create, update, delete, restore, complete and undo
  (also in `TennerResponse`). Older records map to `null` (TD-019).
- [x] Tests passing: 404 backend tests (was 369). New: `tests/identity.test.ts`, authentication tests in
  `tests/index.test.ts` (401 on every protected route, 403, tenant from claims, logger bound to `userId`),
  tenant isolation and legacy mapping in `tests/tenner.dynamodb.repository.test.ts`, `completedBy` default,
  `recordedBy`, covering-for-someone, idempotent replay with omitted `completedBy`, `revertedBy` mismatch.
  Test helper: `authenticatedEvent()` / `jwtClaims()` in `tests/mocks`.
- Validation: `npm run lint`, `npm run build`, `npm test` (coverage 99.8 % statements; `src/auth` 100 %).
- Docs: `backend/README.md` ("Authentication and Authorization"), `docs/architecture.md` ("Authorization Model"),
  TD-003 resolved, TD-019 added.

Deviations and assumptions:

- `RequestContext` keeps its existing shape (`event`, `deps`, `logger`); protected routes get an
  `AuthenticatedContext` with `identity`. The `correlationId` stays on the request logger instead of a separate field.
- 403 instead of 401 for valid tokens without household attributes: a new token would not help, and the frontend
  (SECURITY-003) treats 401 as "log in again", which would loop.
- The frontend still sends `completedBy` / `revertedBy` / `restoredBy` (always the logged-in user), so no frontend
  change is needed.
- Open until deployment: "Feature deploys through GitHub Actions" (needs the merge and the Cognito accounts with
  `custom:tenantId=default`, see README → "User Accounts").
