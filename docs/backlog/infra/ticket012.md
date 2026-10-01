# TICKET-012: Implement Delete Tenner API

## Type

Backend Feature

---

## Priority

Medium

---

## Goal

Implement the ability to remove Tenners from active use.

Tenner follows a data-preservation-first philosophy.

Therefore, this ticket implements **soft delete**, not physical deletion.

Deleted Tenners remain available for:

- Historical reporting
- Completion history
- Analytics
- Auditability

The API should make a Tenner inactive and hidden from normal user workflows while preserving historical data.

---

# Background

The following capabilities already exist:

- Create Tenner API
- List Tenners API
- Update Tenner API
- Completion History Infrastructure

Future analytics will depend on historical data integrity.

Physical deletion would destroy relationships between a Tenner and its completion history.

---

# Design Decision

## Soft Delete Only

Deletion must be implemented as:

```text
active = false
deletedAt = timestamp
```

The record remains stored in DynamoDB.

The record is excluded from standard application views.

---

## No Hard Deletes

The following is explicitly forbidden:

```text
DynamoDB DeleteItem
```

except for future administrative maintenance endpoints.

---

# Scope

Implement:

```text
DELETE /tenners/{tennerId}
```

Purpose:

```text
Deactivate an existing Tenner.
```

---

# Endpoint

## Request

```http
DELETE /tenners/{tennerId}
```

Example:

```http
DELETE /tenners/12345
```

---

# Business Rules

## Existing Tenner

When a Tenner exists:

```text
active = false

deletedAt = current_timestamp

updatedAt = current_timestamp
```

---

## Already Deleted

A previously deleted Tenner should be treated as:

```text
Idempotent operation
```

Return success.

Do not return an error.

---

## Completion History

Historical completion data:

```text
must not be modified

must not be removed
```

---

## Future Analytics

Deleted Tenners should still participate in:

```text
Historical Reports

Completion Trends

Activity Metrics
```

unless explicitly filtered.

---

# Data Model Changes

Extend Tenner model:

```text
deletedAt
```

Type:

```text
Date | null
```

Default:

```text
null
```

---

# Persistence

Update:

```text
tenner-tenners
```

table.

No records should be physically removed.

Example:

Before:

```json
{
  "tennerId": "123",
  "active": true,
  "deletedAt": null
}
```

After:

```json
{
  "tennerId": "123",
  "active": false,
  "deletedAt": "2026-10-01T18:00:00Z"
}
```

---

# List API Compatibility

Update default listing behavior.

Default queries:

```http
GET /tenners
```

must return:

```text
active = true
```

records only.

---

## Optional Future Support

The data model should later support:

```http
GET /tenners?includeDeleted=true
```

Implementation not required in this ticket.

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
    "deleted": true
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

# Repository Layer

Implement:

```typescript
delete()
```

Responsibilities:

```text
Load Record

Set Active False

Set Deleted Timestamp

Persist Update
```

No business logic.

No hard deletes.

---

# Service Layer

Implement:

```typescript
deleteTenner()
```

Responsibilities:

```text
Business Validation

Idempotent Handling

Soft Delete Rules
```

---

# DTOs

Create:

```typescript
DeleteTennerResponse
```

---

# Logging

Log:

```text
Tenner Deleted

Tenner ID

Category

Assigned User
```

Do not log:

```text
Secrets

Credentials

Sensitive Internal Data
```

---

# Testing Requirements

Create tests for:

```text
Successful Delete

Delete Missing Tenner

Delete Already Deleted Tenner

Repository Failure

Active Flag Update

DeletedAt Population
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
DELETE /tenners/{tennerId}
```

Create:

```text
DeleteTennerResponse
```

Update:

```text
Tenner Model

Repository Layer

Service Layer

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

- DELETE endpoint implemented
- Soft delete implemented
- Active set to false
- DeletedAt populated
- Completion history preserved
- Idempotent delete behavior implemented
- Not Found handling implemented
- Standard API response returned
- Tests passing

---

# Definition of Done

- Tenners can be deleted safely
- Historical data preserved
- Future analytics supported
- Architecture respected
- Logging operational
- Tests passing
- Deployable through GitHub Actions

---

# Out of Scope

Do not implement:

- Hard Delete
- Completion Workflow
- Dashboard API
- Analytics API
- Authentication
- Restore Endpoint

Restore functionality will be implemented in a future ticket if required.

---

## Implementation Status

Implemented: 2026-10-01.

### Deliverables

- [x] `DELETE /tenners/{tennerId}`: handler `src/handlers/delete-tenner.ts`, route in `src/index.ts` and `local.api_routes`
- [x] `DeleteTennerResponse` (`{ tennerId, deleted: true }`)
- [x] `DeleteTennerService.deleteTenner()` (soft delete rules, idempotency)
- [x] Repository `delete()` (conditional `UpdateItem`, never `DeleteItem`) and `getById()` (consistent read)
- [x] Model extension: `Tenner.deletedAt: string | null` (default `null` on create, also in `TennerResponse`)
- [x] List compatibility: deleted Tenners are always excluded. The `includeDeleted` criterion is prepared for TICKET-015.
- [x] Tests and documentation

### Acceptance Criteria (Ticket Testing Requirements)

- [x] Successful delete → 200 `{ tennerId, deleted: true }`
- [x] Delete a missing Tenner → 404 `NOT_FOUND`
- [x] Delete an already deleted Tenner → 200, unchanged (original `deletedAt` kept)
- [x] Repository failure → `PersistenceError` (500)
- [x] Active flag update (`active = false`)
- [x] `deletedAt` and `updatedAt` populated (same timestamp)
- [x] No physical deletion. The code contains no `DeleteItem`/`DeleteCommand` (checked with grep).
- [x] Completion history is untouched (the history table is not accessed)
- [x] Logging: "Tenner deleted" / "Tenner already deleted" with `tennerId`, `category`, `assignedTo`

Backend: 165 tests, 100% coverage. Terraform: 20 tests.

### Validation Performed

The bundle ran against a fake DynamoDB endpoint that returns real `ConditionalCheckFailedException` responses:
- normal delete → 200
- already deleted → 200 (`UpdateItem` fails its condition, then `GetItem` shows `deletedAt`)
- missing → 404
- `PUT` on a deleted Tenner → 404

This also confirms that the SDK error name is mapped correctly.

### Assumptions

- **Repository signature:** `delete(tenantId, tennerId)` from TICKET-008 became `delete(tenantId, tennerId, timestamp)`
  and returns `{ status: DELETED | ALREADY_DELETED, tenner }`. The service owns the time source, and the outcome is
  needed for idempotent handling and logging.
- **Atomicity:** "load, set, persist" is done as one conditional `UpdateItem`. The follow-up `GetItem` only runs
  when the condition fails, to tell "missing" from "already deleted". If a restore happens between the two calls,
  the result is `409 CONCURRENT_MODIFICATION`.
- **Deleted Tenners on other endpoints:** `GET /tenners` excludes them (also with `active=false`), and `PUT` answers 404.
  Otherwise `PUT {active: true}` would partially "undelete" a Tenner and bypass the restore workflow (TICKET-015).
- The IAM role still allows `DeleteItem` (required by TICKET-007), although it is unused (TD-013).
