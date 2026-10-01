# TICKET-015: Implement Restore Tenner API

## Type

Backend Feature

---

## Priority

Medium

---

## Goal

Implement the ability to restore a previously deleted Tenner.

The Restore workflow reverses the soft-delete operation created in Ticket-012.

A restored Tenner should immediately return to normal operation, including:

- Visibility in dashboards
- Due date calculations
- Completion workflows
- Analytics

Historical completion data must remain untouched.

---

# Background

The Tenner platform uses soft deletion.

Deleted Tenners are not physically removed.

Instead:

```text
active = false

deletedAt != null
```

This preserves:

- Completion history
- Analytics integrity
- Auditability

Users must be able to recover mistakenly deleted Tenners.

---

# Design Principles

## Restore, Don't Recreate

The original Tenner record must be restored.

Never:

```text
Create a new Tenner

Generate a new Tenner ID

Duplicate data
```

The original record remains authoritative.

---

## Historical Integrity

Restoring a Tenner must never modify:

```text
Completion History

Completion Records

Analytics Data
```

Only the Tenner state changes.

---

# Scope

Implement:

```text
POST /tenners/{tennerId}/restore
```

Purpose:

```text
Restore a previously deleted Tenner.
```

---

# Endpoint

## Request

```http
POST /tenners/{tennerId}/restore
```

Request body:

```json
{
  "restoredBy": "STEFAN"
}
```

---

# Request Fields

## restoredBy

Required.

Allowed values:

```text
STEFAN

JULIA
```

Used for audit logging.

---

# Business Rules

## Existing Tenner

The requested Tenner must exist.

Otherwise return:

```text
404 Not Found
```

---

## Deleted Tenner Required

Only soft-deleted Tenners may be restored.

Validation:

```text
active = false

deletedAt != null
```

---

## Already Active

If the Tenner is already active:

```text
Return Success
```

The operation should be idempotent.

The API must not return an error.

---

# Restore Behavior

The following fields must be updated:

---

## Active Flag

Before:

```text
false
```

After:

```text
true
```

---

## Deleted Timestamp

Before:

```text
2026-10-01T18:00:00Z
```

After:

```text
null
```

---

## Updated Timestamp

Set:

```text
current UTC timestamp
```

---

# Scheduling Rules

The restore operation must never recalculate:

```text
lastCompleted

nextDue
```

The original schedule must remain untouched.

Example:

Before deletion:

```text
lastCompleted:
2026-09-01

nextDue:
2026-09-15
```

After restoration:

```text
lastCompleted:
2026-09-01

nextDue:
2026-09-15
```

If the due date is already in the past, the Tenner simply becomes overdue again.

---

# Completion History

The restore operation must not modify:

```text
tenner-history
```

No completion records may be created, updated, deleted, reverted or recalculated.

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
    "active": true,
    "deletedAt": null
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

# Persistence

Update:

```text
tenner-tenners
```

The record must not be recreated.

Use the existing Tenner ID.

---

# Idempotency

The endpoint must be idempotent.

Calling:

```text
POST /restore
```

multiple times must not create side effects.

Example:

```text
Restore Deleted Tenner -> Success

Restore Again -> Success
```

Result:

```text
No additional changes
```

---

# Service Layer

Implement:

```typescript
restoreTenner()
```

Responsibilities:

```text
Load Tenner

Verify Exists

Apply Restore Rules

Update Active State

Clear Deleted Timestamp

Persist Changes

Map Response
```

---

# Repository Layer

Implement:

```typescript
restore()
```

Responsibilities:

```text
Load Existing Record

Apply Restore State

Persist Update
```

No business logic.

No history manipulation.

---

# Concurrency Protection

Prevent conflicting updates.

Use optimistic locking based on:

```text
updatedAt
```

Concurrent modifications must return:

```text
409 Conflict
```

Error code:

```text
CONCURRENT_MODIFICATION
```

---

# Logging

Log:

```text
Tenner Restored

Tenner ID

Restored By

Previous Deleted Timestamp
```

Do not log:

```text
Secrets

Credentials

Sensitive Internal Data
```

---

# DTOs

Create:

```typescript
RestoreTennerRequest

RestoreTennerResponse
```

---

# Testing Requirements

Create tests for:

```text
Successful Restore

Restore Already Active Tenner

Restore Missing Tenner

Deleted Timestamp Cleared

Active Flag Set To True

UpdatedAt Updated

Concurrent Modification

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
POST /tenners/{tennerId}/restore
```

Create:

```text
RestoreTennerRequest

RestoreTennerResponse
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

- Restore endpoint implemented
- Soft-deleted Tenners can be restored
- Active flag reset to true
- DeletedAt cleared
- Original Tenner ID retained
- Completion history untouched
- NextDue preserved
- LastCompleted preserved
- Idempotent behavior implemented
- Standard API response returned
- Tests passing

---

# Definition of Done

- Deleted Tenners can be recovered safely
- Historical data preserved
- Scheduling state preserved
- Analytics integrity maintained
- Architecture respected
- Logging operational
- Tests passing
- Deployable through GitHub Actions

---

# Out of Scope

Do not implement:

- Restore Completion History
- Restore Multiple Tenners
- Hard Delete Recovery
- Dashboard API
- Analytics API
- Authentication
- Authorization
- Frontend Integration

These capabilities will be implemented in separate tickets if required.
