# Tenner Backend

TypeScript code for the `tenner-api` Lambda function (Node.js 22, arm64), behind an
API Gateway HTTP API. Data is stored in DynamoDB (`tenner-tenners`, `tenner-history`, `tenner-households`).

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
| Entry point | `src/index.ts` | route, resolve the identity on protected routes, create request logger, map errors to responses | contain business logic |
| Auth | `src/auth/` | `identityFromEvent`: tenant and acting user from the verified JWT claims (SECURITY-004) | read identity from body, headers or query |
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

## Authentication and Authorization (SECURITY-004, FUTURE-011)

API Gateway's JWT authorizer verifies the Cognito ID token before the Lambda runs (SECURITY-002). `src/index.ts`
then builds the identity once per request with `identityFromEvent` (`src/auth/identity.ts`) from the household
group in the `cognito:groups` claim (users sign in with Google; ADR 0002):

| Claim | Becomes | Rule |
|---|---|---|
| `cognito:groups` contains `household:<tenantId>:<userId>` | `identity.tenantId` (used for **every** repository call) and `identity.userId` (the acting user) | exactly one such group; tenant `[A-Za-z0-9_-]{1,64}`, user `STEFAN` or `JULIA` |

The HTTP API passes the array claim as one string (`"[group1 group2]"`); `groupsOf` accepts that and real arrays.
Other groups (e.g. Cognito's `<pool>_Google`) are ignored.

| Situation | Response |
|---|---|
| Protected route without verified claims (no authorizer context) | `401 UNAUTHORIZED` |
| Signed in, but no household group, several, or an invalid one | `403 FORBIDDEN` |
| `GET /health` | public, no identity |

- There is **no default tenant** and no tenant parameter. A `tenantId` in the query or body is rejected with 400
  (strict schemas); headers are ignored.
- Read handlers receive `identity.tenantId`; write handlers and services receive the whole identity.
- The request logger is bound to `userId` (no e-mail addresses or tokens are logged) and to `client`
  (`alexa` when the token's `client_id` is `ALEXA_CLIENT_ID`, else `web`; ALEXA-002).
- Access tokens (Alexa account linking, ALEXA-002) work like ID tokens: the household comes from `cognito:groups`;
  the principal reads `cognito:username` or, in access tokens, `username`.
- Tests build authenticated events with `authenticatedEvent()` and `jwtClaims()` from `tests/mocks`.

### First-login self-assignment (HOTFIX-001)

Two routes need a verified token but **no** household group; they use `principalFromEvent`
(`cognito:username`, 401 if missing):

| Route | Response |
|---|---|
| `GET /onboarding` | `200 { assignedTo: UserId \| null, members: [{ userId, displayName, available }] }`, live from Cognito |
| `POST /onboarding/assignment` `{ "userId": "STEFAN" }` | `201 { userId }`; `409 ALREADY_ASSIGNED` (account has a member), `409 MEMBER_TAKEN` (member has an account), `400` for unknown users or extra fields, `503` if not configured |

`HouseholdAssignmentService` stores membership as the Cognito group `household:<tenantId>:<userId>` through
`HouseholdMembershipRepository` (`repositories/cognito/`, AWS SDK `client-cognito-identity-provider`). Each
member can be claimed by one account; after adding, the group is counted again and the account withdraws if a
concurrent claim won. Configuration: `COGNITO_USER_POOL_ID` and `HOUSEHOLD_TENANT_ID` (both set by Terraform).
The assignment is logged as `HouseholdMemberAssigned` with the Cognito username, never the e-mail.

## Domain Model

| Model | Fields |
|---|---|
| `Tenner` | `tenantId`, `tennerId`, `title`, `category`, `estimatedMinutes`, `frequencyDays`, `frequencyUnit`, `frequencyInterval`, `weekdays`, `assignedTo`, `lastCompleted` (UTC timestamp or null), `nextDue` (YYYY-MM-DD), `snoozedUntil` (YYYY-MM-DD or null, SCHEDULING-003), `pausedAt`, `pausedUntil` (SCHEDULING-005), `active`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy` |
| `Completion` | `tenantId`, `completionId` (stored as `historyId`), `tennerId`, `completedBy`, `recordedBy`, `completedAt`, `actualMinutes` |

`createdBy`, `updatedBy` and `recordedBy` are set from the authenticated user (SECURITY-004). Records written before
authentication have `null` there.
| `HouseholdCategory` | `categoryId`, `name`, `icon`, `color`, `sortOrder`, `archived`, `createdAt`, `updatedAt` (HOUSEHOLD-ADMIN-002, stored in `tenner-households`); creating or re-categorizing a Tenner needs a non-archived category (400) |
| `HouseholdMember` | `userId`, `displayName`, `color`, `active`, `createdAt`, `updatedAt` (HOUSEHOLD-ADMIN-001, stored in `tenner-households`) |

| Enumeration | Values |
|---|---|
| `Category` | managed category IDs, format `^[A-Z][A-Z0-9_]{0,29}$`; seed `HOUSEHOLD`, `FITNESS`, `FAMILY`, `HOME`, `PERSONAL`, `FINANCE` (HOUSEHOLD-ADMIN-002) |
| `CategoryIcon` | `HOME`, `CLEANING`, `FITNESS`, `FAMILY`, `PERSON`, `MONEY`, `GARDEN`, `PET`, `CAR`, `HEALTH`, `WORK`, `STAR` |
| `UserId` | managed member IDs, format `^[A-Z][A-Z0-9_]{0,29}$`; seed members `STEFAN`, `JULIA`. `assignedTo` may also be `HOUSEHOLD` (shared, HOUSEHOLD-002), which is reserved |
| `MemberColor` | `BLUE`, `GREEN`, `ORANGE`, `PURPLE`, `RED`, `TEAL`, `PINK`, `GREY` |

## Validation

Zod schemas are in `src/validators/`. The limits are centralized in `LIMITS`:

| Field | Rule |
|---|---|
| `title` | trimmed, 3–100 characters |
| `estimatedMinutes` | integer, 1–480 |
| `frequencyDays` | integer, 1–3650. Alone it means unit `DAY` with that interval |
| `frequencyUnit` | `DAY`, `WEEK`, `MONTH`, `YEAR` (SCHEDULING-001) |
| `frequencyInterval` | integer ≥ 1, default 1; only with `frequencyUnit`; at most 3650 approximate days (e.g. 10 years) |
| `assignmentMode`, `rotation` | HOUSEHOLD-001: `FIXED` (default, `rotation` null) or `ROTATING` with `rotation` = ordered list of ≥ 2 distinct active members containing `assignedTo`; `rotation` without `ROTATING` → 400. Completion advances `assignedTo` to the next active member; undo restores it. Responses also carry `originalAssignee` (HOUSEHOLD-004: member a Tenner is covered for, else null; cleared by any `assignedTo` update) |
| `weekdays` | `null` or 1–7 distinct values of `MON`..`SUN` (SCHEDULING-002); only with `frequencyUnit: "WEEK"` in the same request. Normalized to ISO order |

Send either `frequencyDays` or `frequencyUnit` (+ `frequencyInterval`), not both (400 otherwise). The validator
normalizes every request to all three fields; for `MONTH`/`YEAR`, `frequencyDays` is an approximation (30/365 per
unit) for analytics only. Due dates come from `calculateNextDue` (`src/utils/schedule.ts`): months and years keep
the calendar day and clamp to the month end (31 Jan + 1 month → 28/29 Feb). With `weekdays`, the next due date is
the first listed weekday after `completed date + (interval − 1) weeks` (every Saturday, completed Monday → that
Saturday); `frequencyDays` is then the average gap.
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
| `active` | `true` (default), `false` | active or inactive Tenners. No default together with `deleted=true` |
| `deleted` | `true`, `false` | `true`: only soft-deleted (archived) Tenners (TICKET-024). Default: deleted Tenners are excluded |
| `due` | `true`, `false` | `true`: `nextDue <= today` (household timezone, SCHEDULING-008). `false` does not filter |
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

This is a partial update. Allowed fields: `title`, `category`, `estimatedMinutes`, `frequencyDays` or `frequencyUnit` + `frequencyInterval`, `assignedTo`
and `active`. At least one field is required, and the same validation rules as on create apply.

The protected fields `tenantId`, `tennerId`, `createdAt`, `lastCompleted` and `nextDue` are rejected with 400.
`updatedAt` and `updatedBy` are refreshed. Changing the frequency does **not** change `nextDue` or `lastCompleted`.

The repository uses one `UpdateItem` that sets only the provided fields plus `updatedAt`, with the condition
`attribute_exists(tennerId)` (missing → 404) and `ReturnValues: ALL_NEW`. Attributes that were not sent, such as
a `nextDue` written by a concurrent completion, are never overwritten.

### DELETE /tenners/{tennerId}

This is a **soft delete only**. The item and its completion history stay in DynamoDB, and `DeleteItem` is never used.

| State | Result |
|---|---|
| exists, not deleted | `active = false`, `deletedAt = updatedAt = now`, `updatedBy` = authenticated user (one conditional `UpdateItem`) → 200 |
| already deleted | unchanged (original `deletedAt` kept) → 200 (idempotent) |
| missing | 404 `NOT_FOUND` |

Effects on other endpoints:
- `GET /tenners` excludes deleted Tenners unless `deleted=true` is set; then it returns only deleted Tenners (archive view, TICKET-024).
- `PUT` on a deleted Tenner returns 404. Use the restore endpoint (TICKET-015) instead.

`Tenner.deletedAt` (UTC timestamp or `null`) is part of the model and of `TennerResponse`.

### POST /tenners/{tennerId}/complete

```json
{ "completedBy": "STEFAN", "actualMinutes": 12, "completedAt": "2026-10-01T18:30:00Z" }
```

| Field | Rule |
|---|---|
| `completedBy` | optional, `STEFAN` or `JULIA`. Default: the authenticated user. Another member is allowed (covering for someone); the record then also stores `recordedBy` = authenticated user |
| `actualMinutes` | optional, 1–1440. Default: the Tenner's `estimatedMinutes` |
| `completedAt` | optional UTC timestamp. Default: now. It must not be in the future (60 s clock-skew tolerance) or earlier than `lastCompleted` |

**Recurrence (completion-based):** `nextDue = calculateNextDue(local date(completedAt), frequencyUnit, frequencyInterval)` (household timezone, SCHEDULING-001/008) for early, on-time and overdue
completions alike. `lastCompleted = completedAt`, `updatedAt = now` and `updatedBy` = authenticated user.

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

`revertedBy` is optional and defaults to the authenticated user; another user returns `403 FORBIDDEN`. The body may
be `{}`. `reason` is optional, trimmed, 1–250 characters, and whitespace-only is rejected.

**Reverted completion model:** completions are never deleted. Undo sets `revertedAt`, `revertedBy` and
`revertReason`, which are `null` for new completions. The original fields stay unchanged.

**Selection:** only the latest **non-reverted** completion can be undone. It is found with the GSI
`tennerId-completedAt-index` (partition `tenantTennerId = "<tenantId>#<tennerId>"`, sort `completedAt`, read
newest first). A filter skips reverted completions, and pages are read until enough matches are found.
There is no Scan. If no active completion exists, the result is `409 NO_COMPLETION_TO_UNDO`.

**State restoration** always uses the Tenner's **current** frequency:

| Case | `lastCompleted` | `nextDue` |
|---|---|---|
| A previous active completion exists | its `completedAt` | `calculateNextDue`(local date(`completedAt`), unit, interval) (may be in the past) |
| The first completion was reverted | `null` | local `createdAt` date (fallback: today) |

`updatedAt` is set to now and `updatedBy` to the authenticated user in both cases.

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

### POST /tenners/{tennerId}/snooze

Postpones a Tenner without completing it (SCHEDULING-003). Body: exactly one of

| Field | Rule |
|---|---|
| `until` | `YYYY-MM-DD`, a real calendar date |
| `days` | integer 1–3650, counted from today in the household timezone |

Rules (400 `VALIDATION_ERROR` with the field otherwise): the date must be after today and after the current
`nextDue`, and not later than one frequency interval or 30 days from today, whichever is later. Inactive or archived
Tenners → 409 `TENNER_INACTIVE`; unknown → 404; a concurrent change → 409 `CONCURRENT_MODIFICATION`.

Effect: `nextDue = snoozedUntil = <date>`, `updatedAt`/`updatedBy` refreshed, plus an audit event in `tenner-history`
(`eventType: "SNOOZE"`, `historyId: "snooze#<id>"`, `previousNextDue`, `snoozedUntil`, `snoozedBy`, `snoozedAt`)
in one transaction. Snooze events have no `completedAt`, so history, undo and analytics never see them.
The next completion sets `snoozedUntil` back to `null`. Logged as `TennerSnoozed`.

Response: `200 { success: true, data: { tenner: TennerResponse, snooze: { snoozeId, snoozedBy, snoozedAt, previousNextDue, snoozedUntil } } }`.

### POST /tenners/{tennerId}/skip

Skips one occurrence without completing it (SCHEDULING-004). Body optional: `{ "reason": "Not needed this week" }`
(trimmed, 1–200 characters; unknown fields rejected). An empty body is allowed.

Effect: `nextDue = calculateNextDue(max(today, nextDue), frequencyUnit, frequencyInterval, weekdays)` (so a Tenner
that is not due yet moves one cycle past its due date), `lastCompleted` unchanged, `snoozedUntil = null`, plus a
`SKIP` event in `tenner-history` (`historyId: "skip#<id>"`, `skippedDue`, `nextDue`, `reason`, `skippedBy`,
`skippedAt`) in one transaction. Skips never appear in history, undo or analytics. Inactive or archived → 409
`TENNER_INACTIVE`; unknown → 404; concurrent change → 409 `CONCURRENT_MODIFICATION`. Logged as `TennerSkipped`
(without the reason text).

Response: `200 { success: true, data: { tenner: TennerResponse, skip: { skipId, skippedBy, skippedAt, skippedDue, nextDue, reason } } }`.

### POST /tenners/{tennerId}/restore

```json
{ "restoredBy": "STEFAN" }
```

`restoredBy` is optional (the body may be `{}`) and defaults to the authenticated user; another user returns
`403 FORBIDDEN`. The restore sets `updatedBy` = authenticated user.

| State | Result |
|---|---|
| deleted (`deletedAt` set) | one `UpdateItem`: `active = true`, `deletedAt = null`, `updatedAt = now`, condition `updatedAt` = loaded value → 200 |
| already active | no write → 200 (idempotent) |
| inactive but not deleted (deactivated via PUT) | 409 `TENNER_NOT_DELETED` (reactivate with `PUT {"active": true}`) |
| missing | 404 |
| lock conflict | 409 `CONCURRENT_MODIFICATION`, unless a parallel restore already succeeded (→ 200) |

`lastCompleted` and `nextDue` are never changed. A past `nextDue` simply makes the Tenner overdue again.
`tenner-history` is not touched.

### GET /dashboard

This is the dashboard read model: one request, two DynamoDB Queries (the `nextDue-index` window and, since
SCHEDULING-005, the tenant's active Tenners for the `paused` section). Paused Tenners (individual pause or household
vacation) are excluded from all sections and summaries and listed in `paused` with `pausedUntil` (null = open-ended)
and `pauseReason` (`PAUSE` or `VACATION`).

| Parameter | Values |
|---|---|
| `assignedTo` | `STEFAN`, `JULIA`. Filters all sections |
| `category` | category values. Filters all sections |
| `date` | `YYYY-MM-DD`, a real calendar date (`2026-02-30` → 400). Default: today in the household timezone. Future dates are allowed |

**Household timezone (SCHEDULING-008):** stored per household (`GET`/`PUT /household`); without a stored value
`APPLICATION_TIMEZONE` applies (default `Europe/Berlin`, invalid values fall back to the default). The response
includes `timezone`. Dates are computed with `Intl`, independent of the Lambda runtime timezone.

**Classification** (`nextDue` as `YYYY-MM-DD`; inactive and deleted Tenners excluded):

| Section | Rule | Sort |
|---|---|---|
| `dueToday` | `nextDue = referenceDate` | `estimatedMinutes` asc, `title` asc |
| `overdue` | `nextDue < referenceDate`, with `overdueDays` | `nextDue` asc (longest overdue first), `title` asc |
| `upcoming` | `referenceDate < nextDue <= referenceDate + 7`, with `daysUntilDue` | `nextDue` asc, `estimatedMinutes` asc, `title` asc |

**Summary:** count and minutes per section. **Actionable** means due today plus overdue; upcoming is informational
and not part of `totalActionableCount` or `totalActionableMinutes`. `byUser` and `byCategory` contain actionable
Tenners only, and groups without any are omitted.

**DynamoDB access:** one Query on `nextDue-index` (`tenantId`, `nextDue <= referenceDate + 7`). The `active = true`
and not-deleted conditions are a `FilterExpression`. The filtered items still cost read capacity, which is
negligible at household volume. The user and category filters and the classification run in the service.
There is no Scan and no query per section or per Tenner.

**Logs:** "Dashboard requested" (`DashboardServed`, `referenceDate`, filters, counts, `totalActionableMinutes`,
`durationMs`) or "Dashboard failed" (`DashboardFailed`, `errorCode`, `durationMs`).

### Completion History (read-only)

`GET /history` returns household history, newest first:

| Parameter | Values |
|---|---|
| `from`, `to` | `YYYY-MM-DD`, inclusive UTC days (`from <= to`) |
| `completedBy` | `STEFAN`, `JULIA` |
| `limit` | 1–100, default 20 |
| `cursor` | the `nextCursor` value of the previous page |
| `includeUndone` | `true` includes reverted completions (default `false`) |

`GET /tenners/{tennerId}/history` returns the history of one Tenner, newest first. It accepts `limit`, `cursor`
and `includeUndone`. It also works for deleted Tenners and returns 404 if the Tenner never existed.

Each item contains `completionId`, `tennerId`, `tennerTitle` (`null` if the Tenner record no longer exists),
`completedBy`, `completedAt`, `actualMinutes` and `revertedAt`.

**Access pattern:**
- Queries only, no Scan: `completedAt-index` for the household, `tennerId-completedAt-index` per Tenner.
- The date range is part of the key condition (`BETWEEN`). `completedBy` and undone completions are filter
  expressions.
- Because filters apply after DynamoDB's `Limit`, the repository pages until `limit` matches are found
  (at most 20 DynamoDB pages per request).
- Titles come from one `BatchGetItem` per 100 Tenners, projecting `tennerId` and `title` only. Unprocessed keys are
  retried up to 3 times.

**Cursor:** base64url JSON with the tenant and the key of the last returned item. A cursor for another tenant,
or a tampered cursor, returns 400.

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
| `POST /tenners` | `201 { success: true, data: TennerResponse }` (TICKET-009). Optional `startDate` (YYYY-MM-DD, HOTFIX-006, default today): first due on that day, not on the dashboard before; a past date means due today. Returns `400 VALIDATION_ERROR` with `details`, `409 CONFLICT` if the ID exists, `500 PERSISTENCE_ERROR` |
| `GET /tenners` | `200 { success: true, data: TennerResponse[] }` (TICKET-010). `assignedTo=<member>` also returns shared Tenners (`HOUSEHOLD`, HOUSEHOLD-002). Returns `400 VALIDATION_ERROR` for invalid parameters |
| `GET /tenners/{tennerId}` | `200 { success: true, data: TennerResponse }` (TICKET-019). Soft-deleted Tenners → `404` unless `?includeDeleted=true`. Returns `400` for an invalid id or query |
| `PUT /tenners/{tennerId}` | `200 { success: true, data: TennerResponse }` (TICKET-011). `startDate` (HOTFIX-006): from today on it also moves `nextDue` to it; a past date is only stored. Responses always carry `startDate` (creation date for Tenners created before). Returns `400 VALIDATION_ERROR` or `404 NOT_FOUND` |
| `DELETE /tenners/{tennerId}` | `200 { success: true, data: { tennerId, deleted: true } }` (TICKET-012, soft delete, idempotent). Returns `404 NOT_FOUND` |
| `POST /tenners/{tennerId}/complete` | `200 { success: true, data: { tenner, completion } }` (TICKET-013). Returns `400`, `404`, or `409` with `TENNER_INACTIVE`, `CONCURRENT_MODIFICATION` or `IDEMPOTENCY_KEY_REUSED` |
| `POST /tenners/{tennerId}/undo-completion` | `200 { success: true, data: { tenner, revertedCompletion } }` (TICKET-014). Returns `400`, `404`, or `409` with `TENNER_INACTIVE`, `NO_COMPLETION_TO_UNDO`, `CONCURRENT_MODIFICATION` or `IDEMPOTENCY_KEY_REUSED` |
| `POST /tenners/{tennerId}/snooze` | `200 { success: true, data: { tenner, snooze } }` (SCHEDULING-003). Returns `400`, `404`, or `409` with `TENNER_INACTIVE` or `CONCURRENT_MODIFICATION` |
| `POST /tenners/{tennerId}/skip` | `200 { success: true, data: { tenner, skip } }` (SCHEDULING-004). Returns `400`, `404`, or `409` with `TENNER_INACTIVE` or `CONCURRENT_MODIFICATION` |
| `POST /tenners/{tennerId}/restore` | `200 { success: true, data: { tennerId, active, deletedAt } }` (TICKET-015, idempotent). Returns `400`, `404`, or `409` with `TENNER_NOT_DELETED` or `CONCURRENT_MODIFICATION` |
| `GET /dashboard` | `200 { success: true, data: DashboardResponse }` (TICKET-016). Returns `400 VALIDATION_ERROR` "Invalid dashboard query." |
| `GET /users` | `200 { success: true, data: MemberResponse[] }` with `userId`, `displayName`, `color`, `active` (HOUSEHOLD-ADMIN-001). Seed members until the household saves its own list |
| `POST /users` | Body `{ "displayName": "Lena", "color": "GREEN", "userId"?: "LENA", "canSignIn"?: false }` → `201 MemberResponse` (incl. `canSignIn`). `userId` defaults to a slug of the name. `canSignIn: false` (HOUSEHOLD-ADMIN-006, immutable) creates a member without an account: it can be assigned Tenners but is never offered or claimable on the first login. 400 invalid fields, 409 `MEMBER_EXISTS`, 409 `CONCURRENT_MODIFICATION`; at most 20 members. Logged as `MemberCreated` |
| `PUT /users/{userId}` | Body `{ "displayName"?, "color"? }` (at least one; `userId` immutable) → `200 MemberResponse`. 404 for unknown members. Logged as `MemberUpdated` |
| `POST /users/{userId}/deactivate` | Body optional `{ "reassignTo": "JULIA" }` → `200 { success: true, data: { member, reassigned, reassignedTo, revokedAccounts } }` (HOUSEHOLD-ADMIN-004). `reassignTo` is required (400) if Tenners are assigned and must be another active member. 409 `CANNOT_DEACTIVATE_SELF`, `LAST_ACTIVE_MEMBER`, `MEMBER_INACTIVE`; 404 unknown. Removes all accounts from the member's Cognito group. Logged as `MemberDeactivated` |
| `POST /users/{userId}/reactivate` | `200 MemberResponse`; 409 `MEMBER_ACTIVE` if already active. Logged as `MemberReactivated` |
| `POST /users/{userId}/handover` | Body `{ "to": "JULIA", "until": "YYYY-MM-DD", "categories"?: [...] }` → `201 { success: true, data: { handover: { from, to, until, categories }, handedOver } }` (HOUSEHOLD-004). Moves the member's non-archived Tenners (of the categories, default all) to `to` with `originalAssignee` = member. 400: `to` not another active member or away itself, `until` in the past, unknown, empty or duplicate categories; 404 unknown member; 409 `MEMBER_INACTIVE`, `HANDOVER_ACTIVE`, `CONCURRENT_MODIFICATION`. Logged as `HandoverStarted` |
| `DELETE /users/{userId}/handover` | `200 { success: true, data: { returned } }`: gives the Tenners back now; 404 without a handover. Logged as `HandoverEnded`. Expired handovers are given back on the next `GET /dashboard`, `GET /tenners` or `GET /household` (logged as `HandoverExpired`) |
| `GET /categories` | `200 { success: true, data: CategoryResponse[] }` with `categoryId`, `name`, `icon`, `color`, `sortOrder`, `archived`, in display order (HOUSEHOLD-ADMIN-002). Seed categories until the household saves its own list |
| `POST /categories` | Body `{ "name": "Garten", "icon": "GARDEN", "color": "GREEN", "categoryId"?: "GARDEN" }` → `201 CategoryResponse` (appended). 400 invalid fields, 409 `CATEGORY_EXISTS` or `CONCURRENT_MODIFICATION`; at most 30 categories. Logged as `CategoryCreated` |
| `PUT /categories/{categoryId}` | Body `{ "name"?, "icon"?, "color"?, "sortOrder"? (new 0-based position), "archived"? }` (at least one) → `200 CategoryResponse`. 404 for unknown categories. Logged as `CategoryUpdated` |
| `GET /household` | `200 { success: true, data: { name, timezone, weekStartsOn, workdays, defaults, defaultsSource, vacation, handovers } }` (SCHEDULING-008/005, HOUSEHOLD-ADMIN-003). Effective values: defaults `Unser Haushalt`, `APPLICATION_TIMEZONE`, `MONDAY`, Monday–Friday, `{ HOUSEHOLD, 10, 14 }`; `defaultsSource` is `DEFAULT` until the household saves its own defaults; `vacation` is `{ from, until, categories }` or null; `handovers` lists running handovers (HOUSEHOLD-004) |
| `GET /users/{userId}/notification-preferences` | `200 { success: true, data: { preferences, channels: [{ type, connected }], effectiveTimezone } }` (NOTIFICATION-002). Only the member themselves (403 otherwise, 404 unknown member); defaults when never saved: daily digest 08:00, overdue alerts from 2 days at 18:00 (`overdueAlerts.time`, NOTIFICATION-010; stored preferences without it read 18:00), weekly summary off (Sunday 18:00), quiet hours 21:30–07:00, `mealToday` (FOOD-016) on at 07:30, no channels |
| `PUT /users/{userId}/notification-preferences` | Body = the full `preferences` object (`timezone` IANA or null, times `HH:mm` in 15-minute steps, `minDaysOverdue` 0–30, `dayOfWeek` MON–SUN, channels `ALEXA` only (other channels dropped, CLEANUP-001) and connected only, `quietHours` or null, `mealToday { enabled, time, channels }` (FOOD-016, optional for older clients, default on at 07:30); unknown fields → 400) → `200` as GET. Stored per member on the household item (`notificationPreferences`, optimistic locking). Logged as `NotificationPreferencesChanged` without addresses |
| `GET /household/alexa` | `200 { success: true, data: { account: { userId }, timezone, members: [{ userId, displayName }], speakers: [{ personId, userId }] } }` (ALEXA-002): the caller's member, active members and Alexa speaker mappings (mappings to deactivated members hidden). Used by the skill at session start and by Settings → Alexa |
| `PUT /household/alexa-speakers/{personId}` | Body `{ "userId": "JULIA" }` → `200` with the same body as `GET /household/alexa` (ALEXA-002). `personId` must be an Amazon person ID (`amzn1.ask.person.…`), `userId` an active member (400); replaces the speaker's previous mapping; at most 20 mappings (409 `LIMIT_REACHED`); 409 `CONCURRENT_MODIFICATION`. Logged as `AlexaSpeakerMapped` without the person ID |
| `DELETE /household/alexa-speakers/{personId}` | `200` with the remaining mappings; 404 without a mapping (ALEXA-002). Logged as `AlexaSpeakerUnmapped` |
| `PUT /household/vacation` | Body `{ "from": "YYYY-MM-DD", "until": "YYYY-MM-DD", "categories"?: [...] }` (SCHEDULING-005) → `200 { success: true, data: { household, rescheduled, conflicts } }`. `until` before `from` or in the past, empty or duplicate categories → 400. Moves affected Tenners behind the vacation (spread by daily load); concurrently changed Tenners keep their date and are counted in `conflicts`. Logged as `HouseholdVacationSet` |
| `DELETE /household/vacation` | `200 { success: true, data: { timezone, vacation: null } }`. Moved due dates stay. Logged as `HouseholdVacationEnded` |
| `PUT /users/{userId}/push-subscription` | NOTIFICATION-009. Body = the browser's `PushSubscription.toJSON()` (`endpoint` https, `keys.p256dh`, `keys.auth`) → `200 { devices }`. Only for the member themselves (403); at most 5 devices per member (oldest replaced). Logged as `PushSubscribed` with the push service host only |
| `DELETE /users/{userId}/push-subscription` | Body `{ "endpoint": … }` → `200`. Removes this device; logged as `PushUnsubscribed` |
| `POST /push-actions` | NOTIFICATION-011, **no login**: body `{ "token": … }` (HMAC-signed, 24 h, one member, Tenner, cycle and action) → `200 { action: "DONE", result: "COMPLETED" \| "ALREADY_DONE", title }` or `{ action: "SNOOZE", result: "SNOOZED", remindAt }`. 401 invalid or expired token, 403 inactive member, 409 inactive Tenner. „Erledigt“ completes only the token's cycle (Idempotency-Key from the token); „Später“ stores a snooze on the household item. Logged as `PushAction` (action and result only) |
| `POST /household/catalog` | DATA-008. Body empty or `{ "dryRun": true }` → `200 { dryRun, membersCreated, tennersCreated, tennersSkipped }`. Imports the household task catalog (`src/catalog/household-catalog.ts`): the member „Haushaltshilfe“ without login and 34 Tenners with first due dates per weekday and rotation slot. Idempotent: titles that exist (also archived, any case) and existing member IDs are skipped. 409 `CATALOG_MEMBERS_MISSING` if STEFAN or JULIA is missing. Logged as `HouseholdCatalogImported` (counts only) |
| `GET /meals/ingredients` | FOOD-021 → `200 { ingredients: [Ingredient] }` sorted by name: the catalog (`src/meals/catalog/ingredients.ts`) merged with the household's own ingredients and its changes to catalog values. `Ingredient`: `ingredientId`, `name`, `unit` (`g`, `ml`, `Stück`), `gramsPerPiece`?, `tags` (EU allergens, `APPLE`, `COCONUT`, `MEAT`, `POULTRY`, `PORK`, `BEEF`, `TOFU`, `QUINOA`, `BLUE_CHEESE`), `proteinTag`? (`POULTRY`, `FISH`, `MINCE`, `BURGER_PATTY`, `SAUSAGE`, `MEATBALL`, `HAM`), `baseTag`? (`PASTA`, `GNOCCHI`, `SCHUPFNUDELN`, `RICE`, `POTATO`, `BREAD`, `GRAIN`), `shoppingSection`, `nutritionPer100g` `{ kcal, protein, carbs, fat }`, `pricePerUnit` (EUR per 100 g/ml or piece), `pantry`, `source` (`CATALOG`/`CUSTOM`), `overridden` |
| `POST /meals/ingredients` | FOOD-021. Body `{ name (2–80), unit, tags?, proteinTag?, baseTag?, shoppingSection? (default SONSTIGES), nutritionPer100g?, pricePerUnit?, pantry?, gramsPerPiece? (required for Stück) }` → `201 Ingredient` with ID `custom-<slug>`. 409 `INGREDIENT_NAME_TAKEN` (case-insensitive, catalog included). Logged as `IngredientCreated` |
| `PUT /meals/ingredients/{ingredientId}` | FOOD-021. Body: any editable field (not `unit`); `proteinTag`/`baseTag` `null` clears → `200 Ingredient`. For catalog ingredients the changes are stored per household (`overridden: true`). 404 unknown, 409 name taken or `CONCURRENT_MODIFICATION`. Logged as `IngredientUpdated` |
| `GET /meals/dishes` | FOOD-002. Query `archived` (`true`/`false`, default `false`), `slot` (`LUNCH`/`DINNER`) → `200 { dishes: [Dish] }` sorted by name. `Dish`: stored fields `dishId`, `name`, `group`?, `category`, `slots`, `lightness` (`LIGHT`/`FILLING`), `temperature` (`WARM`/`COLD`), `ingredients` `[{ ingredientId, quantity, unit, optional }]` (per adult portion), `activeMinutes`, `totalMinutes`, `vegetarianVariant`?, `familyFriendly`, `isBurger`, `proteinSourcesOverride`?, `baseTagsOverride`?, `nutritionOverride`?, `costOverride`?, `favorite`, `imageKey`?, `archived`, `createdAt`, `updatedAt`; derived on every read from the current ingredients: `isVegetarian`, `tags`, `optionalTags`, `proteinSources`, `baseTags`, `containsPoultry`, `unknownIngredients`, `cost` (FOOD-013: `{ perAdultPortion, pantry, familyOverride, source, estimated: true, complete, missingIngredients }` in EUR; pantry ingredients count 0.10 € each per meal, `costOverride` = EUR for the whole family), `nutrition` (FOOD-012, per adult portion: `{ kcal (to 10), protein, carbs, fat (whole g), estimated: true, source: INGREDIENTS\|OVERRIDE, complete, missingIngredients }`; optional ingredients left out, `nutritionOverride` wins) |
| `POST /meals/dishes` | FOOD-002. Body: `name` (2–80), `category`, `slots` (1–2), `lightness`, `temperature`, `ingredients` (1–30, each ingredient once; unit must fit the ingredient: `EL`/`TL` only for g/ml), `activeMinutes` (1–240), optional `group`, `totalMinutes` (≥ active, default = active), `vegetarianVariant`, `familyFriendly` (true), `isBurger` (false), `proteinSourcesOverride`, `baseTagsOverride`, `nutritionOverride` (per adult portion: kcal 0–3000, protein/carbs/fat 0–500 g), `costOverride`, `favorite` (false) → `201 Dish`. 400 with field errors for unknown ingredients or units, 409 `DISH_NAME_TAKEN` (case-insensitive among active dishes). Logged as `DishCreated` |
| `GET /meals/dishes/{dishId}` | FOOD-002 → `200 Dish`; 400 for a malformed ID, 404 unknown (also other tenants) |
| `PUT /meals/dishes/{dishId}` | FOOD-002. Body: any create field; `null` removes `group`, `vegetarianVariant` and the overrides → `200 Dish`. 400, 404, 409 `DISH_NAME_TAKEN` or `CONCURRENT_MODIFICATION`. Logged as `DishUpdated` |
| `DELETE /meals/dishes/{dishId}` | FOOD-002: archives (no deletion) → `200 Dish` with `archived: true`; idempotent. Archived dishes are not planned; plans keep their references. Logged as `DishArchived` |
| `POST /meals/dishes/{dishId}/restore` | FOOD-002 → `200 Dish`; 409 `DISH_NAME_TAKEN` if an active dish has the name meanwhile. Logged as `DishRestored` |
| `POST /meals/dishes/{dishId}/image-upload` | FOOD-011. Body `{ contentType: image/jpeg\|image/png\|image/webp, size: 1 … 2097152 }` → `200 { imageKey, uploadUrl, headers, expiresInSeconds: 300 }`. The client PUTs the file to `uploadUrl` with exactly these headers (`Content-Type`, `Cache-Control`; the size is signed too). 404 unknown dish, 503 without `MEAL_IMAGES_BUCKET`. Logged as `DishImageUploadIssued` |
| `PUT /meals/dishes/{dishId}/image` | FOOD-011. Body `{ imageKey }` (from the upload response) → `200 Dish` with `imageKey`; 400 for a key of another household or dish; the replaced photo is deleted (a failed delete is logged as `DishImageCleanupFailed`, never returned). Logged as `DishImageSet` |
| `DELETE /meals/dishes/{dishId}/image` | FOOD-011 → `200 Dish` without `imageKey`; deletes the object. Logged as `DishImageRemoved` |
| `GET /meals/profile` | FOOD-004 → `200 { eaters: [Eater], household: Rules, updatedAt }`; defaults until the first save (`eaters: []`, the owner's rules, `updatedAt: null`). `Eater`: `eaterId`, `name`, `type` (`ADULT`/`CHILD`), `memberId`?, `portionFactor`, `diet` (`OMNIVORE`/`VEGETARIAN`), `vegetarianExceptions` (protein forms), `allergies`, `dislikeTags`, `dislikeIngredients`, `likeIngredients`, `likeGroups`. `Rules`: `dislikeTags`, `dislikeIngredients`, `maxActiveMinutes`, `attendance` `{ weekdayLunch, weekendLunch, dinner }` (eater IDs or `null` = default: weekday lunch all adults, otherwise everyone), `lightLunchOnWeekdays`, `costTiers { cheapMax, mediumMax }` (FOOD-013, EUR for the family, defaults 6 and 10, second above the first), `lightLunchMaxKcal` (FOOD-012, 200–2000, default 600: weekday lunches above it get a hint in the app), `maxSaladLunchesPerWeek`, `chicken { maxPerWeek, allowedSlots }` (`MON#DINNER` …), `maxBurgerPerWeek`, `limitedProteinTags`, `mealTimes { lunch, dinner }` |
| `PUT /meals/profile` | FOOD-004. Body `{ eaters (≤ 20; eaterId optional, generated), household }` replaces the profile → `200` profile. 400 with field errors for duplicate IDs or names, unknown members (each linked once), ingredients or attendance eaters, exceptions on non-vegetarians. 409 `CONCURRENT_MODIFICATION`. Logged as `FoodProfileUpdated` with the number of eaters only (no allergies) |
| `POST /meals/catalog` | FOOD-003. Body empty or `{ "dryRun": true }` → `200 { dryRun, dishesCreated, dishesSkipped }` (dish names). Imports the family dish catalog (`src/meals/catalog/dishes.ts`, 61 dishes) through the dish service. Idempotent: dishes whose name exists (any case, also archived or edited) are skipped and never changed. Logged as `MealCatalogImported` (counts only) |
| `GET /meals/calendar` | FOOD-015 → `200 { active, createdAt }` (the household's calendar link) |
| `POST /meals/calendar` | FOOD-015 → `201 { token, createdAt }`: a new feed token `<tenantId>.<43 chars>` (256 bits), shown once; only its SHA-256 hash is stored (`CALENDAR` item); the previous token stops working. Logged as `CalendarFeedCreated` without the token |
| `DELETE /meals/calendar` | FOOD-015: revokes the link → `200 { active: false, createdAt: null }`. Logged as `CalendarFeedRevoked` |
| `GET /meals/calendar/{token}` | FOOD-015, **public** (calendar apps send no login; the token authorizes). Path may end in `.ics` → `200 text/calendar` (RFC 5545): one 30-minute event per planned meal of this and next week at the profile's meal times (UTC), UID per meal slot, summary „🍽️ Mittag: …“, description with active time and vegetarian variant; `REFRESH-INTERVAL`/`X-PUBLISHED-TTL` 6 h. Unknown, malformed or revoked token → 404 |
| `PUT /meals/plans/{weekStart}/slots/{slotId}/status` | FOOD-023. Body `{ status: PLANNED\|COOKED\|SKIPPED\|OTHER, feedback?: UP\|DOWN }` (feedback only with `COOKED`; one per household, the last one wins) → `200` plan. Only for today and earlier (400 `MEAL_IN_FUTURE`), also in past weeks; `COOKED` needs a dish. Logged as `MealStatusSet` |
| `GET /meals/history` | FOOD-023 → `200 { dishes: [{ dishId, lastEaten, timesLast90Days, feedback }] }` from the stored plans (about a year); a planned meal two days old counts as cooked |
| `GET /meals/today` | FOOD-017. Query `days` (`1`/`2`, default 1) → `200 { today, days: [{ date, meals: [{ slot, status, dish: DishSummary \| null }] }] }` in household time; tomorrow on the last day of a week comes from the next week's plan (created on first read like `GET /meals/plans/next`). Used by the Alexa skill |
| `GET /meals/plans/{weekStart}` | FOOD-006. `weekStart` = `current`, `next` or the first day of a week (`YYYY-MM-DD`, household week start and timezone) → `200 { weekStart, weekEnd, ready, setup: { hasDishes, hasEaters }, generatedAt, slots: [{ slotId (`<date>#LUNCH`/`#DINNER`), date, weekday, slot, dishId, locked, source (`AUTO`/`MANUAL`), status, emptyReason?, dish: DishSummary \| null }] (14; `DishSummary` includes `nutrition` (FOOD-012) and `cost`; each slot has `cost` = EUR for the eaters of that meal, FOOD-013); plan `cost { total, perMeal, meals, complete }`, violations: [{ rule, severity, slotIds, message }] }`. The current and next week are planned on first read (one plan for parallel reads) and by the notifier; nothing is planned while there are no active dishes or no eaters (`ready: false`). Past weeks: stored plan or 404; further than next week: 400 `WEEK_OUT_OF_RANGE`; not a week start: 400 |
| `POST /meals/plans/{weekStart}/slots/{slotId}/replace` | FOOD-007. `slotId` URL-encoded (`2026-10-14%23DINNER`). Body empty, `{ "excludeDishIds": [...] }` (dishes rejected in this session) or `{ "dishId": "…" }` (put this dish back, undo) → `200` plan. Picks the best-scoring active dish that keeps every hard rule of the week, never the current dish or its group. 409 `NO_ALTERNATIVE` (message names the blocking rules), 409 `RULE_VIOLATION` for an undo dish that no longer fits, 400 `MEAL_IN_PAST`, 404 without plan or unknown meal, 409 `CONCURRENT_MODIFICATION`. Logged as `MealReplaced` |
| `GET /meals/plans/{weekStart}/slots/{slotId}/options` | FOOD-022. → `200 { options: [{ dish, violations }] }`: every active dish with what it would break at this meal, sorted by hard violations, then all violations, then name (fitting dishes first). 400 `MEAL_IN_PAST`, 404 without plan or unknown meal |
| `PUT /meals/plans/{weekStart}/slots/{slotId}` | FOOD-022. Body `{ dishId?, locked?, confirm? }` (at least `dishId` or `locked`) → `200` plan. A chosen dish becomes `source: MANUAL`, `locked: true`; rule violations are allowed and come back as `violations`, except allergy (R1) and vegetarian (R2) conflicts: 409 `CONFIRMATION_REQUIRED` (details name the rules) unless `confirm: true`. `locked` alone locks or unlocks the meal. 404 for unknown or archived dishes, 400 `MEAL_IN_PAST`, 409 `CONCURRENT_MODIFICATION`. Logged as `MealChosen` |
| `POST /meals/plans/{weekStart}/swap` | FOOD-022. Body `{ from, to, confirm? }` (two different meals of the week) → `200` plan with the dishes swapped, both manual and locked. 409 `CONFIRMATION_REQUIRED` if the swap moves an allergy or vegetarian conflict onto either meal, unless `confirm: true`; 400 for the same meal or `MEAL_IN_PAST`. Logged as `MealsSwapped` |
| `POST /meals/plans/{weekStart}/regenerate` | FOOD-008. Body empty → `200` plan plus `regeneration { changed, kept }`: replans the week with a new seed, keeping locked, manual, cooked and past meals (hard rules hold across kept and new meals). Undo: `{ "restore": [{ slotId, dishId \| null }] }` puts the previous dishes of replanned meals back (400 for a kept or unknown meal, 404 for an unknown dish). 404 without plan, 409 `CONCURRENT_MODIFICATION`. Logged as `MealPlanRegenerated` with the counts |
| `GET /meals/plans/{weekStart}/shopping-list` | FOOD-014. → `200 { weekStart, range, generatedAt, stale, items }`; made from the week's plan on first read (range `REST`: meals from today on). Items: `{ key, ingredientId, name, quantity, unit, section, pantry, checked, manual, usedFor }` in the household's order; quantities are counts since FOOD-028 (`unit` `Stück`): pieces summed over the meals (per adult portion × portion factors) and rounded up, weighed ingredients once per meal that needs them; lists stored with grams are returned as counts; optional ingredients and cooked or skipped meals left out. `stale: true` when the plan changed since. 404 while the week has no plan |
| `POST /meals/plans/{weekStart}/shopping-list/refresh` | FOOD-014. Body `{}` or `{ "range": "REST" \| "WEEK" }` → `200` list recalculated; ticks, own items and the own order stay, unused items go, new ones go after their section. Logged as `ShoppingListRefreshed` |
| `POST /meals/plans/{weekStart}/shopping-list/changes` | FOOD-014. Body `{ operations: [...] }` (1 – 200): `{ type: "check", key, checked }`, `{ type: "add", key: "manual-…", name }`, `{ type: "remove", key }`, `{ type: "move", key, afterKey \| null }` → `200` list. Idempotent (offline replays); unknown keys ignored; parallel changes are retried on the newest version (3 attempts, then 409 `CONCURRENT_MODIFICATION`). Logged as `ShoppingListChanged` with the number of operations, no item names |
| `POST /tenners/{tennerId}/pause` | Body optional `{ "until": "YYYY-MM-DD" }` (last paused day, after today) → `200 TennerResponse` with `pausedAt`, `pausedUntil` (SCHEDULING-005). A due date ≤ `until` moves to `until + 1`. 400, 404, 409 `TENNER_INACTIVE` or `CONCURRENT_MODIFICATION` |
| `POST /tenners/{tennerId}/resume` | `200 TennerResponse` (SCHEDULING-005). Ends an individual pause; a passed due date becomes today. 409 `TENNER_NOT_PAUSED` if not paused (a vacation is ended with `DELETE /household/vacation`) |
| `PUT /household` | Body: any of `name` (1–60), `timezone` (IANA), `weekStartsOn` (`MONDAY`/`SUNDAY`), `workdays` (1–7 distinct `MON`..`SUN`, stored in ISO order), `defaults` (`{ category, estimatedMinutes 1–480, frequencyDays 1–3650 }`, category must be selectable) → `200 HouseholdResponse`. Invalid values or an empty body → `400 VALIDATION_ERROR`. Affects every household member; logged as `HouseholdSettingsChanged` with the changed fields |
| `GET /analytics/summary` | Query `period` (`week`, `month`, `quarter`, `year`, `last30`, `last90`; default `last30`) or `from`/`to` (`YYYY-MM-DD`, at most 366 days) → `200 { success: true, data: { period, completions, totalActualMinutes, activeTenners, distinctTennersCompleted, overdueNow, onTimeRate, onTimeSamples } }` (ANALYTICS-001). 400 for invalid periods. Definitions: `docs/analytics.md` |
| `GET /analytics/trends` | Period query as above plus `granularity` (`day`, `week`, `month`; default `week`), `assignedTo`, `category` → `200 { success: true, data: { granularity, period, buckets: [{ start, completions, actualMinutes }], comparison: { previousPeriod, previousPeriodCompletions, changePercent } } }` (ANALYTICS-002). Buckets without completions are included |
| `GET /analytics/users` | Period query → `200 { success: true, data: { period, users: [{ userId, displayName, active, completions, actualMinutes, assignedActive, assignedOverdue, completedForOthers }], shared: { assignedActive, assignedOverdue } } }` (ANALYTICS-003). One entry per household member, also without activity |
| `GET /analytics/categories` | Period query → `200 { success: true, data: { period, categories: [{ category, name, archived, activeTenners, completions, actualMinutes, shareOfMinutes, overdueNow, healthScore }] } }` (ANALYTICS-004). Every household category in display order |
| `GET /analytics/neglected` | Period query (default `last90`) plus `limit` (1–50, default 10) → `200 { success: true, data: { period, items: [{ tennerId, title, assignedTo, category, daysOverdue, daysSinceCompleted, expectedCompletions, actualCompletions, fulfillmentRatio, neglectScore }] } }` (ANALYTICS-006). Highest neglect first; Tenners with score 0 are left out |
| `GET /analytics/balance` | Period query → `200 { success: true, data: { period, byUser: [{ userId, displayName, shareOfMinutes, shareOfAssignedLoad }], byCategory: [{ category, name, shares }], balanceIndex } }` (ANALYTICS-007). Members in list order, no ranking |
| `GET /analytics/habits` | Period query (default `last90`) → `200 { success: true, data: { period, householdConsistency, items: [{ tennerId, title, currentStreak, longestStreak, consistencyScore, trend }] } }` (ANALYTICS-008). `consistencyScore`/`trend` are `null` with too little data |
| `GET /analytics/habits/{tennerId}` | Period query → `200` with the item fields plus `period`, `frequencyDays`, `expectedCompletions`, `actualCompletions`, `completionDates`, `intervals`; 404 for unknown or deleted Tenners |
| `GET /analytics/time` | Period query → `200 { success: true, data: { period, totalActualMinutes, averageMinutesPerWeek, projectedMinutesPerWeek, estimationAccuracy, reportedSamples, tennersExceedingEstimate: [{ tennerId, title, estimatedMinutes, medianActualMinutes, samples }], tennersExceedingTenMinutes } }` (ANALYTICS-005) |
| `GET /history` | `200 { success: true, data: { items, nextCursor } }` (TICKET-020). Returns `400` for invalid filters or cursor |
| `GET /tenners/{tennerId}/history` | `200 { success: true, data: { items, nextCursor } }` (TICKET-020). Returns `404` for an unknown Tenner |
| unknown route | `404 NOT_FOUND` |

Every route except `GET /health` additionally returns `401 UNAUTHORIZED` (from API Gateway or, without claims, from
the Lambda) and `403 FORBIDDEN` for accounts without a household group (SECURITY-004, FUTURE-011). `TennerResponse` includes
`createdBy` and `updatedBy`.

### POST /tenners

Request (`title`, `category`, `estimatedMinutes`, `assignedTo` and a frequency in one of the two forms; unknown fields rejected):

```json
{ "title": "Vacuum Office", "category": "HOUSEHOLD", "estimatedMinutes": 10, "frequencyDays": 14, "assignedTo": "STEFAN" }
{ "title": "Review finances", "category": "FINANCE", "estimatedMinutes": 30, "frequencyUnit": "MONTH", "frequencyInterval": 1, "assignedTo": "JULIA" }
```

The service generates `tennerId` (UUID v4), `tenantId` (from the identity), `createdBy` = `updatedBy` = authenticated user, `active = true`,
`lastCompleted = null`, `nextDue` = today in the household timezone and `createdAt` = `updatedAt` = now (UTC, seconds precision).
The repository writes with `attribute_not_exists(tennerId)`, so it never overwrites an existing item.

## Dependencies

- Runtime: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-cognito-identity-provider`
  (HOTFIX-001, same SDK version) and `zod`. All are bundled and pinned.
- The logger is a small built-in module instead of `pino`. It has no dependency and covers JSON output,
  levels and correlation.
