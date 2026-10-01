# TICKET-011: Implement Update Tenner API

## Type

Backend Feature

---

## Priority

High

---

## Goal

Implement the ability to update existing Tenners.

This ticket allows users to modify recurring responsibilities after creation without recreating them.

The implementation must support partial updates while maintaining data integrity and validation.

This is the first endpoint that modifies existing business data.

---

# Background

The following capabilities already exist:

- API Infrastructure
- DynamoDB Infrastructure
- Domain Foundation
- Create Tenner API
- List Tenners API

Users must now be able to modify existing Tenners.

Examples:

```text
Change frequency from 14 to 30 days

Assign a Tenner from Stefan to Julia

Rename a Tenner

Adjust estimated duration

Deactivate a Tenner
```

---

# Scope

Implement:

```text
PUT /tenners/{tennerId}
```

Purpose:

```text
Update an existing Tenner.
```

---

# Endpoint

## Request

```http
PUT /tenners/{tennerId}
Content-Type: application/json
```

Example:

```json
{
  "title": "Vacuum Home Office",
  "frequencyDays": 30,
  "estimatedMinutes": 15,
  "assignedTo": "JULIA"
}
```

---

# Update Strategy

The API must support partial updates.

Example:

```json
{
  "frequencyDays": 30
}
```

must only update:

```text
frequencyDays
```

All other fields remain unchanged.

---

# Allowed Fields

The following properties may be updated:

```text
title

category

estimatedMinutes

frequencyDays

assignedTo

active
```

---

# Protected Fields

The following properties must never be modified through this endpoint:

```text
tenantId

tennerId

createdAt

lastCompleted

nextDue
```

---

## Future Exception

```text
nextDue
```

may receive dedicated maintenance endpoints later.

Not part of this ticket.

---

# Validation Rules

## Title

```text
Minimum Length: 3

Maximum Length: 100
```

---

## Category

Allowed values:

```text
HOUSEHOLD

FITNESS

FAMILY

HOME

PERSONAL

FINANCE
```

---

## Estimated Minutes

Valid range:

```text
1 - 480
```

---

## Frequency Days

Valid range:

```text
1 - 3650
```

---

## Assigned User

Allowed values:

```text
STEFAN

JULIA
```

---

# Business Rules

## Updated Timestamp

Every successful update must refresh:

```text
updatedAt
```

using the current UTC timestamp.

---

## Frequency Changes

Changing:

```text
frequencyDays
```

must not automatically change:

```text
lastCompleted

nextDue
```

The existing schedule remains untouched.

Future recalculation behavior will be handled through completion logic.

---

## Active Flag

Users must be able to deactivate Tenners.

Example:

```json
{
  "active": false
}
```

Inactive Tenners should disappear from default dashboard views.

---

# Persistence

Update data in:

```text
tenner-tenners
```

through the repository layer.

Handlers must never access DynamoDB directly.

---

# Response

## Success

HTTP:

```text
200 OK
```

Response:

```json
{
  "success": true,
  "data": {
    "tennerId": "123",
    "title": "Vacuum Home Office",
    "updatedAt": "2026-10-01T18:00:00Z"
  }
}
```

---

## Not Found

HTTP:

```text
404 Not Found
```

Response:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Tenner not found."
  }
}
```

---

## Validation Error

HTTP:

```text
400 Bad Request
```

Response:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR"
  }
}
```

---

# Repository Layer

Implement:

```typescript
update()
```

Repository responsibilities:

```text
Load Existing Record

Apply Changes

Persist Changes
```

No business validation inside repository.

---

# Service Layer

Implement:

```typescript
updateTenner()
```

Responsibilities:

```text
Business Validation

Update Rules

Protected Field Enforcement

Timestamp Updates
```

---

# DTOs

Create:

```typescript
UpdateTennerRequest

UpdateTennerResponse
```

---

# Logging

Log:

```text
Tenner Updated

Tenner ID

Changed Fields

Assigned User
```

Do not log:

```text
Secrets

Credentials

Internal AWS Metadata
```

---

# Testing Requirements

Create tests for:

```text
Successful Update

Update Single Field

Update Multiple Fields

Update Active Flag

Update Frequency

Invalid Category

Invalid Assigned User

Invalid Duration

Tenner Not Found

Repository Failure
```

Minimum coverage:

```text
80%
```

for newly added code.

---

# Deliverables

Implement:

```text
PUT /tenners/{tennerId}
```

Create:

```text
UpdateTennerRequest

UpdateTennerResponse
```

Update:

```text
Service Layer

Repository Layer

Routing

Tests

Documentation
```

---

# Validation

The following must succeed:

```bash
npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- PUT endpoint implemented
- Partial updates supported
- Protected fields enforced
- Validation enforced
- UpdatedAt automatically maintained
- Not Found handling implemented
- Standard API response returned
- Unit tests passing

---

# Definition of Done

- Existing Tenners can be updated
- Business rules enforced
- Repository pattern respected
- Error handling implemented
- Logging operational
- Tests passing
- Deployable through GitHub Actions

---

# Out of Scope

Do not implement:

- Delete Tenner
- Complete Tenner
- Dashboard API
- Analytics API
- Authentication
- Bulk Update Operations

These will be implemented in separate tickets.
