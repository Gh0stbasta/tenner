# TICKET-019: Implement Get Tenner API

## Type

Backend Feature

---

## Priority

High

---

## Phase

MVP

---

## Goal

Implement retrieval of a single Tenner by its identifier.

The architecture defines:

```text
GET /tenners/{id}
```

but no ticket implements it yet.

---

# Background

The following capabilities already exist:

- Create, List, Update, Delete Tenner APIs
- Complete, Undo and Restore workflows
- Backend domain foundation with repository and service layers

The Edit Tenner dialog (FRONTEND-005) and the upcoming Tenner detail view
(FRONTEND-009) need to load a single Tenner without listing all Tenners.

---

# Dependencies

```text
TICKET-008
TICKET-010
```

---

# Scope

Implement:

```text
GET /tenners/{tennerId}
```

---

# Business Rules

## Existing Tenner

Return the Tenner if it exists for the current tenant.

Otherwise return:

```text
404 Not Found
```

---

## Deleted Tenners

Soft-deleted Tenners are returned only when requested explicitly:

```text
GET /tenners/{tennerId}?includeDeleted=true
```

Without the parameter a soft-deleted Tenner returns `404`.

---

## Tenant Scoping

Lookups must always use:

```text
tenantId + tennerId
```

A Tenner of another tenant must never be returned.

---

# Response

## Success

```text
200 OK
```

```json
{
  "success": true,
  "data": {
    "tennerId": "tenner-001",
    "title": "Vacuum Office",
    "category": "HOUSEHOLD",
    "frequencyDays": 14,
    "estimatedMinutes": 10,
    "assignedTo": "STEFAN",
    "lastCompleted": "2026-10-01T18:30:00Z",
    "nextDue": "2026-10-15",
    "active": true,
    "createdAt": "2026-09-01T10:00:00Z",
    "updatedAt": "2026-10-01T18:30:01Z"
  }
}
```

Use the existing Tenner response DTO. Do not introduce a second representation.

---

## Errors

```text
400 VALIDATION_ERROR  (malformed tennerId)
404 NOT_FOUND
500 INTERNAL_ERROR
```

Use the standard error response format.

---

# Implementation

## Service

```typescript
getTenner(tenantId: string, tennerId: string, options: { includeDeleted: boolean })
```

## Repository

Use `GetItem`. Do not use `Scan`.

## Routing

Add the route to the existing Tenner API Lambda integration.

No additional Lambda function.

---

# IAM

Reuse existing `dynamodb:GetItem` permission if present. Otherwise add it restricted
to the `tenner-tenners` table.

---

# Logging

Log request, tennerId, result (found / not found) using the structured logger and correlation ID.

---

# Testing Requirements

Unit tests:

```text
Existing Tenner

Missing Tenner

Soft-Deleted Tenner Without Flag

Soft-Deleted Tenner With Flag

Invalid Identifier

Repository Failure
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
GET /tenners/{tennerId} route

GetTenner service method

Repository method

Unit tests

backend/README.md API documentation
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

- Endpoint implemented
- Missing Tenners return 404
- Soft-deleted Tenners hidden by default
- includeDeleted flag supported
- Tenant scoping enforced
- GetItem used instead of Scan
- Standard responses used
- Tests passing
- Documentation updated

---

# Definition of Done

- Single Tenner retrieval available
- Feature deploys through GitHub Actions

---

# Out of Scope

Do not implement:

- Completion history in the response (TICKET-020)
- Frontend integration
- Authentication
