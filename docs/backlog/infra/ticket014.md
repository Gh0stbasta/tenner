# TICKET-014: Implement Undo Completion Workflow

## Type

Backend Feature

---

## Priority

High

---

## Goal

Implement the ability to undo the latest completion of a Tenner.

This workflow is intended to correct accidental completions without losing data integrity.

When a completion is undone, the system must:

1. Validate the request.
2. Load the Tenner.
3. Identify its latest active completion.
4. mark that completion as reverted.
5. restore the Tenner state from the previous active completion.
6. persist all changes atomically.
7. return the restored Tenner state.

Completion records must never be physically deleted.

---

# Background

The Complete Tenner workflow:

- creates an immutable completion record
- updates `lastCompleted`
- calculates `nextDue`
- persists both changes atomically

Users may accidentally complete the wrong Tenner or submit a completion twice.

The undo workflow must correct this while preserving an auditable history.

---

# Design Decision

## Revert Instead of Delete

Undo must not physically delete a completion record.

The original completion record must remain in:

```text
tenner-history
```

and be marked as reverted.

This preserves:

- historical traceability
- analytics integrity
- auditability
- future troubleshooting capability

---

# Scope

Implement:

```text
POST /tenners/{tennerId}/undo-completion
```

Purpose:

```text
Undo the latest active completion of a Tenner.
```

Only the most recent non-reverted completion may be undone.

---

# Endpoint

## Request

```http
POST /tenners/{tennerId}/undo-completion
Content-Type: application/json
```

Example request:

```json
{
  "revertedBy": "STEFAN",
  "reason": "Completed by mistake"
}
```

---

# Request Fields

## revertedBy

Required.

Allowed values:

```text
STEFAN
JULIA
```

The user reverting a completion does not need to match the user who originally completed the Tenner.

---

## reason

Optional.

Validation:

```text
Maximum Length: 250
```

If supplied, whitespace-only values must be rejected.

---

# Business Rules

## Existing Tenner

The Tenner must exist.

Otherwise return:

```text
404 Not Found
```

---

## Active Tenner

Only active Tenners may use the standard undo workflow.

A soft-deleted or inactive Tenner must return:

```text
409 Conflict
```

---

## Latest Completion Only

The workflow must identify the latest non-reverted completion for the requested Tenner.

Only that completion may be reverted.

Older completions must not be directly reverted while a newer active completion exists.

---

## No Completion Available

If no active completion exists, return:

```text
409 Conflict
```

Error code:

```text
NO_COMPLETION_TO_UNDO
```

---

## Completion State

Extend the completion model with:

```text
revertedAt

revertedBy

revertReason
```

Default values for new completions:

```text
revertedAt = null

revertedBy = null

revertReason = null
```

---

## Undo State

When a completion is undone, update the completion record:

```text
revertedAt = current UTC timestamp

revertedBy = request user

revertReason = supplied reason or null
```

The original fields must remain unchanged:

```text
completionId

tennerId

completedBy

completedAt

actualMinutes
```

---

# Tenner State Restoration

After reverting the latest completion, find the previous non-reverted completion.

---

## Previous Completion Exists

Restore:

```text
lastCompleted = previous completion completedAt

nextDue = previous completion date + frequencyDays

updatedAt = current UTC timestamp
```

Example:

```text
Previous Active Completion:
2026-09-01T18:00:00Z

Frequency:
14 days

Restored lastCompleted:
2026-09-01T18:00:00Z

Restored nextDue:
2026-09-15
```

The restored `nextDue` may be in the past.

This is valid and means the Tenner is overdue again.

---

## No Previous Completion Exists

If the reverted completion was the first completion, restore:

```text
lastCompleted = null

nextDue = createdAt calendar date

updatedAt = current UTC timestamp
```

This makes the Tenner due again.

If historical records do not contain a reliable `createdAt`, use the current UTC calendar date as a documented fallback.

---

# Recurrence Consistency

The restored schedule must use the Tenner's current:

```text
frequencyDays
```

This keeps undo behavior consistent with the current configuration.

The workflow must not restore an old frequency value unless completion records are later extended to store schedule snapshots.

---

# Atomic Persistence

Reverting the completion and restoring the Tenner must be one atomic operation.

Use:

```text
DynamoDB TransactWriteItems
```

The transaction must include:

```text
Update completion record as reverted

Update Tenner state
```

The workflow must never allow:

```text
Completion reverted without Tenner restoration

Tenner restored without completion being reverted
```

---

# Concurrency Protection

Use conditional expressions to ensure:

- the Tenner has not changed since it was loaded
- the completion has not already been reverted
- the selected completion is still eligible for undo

The implementation may use:

```text
updatedAt
```

for optimistic locking on the Tenner.

The completion update must verify:

```text
revertedAt does not exist or is null
```

A concurrent modification must return:

```text
409 Conflict
```

Error code:

```text
CONCURRENT_MODIFICATION
```

---

# Idempotency

Support an optional request header:

```http
Idempotency-Key: <unique-value>
```

If supplied, repeated requests with the same key must return the original successful response without reverting an additional completion.

A conflicting reuse of the key must return:

```text
409 Conflict
```

The implementation may persist the key on the reverted completion record:

```text
revertIdempotencyKey
```

---

# DynamoDB Access Pattern

The history table must support retrieving completion records for a specific Tenner in descending completion order.

Required query:

```text
tenantId + tennerId

ordered by completedAt descending
```

If the existing key and index structure does not support this query efficiently, add an appropriate Global Secondary Index.

Suggested index:

```text
Index Name:
tennerId-completedAt-index

Partition Key:
tennerId

Sort Key:
completedAt
```

For future multi-tenant support, a composite lookup value such as the following may be used instead:

```text
tenantTennerId = default#tenner-001
```

The final design must avoid scanning the entire history table.

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
    "tenner": {
      "tennerId": "tenner-001",
      "title": "Vacuum Office",
      "lastCompleted": "2026-09-01T18:00:00Z",
      "nextDue": "2026-09-15",
      "updatedAt": "2026-10-01T19:00:00Z"
    },
    "revertedCompletion": {
      "completionId": "completion-002",
      "completedAt": "2026-10-01T18:30:00Z",
      "revertedAt": "2026-10-01T19:00:00Z",
      "revertedBy": "STEFAN",
      "revertReason": "Completed by mistake"
    }
  }
}
```

---

## First Completion Reverted

Example response:

```json
{
  "success": true,
  "data": {
    "tenner": {
      "tennerId": "tenner-001",
      "lastCompleted": null,
      "nextDue": "2026-09-15",
      "updatedAt": "2026-10-01T19:00:00Z"
    },
    "revertedCompletion": {
      "completionId": "completion-001",
      "revertedAt": "2026-10-01T19:00:00Z",
      "revertedBy": "STEFAN"
    }
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

## No Completion Available

HTTP:

```text
409 Conflict
```

Response:

```json
{
  "success": false,
  "error": {
    "code": "NO_COMPLETION_TO_UNDO",
    "message": "No active completion is available to undo."
  }
}
```

---

## Inactive Tenner

HTTP:

```text
409 Conflict
```

Response:

```json
{
  "success": false,
  "error": {
    "code": "TENNER_INACTIVE",
    "message": "Completions of inactive Tenners cannot be undone."
  }
}
```

---

## Concurrent Modification

HTTP:

```text
409 Conflict
```

Response:

```json
{
  "success": false,
  "error": {
    "code": "CONCURRENT_MODIFICATION",
    "message": "The Tenner or completion was modified by another request."
  }
}
```

---

# API Gateway and Routing

Add:

```text
POST /tenners/{tennerId}/undo-completion
```

Use the existing Tenner API Lambda.

Do not introduce an additional Lambda function.

---

# DTOs

Create:

```typescript
UndoCompletionRequest

UndoCompletionResponse

RevertedCompletionResponse
```

---

# Service Layer

Implement:

```typescript
undoLatestCompletion()
```

Responsibilities:

```text
Load Tenner

Verify Active State

Load Latest Active Completion

Load Previous Active Completion

Calculate Restored State

Create Revert Metadata

Coordinate Atomic Persistence

Map Domain Result
```

---

# Repository Layer

Extend repository functionality.

Suggested methods:

```typescript
getLatestActiveCompletions(
  tenantId: string,
  tennerId: string,
  limit: number
): Promise<Completion[]>
```

```typescript
undoCompletion(
  tenner: Tenner,
  completion: Completion,
  expectedTennerUpdatedAt: string
): Promise<void>
```

The transaction implementation must use:

```text
DynamoDB TransactWriteItems
```

A sequence of independent update operations is not acceptable.

---

# IAM Requirements

Update the Lambda execution policy only if required.

Allow only the required DynamoDB operations on:

```text
tenner-tenners

tenner-history

required table indexes
```

Wildcard administrative access is not permitted.

---

# Logging

Log:

```text
Undo completion requested

Tenner ID

Completion ID

Reverted By

Whether a previous completion was restored

Restored next due date

Undo succeeded or failed
```

Do not log:

```text
AWS credentials

Tokens

Full event payloads

Sensitive request metadata
```

Use the existing structured logger and correlation ID.

---

# Metrics

Emit structured log events for future metrics:

```text
Successful undo operations

Failed undo operations

No-completion conflicts

Concurrency conflicts

Undo transaction duration
```

Do not create CloudWatch dashboards or alarms in this ticket.

---

# Testing Requirements

Create unit tests for:

```text
Successful Undo

Previous Completion Restored

First Completion Reverted

No Active Completion Exists

Inactive Tenner

Missing Tenner

Invalid Reverted User

Reason Too Long

Whitespace-Only Reason

Completion Already Reverted

Atomic Transaction Failure

Concurrent Tenner Modification

Concurrent Completion Modification

Idempotent Retry

Repository Failure
```

---

## Integration Tests

Verify:

```text
Completion and Tenner are updated together

Neither update persists when the transaction fails

Latest active completion is selected

Reverted completions are skipped

Previous active completion is restored

A repeated idempotent request does not revert another completion

History records are never deleted
```

---

## Coverage

Minimum coverage for newly added code:

```text
80%
```

---

# Documentation

Update:

```text
docs/architecture.md

backend/README.md
```

Document:

```text
Undo workflow

Reverted completion model

State restoration rules

History-query access pattern

Atomic transaction design

Concurrency behavior

Idempotency behavior
```

---

# Deliverables

Implement:

```text
POST /tenners/{tennerId}/undo-completion
```

Create or update:

```text
UndoCompletionRequest

UndoCompletionResponse

RevertedCompletionResponse

Completion domain model

UndoCompletionService

Completion repository implementation

DynamoDB transaction implementation

DynamoDB index if required

API routing

IAM permissions

Unit tests

Integration tests

Documentation
```

---

# Validation

The following must succeed:

```bash
terraform fmt -check

terraform validate

npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- Undo endpoint implemented
- Only the latest active completion can be undone
- Completion records are not physically deleted
- Revert metadata is persisted
- Previous active completion is restored
- First-completion undo makes the Tenner due again
- History lookup does not require a full table scan
- Tenner and completion updates are atomic
- Concurrent modifications return 409
- Optional idempotency is supported
- IAM permissions follow least privilege
- Standard API responses are used
- Unit and integration tests pass
- Documentation is updated

---

# Definition of Done

- Accidental completions can be safely undone
- Completion history remains auditable
- Tenner scheduling state is restored correctly
- Partial persistence is impossible
- Duplicate retry risk is controlled
- Architecture boundaries are respected
- Infrastructure and backend validation pass
- Feature deploys through GitHub Actions

---

# Out of Scope

Do not implement:

- Undoing an Arbitrary Older Completion
- Physical Completion Deletion
- Editing Completion History
- Restoring Deleted Tenners
- Manual Next-Due Override
- Schedule Snapshot Restoration
- Dashboard API
- Analytics API
- Authentication
- Frontend Integration

These capabilities may be delivered in separate tickets if required.
