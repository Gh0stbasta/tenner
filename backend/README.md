# Tenner Backend

TypeScript code for the `tenner-api` Lambda function (Node.js 22, arm64), behind an
API Gateway HTTP API. Data is stored in DynamoDB (`tenner-tenners`, `tenner-history`).

## Commands

```bash
npm ci
npm run lint        # ESLint (typescript-eslint strict and architecture rules)
npm test            # Vitest with coverage (threshold 80%)
npm run build       # type check + esbuild bundle → dist/index.mjs (minified)
```

Terraform zips `dist/` (`data.archive_file.api`), so `npm run build` must run before
`terraform plan`. The workflows do this automatically.

## Architecture

```text
API Gateway event
      ↓
index.ts            routing by route key, correlation id, error → HTTP mapping
      ↓
handlers/           parse and validate input (validators/), call a service, shape the response (dto/)
      ↓
services/           business rules; depend on repository interfaces only
      ↓
repositories/       persistence contracts (interfaces); DynamoDB implementations translate errors
      ↓
clients/            infrastructure clients (shared DynamoDB DocumentClient)
```

### Layer Responsibilities

| Layer | Folder | Responsibility | Must not |
|---|---|---|---|
| Entry point | `src/index.ts` | route, create request logger, map errors to responses | contain business logic |
| Handlers | `src/handlers/` | HTTP concerns: parse body, validate, call service, build response | access DynamoDB or the AWS SDK (enforced by ESLint) |
| Services | `src/services/` | business rules and workflows | access DynamoDB or the AWS SDK (enforced by ESLint) |
| Repositories | `src/repositories/` | read and write domain objects, translate storage errors to `PersistenceError` | validate input |
| Clients | `src/clients/` | AWS SDK clients | know about domain rules |
| Models | `src/models/` | domain types and enumerations | depend on other layers |
| DTOs | `src/dto/` | API request and response contracts, mappers, response envelope | expose `tenantId` |
| Validators | `src/validators/` | Zod schemas and `validate()`, the only validation entry point | — |
| Exceptions | `src/exceptions/` | `ApplicationError` hierarchy | — |
| Config | `src/config.ts` | the **only** place that reads `process.env` (enforced by ESLint) | — |
| Utils | `src/utils/` | logger, HTTP helpers | — |

### Dependency Flow

`index → handlers → services (interfaces) → repositories (interfaces) → clients`.

Everything may use `models`, `dto`, `exceptions` and `utils`. Wiring happens in `index.ts`
(`createDependencies`), so tests can swap any dependency.

## Domain Model

| Model | Fields |
|---|---|
| `Tenner` | `tenantId`, `tennerId`, `title`, `category`, `estimatedMinutes`, `frequencyDays`, `assignedTo`, `lastCompleted` (UTC timestamp or null), `nextDue` (YYYY-MM-DD), `active`, `createdAt`, `updatedAt` |
| `Completion` | `tenantId`, `completionId` (stored as `historyId`), `tennerId`, `completedBy`, `completedAt`, `actualMinutes` |
| `User` | `userId`, `displayName`, `active` |

| Enumeration | Values |
|---|---|
| `Category` | `HOUSEHOLD`, `FITNESS`, `FAMILY`, `HOME`, `PERSONAL`, `FINANCE` |
| `UserId` | `STEFAN`, `JULIA` (hardcoded until HOUSEHOLD-ADMIN-001, see TD-007) |

## Validation

Zod schemas are in `src/validators/`. The limits are centralized in `LIMITS`:

| Field | Rule |
|---|---|
| `title` | trimmed, 3–100 characters |
| `estimatedMinutes` | integer, 1–480 |
| `frequencyDays` | integer, 1–3650 |
| `actualMinutes` | integer, 1–1440 |
| `completedAt` | ISO 8601 UTC timestamp (`Z`, no offset) |
| `category`, `assignedTo`, `completedBy` | enumeration values |

Unknown fields are rejected (`strictObject`). An update must contain at least one field.
`validate()` throws a `ValidationError` with per-field `details`.

### GET /tenners

| Parameter | Values | Meaning |
|---|---|---|
| `assignedTo` | `STEFAN`, `JULIA` | assigned user |
| `category` | category values | category |
| `active` | `true` (default), `false` | active or inactive Tenners |
| `due` | `true`, `false` | `true`: `nextDue <= today` (UTC). `false` does not filter |
| `overdue` | `true`, `false` | `true`: `nextDue < today` (wins over `due`). `false` does not filter |
| `sort` | `nextDue` (default), `title`, `createdAt`, `updatedAt` | sort field (ties broken by title, then ID) |
| `order` | `asc` (default), `desc` | sort direction |

Unknown parameters are rejected. There is no pagination (the household volume is small).

The repository always issues a Query on the tenant partition, never a Scan, and reads all result pages:

| Criteria | Query target |
|---|---|
| `assignedTo` given | `assignedTo-index` |
| `due` or `overdue` | `nextDue-index` |
| neither | base table |

Remaining criteria are applied as a `FilterExpression`. Sorting happens in the service.

### PUT /tenners/{tennerId}

This is a partial update. Allowed fields: `title`, `category`, `estimatedMinutes`, `frequencyDays`, `assignedTo`
and `active`. At least one field is required, and the same validation rules as on create apply.

The protected fields `tenantId`, `tennerId`, `createdAt`, `lastCompleted` and `nextDue` are rejected with 400.
`updatedAt` is refreshed. Changing `frequencyDays` does **not** change `nextDue` or `lastCompleted`.

The repository uses one `UpdateItem` that sets only the provided fields plus `updatedAt`, with the condition
`attribute_exists(tennerId)` (missing → 404) and `ReturnValues: ALL_NEW`. Attributes that were not sent, such as
a `nextDue` written by a concurrent completion, are never overwritten.

### DELETE /tenners/{tennerId}

This is a **soft delete only**. The item and its completion history stay in DynamoDB, and `DeleteItem` is never used.

| State | Result |
|---|---|
| exists, not deleted | `active = false`, `deletedAt = updatedAt = now` (one conditional `UpdateItem`) → 200 |
| already deleted | unchanged (original `deletedAt` kept) → 200 (idempotent) |
| missing | 404 `NOT_FOUND` |

Effects on other endpoints:
- `GET /tenners` always excludes deleted Tenners. The repository has an `includeDeleted` criterion for TICKET-015.
- `PUT` on a deleted Tenner returns 404. Use the restore endpoint (TICKET-015) instead.

`Tenner.deletedAt` (UTC timestamp or `null`) is part of the model and of `TennerResponse`.

### POST /tenners/{tennerId}/complete

```json
{ "completedBy": "STEFAN", "actualMinutes": 12, "completedAt": "2026-10-01T18:30:00Z" }
```

| Field | Rule |
|---|---|
| `completedBy` | required, `STEFAN` or `JULIA` (may differ from `assignedTo`) |
| `actualMinutes` | optional, 1–1440. Default: the Tenner's `estimatedMinutes` |
| `completedAt` | optional UTC timestamp. Default: now. It must not be in the future (60 s clock-skew tolerance) or earlier than `lastCompleted` |

**Recurrence (completion-based):** `nextDue = UTC date(completedAt) + frequencyDays` for early, on-time and overdue
completions alike. `lastCompleted = completedAt` and `updatedAt = now`.

**Atomicity:** a single `TransactWriteItems`:
1. Put the history record into `tenner-history`, with `historyId` = `completionId` and the condition
   `attribute_not_exists(historyId)`.
2. Update the Tenner's `lastCompleted`, `nextDue` and `updatedAt`, on condition that the Tenner still matches
   the loaded state: `updatedAt`, `lastCompleted`, `frequencyDays`, active and not deleted. Otherwise the result is
   `409 CONCURRENT_MODIFICATION` and nothing is written.

**Idempotency:** this is optional and uses the `Idempotency-Key` header (1–128 characters `[A-Za-z0-9._:-]`).
- The completion ID becomes `uuidV5("<tenantId>:<key>")`. The key and a hash of the request are stored on the
  history record.
- A retry with the same key and the same request returns the original completion and the current Tenner
  (no new record).
- The same key with a different Tenner or a different body returns `409 IDEMPOTENCY_KEY_REUSED`.
- Concurrent retries are resolved through the transaction's history condition.

**Logs (structured, for later metrics):** "Tenner completion requested", then "Tenner completion succeeded"
(`event: CompletionSucceeded`, `completionId`, `completedBy`, `actualMinutes`, `nextDue`, `replayed`, `durationMs`)
or "Tenner completion failed" (`event: CompletionFailed` or `CompletionConflict`, `errorCode`, `durationMs`).

### POST /tenners/{tennerId}/undo-completion

```json
{ "revertedBy": "STEFAN", "reason": "Completed by mistake" }
```

`revertedBy` is required. `reason` is optional, trimmed, 1–250 characters, and whitespace-only is rejected.

**Reverted completion model:** completions are never deleted. Undo sets `revertedAt`, `revertedBy` and
`revertReason`, which are `null` for new completions. The original fields stay unchanged.

**Selection:** only the latest **non-reverted** completion can be undone. It is found with the GSI
`tennerId-completedAt-index` (partition `tenantTennerId = "<tenantId>#<tennerId>"`, sort `completedAt`, read
newest first). A filter skips reverted completions, and pages are read until enough matches are found.
There is no Scan. If no active completion exists, the result is `409 NO_COMPLETION_TO_UNDO`.

**State restoration** always uses the Tenner's **current** `frequencyDays`:

| Case | `lastCompleted` | `nextDue` |
|---|---|---|
| A previous active completion exists | its `completedAt` | UTC date(`completedAt`) + `frequencyDays` (may be in the past) |
| The first completion was reverted | `null` | `createdAt` date (fallback: today) |

`updatedAt` is set to now in both cases.

**Atomicity and concurrency:** a single `TransactWriteItems`:
1. Mark the completion as reverted. Condition: it exists and is not reverted yet.
2. Restore the Tenner. Condition: it still matches the loaded `updatedAt`, `lastCompleted`, `frequencyDays`,
   is active and not deleted.

If either condition fails, the result is `409 CONCURRENT_MODIFICATION` and nothing is written.

**Idempotency:** the optional `Idempotency-Key` is stored on the reverted record as `revertIdempotencyKey`, together
with `revertRequestHash`. A retry finds it in the Tenner's history (via the same GSI) and returns the original
result without reverting another completion. Reusing the key with a different request returns
`409 IDEMPOTENCY_KEY_REUSED`. Undo keys are scoped to the Tenner.

**Logs:** "Undo completion requested", then "Undo completion succeeded" (`UndoSucceeded`, `completionId`,
`revertedBy`, `restoredPrevious`, `restoredNextDue`, `durationMs`) or "Undo completion failed"
(`UndoNoCompletion` / `UndoConflict` / `UndoFailed`, `errorCode`, `durationMs`).

## Errors and Responses

| Error | HTTP | Code |
|---|---|---|
| `ValidationError` | 400 | `VALIDATION_ERROR` (with `details`) |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT`, or a specific code such as `TENNER_INACTIVE` or `CONCURRENT_MODIFICATION` |
| `PersistenceError` | 500 | `PERSISTENCE_ERROR` (generic message; the cause is only logged) |
| anything else | 500 | `INTERNAL_ERROR` (no internal details) |

```json
{ "success": true, "data": { } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Validation failed.", "details": [ ] } }
```

## Logging

`src/utils/logger.ts` writes JSON lines with level filtering (`LOG_LEVEL`). Every request gets a child
logger bound to a `correlationId`. The ID comes from the `x-correlation-id` header if it is safe, otherwise
from the API Gateway request ID. The ID is also returned in the response header.
Errors are logged with name, message and code only.

## Testing

Tests use Vitest. Shared test doubles are in `tests/mocks/`: config, logger, repository and service mocks,
and a Tenner fixture.

## Endpoints

| Route | Response |
|---|---|
| `GET /health` | `200 {"status":"ok","application":"tenner","environment":"prod","database":"connected"}`. Returns `503` with `"status":"error"` and `database` `unreachable` or `misconfigured` |
| `POST /tenners` | `201 { success: true, data: TennerResponse }` (TICKET-009). Returns `400 VALIDATION_ERROR` with `details`, `409 CONFLICT` if the ID exists, `500 PERSISTENCE_ERROR` |
| `GET /tenners` | `200 { success: true, data: TennerResponse[] }` (TICKET-010). Returns `400 VALIDATION_ERROR` for invalid parameters |
| `PUT /tenners/{tennerId}` | `200 { success: true, data: TennerResponse }` (TICKET-011). Returns `400 VALIDATION_ERROR` or `404 NOT_FOUND` |
| `DELETE /tenners/{tennerId}` | `200 { success: true, data: { tennerId, deleted: true } }` (TICKET-012, soft delete, idempotent). Returns `404 NOT_FOUND` |
| `POST /tenners/{tennerId}/complete` | `200 { success: true, data: { tenner, completion } }` (TICKET-013). Returns `400`, `404`, or `409` with `TENNER_INACTIVE`, `CONCURRENT_MODIFICATION` or `IDEMPOTENCY_KEY_REUSED` |
| `POST /tenners/{tennerId}/undo-completion` | `200 { success: true, data: { tenner, revertedCompletion } }` (TICKET-014). Returns `400`, `404`, or `409` with `TENNER_INACTIVE`, `NO_COMPLETION_TO_UNDO`, `CONCURRENT_MODIFICATION` or `IDEMPOTENCY_KEY_REUSED` |
| unknown route | `404 NOT_FOUND` |

### POST /tenners

Request (all fields required, unknown fields rejected):

```json
{ "title": "Vacuum Office", "category": "HOUSEHOLD", "estimatedMinutes": 10, "frequencyDays": 14, "assignedTo": "STEFAN" }
```

The service generates `tennerId` (UUID v4), `tenantId` (from configuration), `active = true`,
`lastCompleted = null`, `nextDue` = today (UTC date) and `createdAt` = `updatedAt` = now (UTC, seconds precision).
The repository writes with `attribute_not_exists(tennerId)`, so it never overwrites an existing item.

## Dependencies

- Runtime: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb` and `zod`. All are bundled and pinned.
- The logger is a small built-in module instead of `pino`. It has no dependency and covers JSON output,
  levels and correlation.
