# TICKET-013: Implement Complete Tenner Workflow

## Type

Backend Feature

---

## Priority

Critical

---

## Goal

Implement the core Tenner workflow for completing a recurring task.

When a Tenner is completed, the system must:

1. Validate the request.
2. Load the current Tenner.
3. Create an immutable completion-history record.
4. Update the Tenner's completion state.
5. Calculate the next due date.
6. Persist both changes atomically.
7. Return the updated Tenner and completion details.

This workflow represents the central business capability of Tenner.

---

# Background

The following capabilities already exist:

- Create Tenner API
- List Tenners API
- Update Tenner API
- Delete Tenner API
- DynamoDB persistence layer
- Backend domain foundation
- Repository and service layers

A user must now be able to mark a Tenner as complete and automatically move it into its next recurrence cycle.

---

# Scope

Implement:

```text
POST /tenners/{tennerId}/complete
```

Purpose:

```text
Complete a Tenner and schedule its next occurrence.
```

---

# Endpoint

## Request

```http
POST /tenners/{tennerId}/complete
Content-Type: application/json
```

Example:

```json
{
  "completedBy": "STEFAN",
  "actualMinutes": 12
}
```

---

# Request Fields

## completedBy

Required.

Allowed values:

```text
STEFAN
JULIA
```

The user completing a Tenner does not need to be the user to whom it is assigned.

---

## actualMinutes

Optional.

Valid range:

```text
1 - 1440
```

If omitted, use:

```text
estimatedMinutes
```

from the Tenner.

---

## completedAt

Optional.

Format:

```text
ISO 8601 UTC timestamp
```

Example:

```text
2026-10-01T18:30:00Z
```

If omitted, use the current UTC timestamp.

This field allows users to record a Tenner shortly after it was actually completed.

Future-dated completion timestamps must be rejected.

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

Only active Tenners may be completed.

A soft-deleted or inactive Tenner must return:

```text
409 Conflict
```

---

## Completion Record

Every successful completion must create one immutable record in:

```text
tenner-history
```

Required properties:

```text
tenantId

historyId

tennerId

completedBy

completedAt

actualMinutes
```

---

## History ID

Generate a UUID for every completion.

Example:

```text
8b4772cd-781d-49b8-8cd0-4e68d5267d32
```

---

## Tenner State Update

After a successful completion, update:

```text
lastCompleted

nextDue

updatedAt
```

Values:

```text
lastCompleted = completedAt

nextDue = completedAt date + frequencyDays

updatedAt = current UTC timestamp
```

---

# Due-Date Calculation

## Calculation Basis

The next due date must be calculated from the actual completion date.

Example:

```text
completedAt:
2026-10-01T18:30:00Z

frequencyDays:
14

nextDue:
2026-10-15
```

---

## Date Storage

Store:

```text
lastCompleted
```

as an ISO 8601 UTC timestamp.

Store:

```text
nextDue
```

as a UTC calendar date in:

```text
YYYY-MM-DD
```

format.

Date calculations must be timezone-safe and deterministic.

---

## Early Completion

If a Tenner is completed before its current due date, calculate the next due date from the new completion date.

Example:

```text
Existing nextDue:
2026-10-10

Completed early:
2026-10-05

Frequency:
14 days

New nextDue:
2026-10-19
```

This keeps the initial recurrence model simple and completion-based.

---

## Overdue Completion

If a Tenner is overdue, calculate the next due date from the actual completion date.

Do not calculate it from the old due date.

This prevents the Tenner from remaining overdue immediately after completion.

---

# Atomic Persistence

Creating the completion record and updating the Tenner must be one atomic operation.

Use:

```text
DynamoDB TransactWriteItems
```

The transaction must include:

```text
Put completion-history record

Update Tenner state
```

The workflow must never allow:

```text
History created without Tenner update

Tenner updated without history creation
```

---

# Concurrency Protection

The transaction must prevent accidental duplicate or conflicting completions.

Use a conditional expression to verify that the Tenner still has the state loaded by the service.

The implementation may use:

```text
updatedAt
```

as an optimistic-locking value.

If the Tenner was modified concurrently, return:

```text
409 Conflict
```

Do not silently overwrite a newer state.

---

# Idempotency

Support an optional request header:

```http
Idempotency-Key: <unique-value>
```

If supplied, the key must prevent duplicate completion records caused by retries.

The same idempotency key for the same Tenner must return the original successful result without creating another completion.

A conflicting reuse of the key must return:

```text
409 Conflict
```

The implementation may store the idempotency key on the completion-history record.

If no idempotency key is supplied, process the request normally.

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
      "lastCompleted": "2026-10-01T18:30:00Z",
      "nextDue": "2026-10-15",
      "updatedAt": "2026-10-01T18:30:01Z"
    },
    "completion": {
      "completionId": "8b4772cd-781d-49b8-8cd0-4e68d5267d32",
      "completedBy": "STEFAN",
      "completedAt": "2026-10-01T18:30:00Z",
      "actualMinutes": 12
    }
  }
}
```

---

## Validation Error

HTTP:

```text
400 Bad Request
```

Example:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid completion request."
  }
}
```

---

## Not Found

HTTP:

```text
404 Not Found
```

Example:

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

## Inactive Tenner

HTTP:

```text
409 Conflict
```

Example:

```json
{
  "success": false,
  "error": {
    "code": "TENNER_INACTIVE",
    "message": "Inactive Tenners cannot be completed."
  }
}
```

---

## Concurrent Modification

HTTP:

```text
409 Conflict
```

Example:

```json
{
  "success": false,
  "error": {
    "code": "CONCURRENT_MODIFICATION",
    "message": "The Tenner was modified by another request."
  }
}
```

---

# API Gateway and Routing

Add the route:

```text
POST /tenners/{tennerId}/complete
```

The route must use the existing Tenner API Lambda integration.

No additional Lambda function should be introduced.

---

# DTOs

Create:

```typescript
CompleteTennerRequest

CompleteTennerResponse

CompletionResponse
```

The request DTO must support:

```text
completedBy

actualMinutes

completedAt
```

---

# Service Layer

Implement:

```typescript
completeTenner()
```

Responsibilities:

```text
Load Tenner

Verify Active State

Apply Defaults

Validate Completion Timestamp

Calculate Next Due Date

Create Completion Domain Object

Coordinate Atomic Persistence

Map Domain Result
```

---

# Repository Layer

Extend repository functionality to support atomic completion.

Suggested method:

```typescript
completeTenner(
  tenner: Tenner,
  completion: Completion,
  expectedUpdatedAt: string
): Promise<void>
```

The implementation must use:

```text
DynamoDB TransactWriteItems
```

A sequence of independent `PutItem` and `UpdateItem` calls is not acceptable.

---

# IAM Requirements

Update the Lambda execution policy only if required.

Allow:

```text
dynamodb:TransactWriteItems
```

Access must remain restricted to:

```text
tenner-tenners

tenner-history
```

and their explicitly required indexes.

Wildcard resource permissions are not permitted.

---

# Logging

Log:

```text
Tenner completion requested

Tenner ID

Completion ID

Completed By

Actual Minutes

Calculated Next Due Date

Completion succeeded or failed
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

Emit structured log events that can later support metrics for:

```text
Successful completions

Failed completions

Completion duration

Concurrency conflicts
```

Do not create CloudWatch alarms or dashboards in this ticket.

---

# Testing Requirements

Create unit tests for:

```text
Successful Completion

Default Actual Minutes

Explicit Actual Minutes

Default Completion Timestamp

Explicit Completion Timestamp

Future Completion Timestamp Rejected

Next Due Date Calculation

Early Completion

Overdue Completion

Inactive Tenner

Missing Tenner

Invalid Completed User

Invalid Actual Minutes

Atomic Transaction Failure

Concurrent Modification

Idempotent Retry

Repository Failure
```

---

## Integration Tests

Test the repository transaction against a mocked or local DynamoDB-compatible test environment.

Verify:

```text
Tenner and history are updated together

Neither write persists when the transaction fails

Duplicate idempotency keys do not create duplicate history
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
Completion workflow

Recurrence calculation

Atomic transaction design

Concurrency handling

Idempotency behavior

Date and timezone conventions
```

---

# Deliverables

Implement:

```text
POST /tenners/{tennerId}/complete
```

Create or update:

```text
CompleteTennerRequest

CompleteTennerResponse

CompletionResponse

CompleteTennerService

Tenner repository implementation

DynamoDB transaction implementation

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

- Complete endpoint implemented
- Missing Tenners return 404
- Inactive Tenners cannot be completed
- Completion history record created
- Tenner state updated
- Next due date calculated from completion date
- Actual minutes default to estimated minutes
- Completion and state update are atomic
- Concurrent modifications return 409
- Optional idempotency is supported
- IAM permissions follow least privilege
- Standard API responses are used
- Unit and integration tests pass
- Documentation is updated

---

# Definition of Done

- Users can complete Tenners
- Completion history is preserved
- Recurring schedule advances automatically
- Duplicate retry risk is controlled
- Partial persistence is impossible
- Architecture boundaries are respected
- Infrastructure and backend validation pass
- Feature deploys through GitHub Actions

---

# Out of Scope

Do not implement:

- Undo Completion
- Edit Completion History
- Delete Completion History
- Manual Next-Due Override
- Advanced Calendar Recurrence
- Weekly Day-Based Scheduling
- Monthly Calendar Scheduling
- Streak Calculations
- Dashboard API
- Analytics API
- Authentication
- Frontend Integration

These capabilities will be implemented in separate tickets if required.

---

## Implementation Status

Implemented: 2026-10-01.

### Deliverables

- [x] `POST /tenners/{tennerId}/complete`: `src/handlers/complete-tenner.ts`, route in `src/index.ts` and `local.api_routes`
- [x] DTOs: `CompleteTennerRequest`, `CompleteTennerResponse`, `CompletionResponse`
- [x] `CompleteTennerService` (`completeTenner()`: load, check active, defaults, timestamp checks, next due, completion, atomic persistence, mapping)
- [x] Repository `completeTenner(updated, record, expected)` with `TransactWriteItems` (no separate Put/Update calls)
- [x] `DynamoDbCompletionRepository.getById` (idempotency lookup) and the history mapper (`completionId` ↔ `historyId`)
- [x] IAM: unchanged. See the assumptions below.
- [x] Unit tests and documentation (`backend/README.md`, `docs/architecture.md`)

### Acceptance Criteria

| Criterion | Status |
|---|---|
| Complete endpoint implemented | [x] |
| Missing Tenners return 404 | [x] |
| Inactive Tenners cannot be completed | [x] 409 `TENNER_INACTIVE` (also for soft-deleted ones) |
| Completion history record created | [x] `tenantId`, `historyId` (UUID), `tennerId`, `completedBy`, `completedAt`, `actualMinutes` |
| Tenner state updated | [x] `lastCompleted`, `nextDue`, `updatedAt` |
| Next due date calculated from completion date | [x] early and overdue completions tested |
| Actual minutes default to estimated minutes | [x] |
| Completion and state update are atomic | [x] one `TransactWriteItems` |
| Concurrent modifications return 409 | [x] `CONCURRENT_MODIFICATION` |
| Optional idempotency is supported | [x] `Idempotency-Key`: replay, conflicting reuse → 409, concurrent duplicates |
| IAM permissions follow least privilege | [x] no new actions needed |
| Standard API responses are used | [x] |
| Unit and integration tests pass | [x] 216 backend tests, 100% coverage. Integration was tested against a fake DynamoDB endpoint, see below |
| Documentation is updated | [x] |

All ticket test cases are covered:
- successful completion, default and explicit actual minutes, default and explicit timestamp
- future timestamp rejected, next due calculation, early and overdue completion
- inactive and missing Tenner, invalid user, invalid minutes
- transaction failure, concurrent modification, idempotent retry, repository failure

### Validation Performed

The bundle ran against a fake DynamoDB endpoint that returns real AWS error payloads:
- **With idempotency key:** history `GetItem` (deterministic UUID v5), then Tenner `GetItem`, then one
  `TransactWriteItems` (history put with condition, plus a Tenner update with optimistic lock) → 200, `nextDue` = +14 days.
- **`TransactionCanceledException` `[None, ConditionalCheckFailed]`** → 409 `CONCURRENT_MODIFICATION`. This confirms
  that the SDK delivers `CancellationReasons` as the mapping expects.
- **Deleted Tenner** → 409 `TENNER_INACTIVE`.
- **Missing Tenner** → 404.

"Neither write persists on failure" is a property of `TransactWriteItems`. The tests show that both writes go out
in exactly one transaction call.

### Assumptions

- **IAM:** the ticket asks for `dynamodb:TransactWriteItems`. DynamoDB authorizes transactions per item with the
  item actions (`PutItem`, `UpdateItem`), which TICKET-007 already grants on both tables. I am not aware of a
  separate IAM action called `TransactWriteItems`, so none was added.
  **If the first live completion is denied by IAM, check this assumption first.**
- **Optimistic locking:** besides `updatedAt` (second precision), the condition also checks `lastCompleted`,
  `frequencyDays`, active and not deleted. Two changes within the same second are still detected.
- **Clock skew:** `completedAt` up to 60 seconds in the future is accepted, because client clocks differ.
  Anything later returns 400.
- **Backdating:** `completedAt` earlier than the current `lastCompleted` returns 400. Otherwise `lastCompleted`
  would move backwards. The ticket does not specify this case.
- **Idempotency key scope:** the deterministic ID is based on tenant and key only, not on the Tenner, so reusing a key
  for a different Tenner is detected (409 `IDEMPOTENCY_KEY_REUSED`). A replay returns the original completion and the
  **current** Tenner state.
- `requestHash` is also stored without an idempotency key. It is harmless and keeps the record uniform.
- No CloudWatch alarms or dashboards (Out of Scope). The structured log events cover the metrics later (OBSERVABILITY-003).
