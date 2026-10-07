# TICKET-020: Implement Completion History API

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

Expose the immutable completion history through read-only API endpoints.

Users must be able to answer:

- When was this Tenner last done, and by whom?
- What was completed recently in the household?

---

# Background

Every completion is stored in `tenner-history` (TICKET-006, TICKET-013).

The MVP requires that "Completion history is stored". The history is currently
write-only: there is no endpoint to read it.

The Recent Activity widget (FRONTEND-007) and the Tenner detail view (FRONTEND-009)
need history data.

The `completedAt-index` GSI (partition `tenantId`, sort `completedAt`) already
supports time-ordered queries.

---

# Dependencies

```text
TICKET-006
TICKET-013
TICKET-014
```

---

# Scope

Implement:

```text
GET /history

GET /tenners/{tennerId}/history
```

---

# GET /history

Returns household-wide completion history ordered by `completedAt` descending.

## Query Parameters

```text
from          ISO 8601 date, optional
to            ISO 8601 date, optional
completedBy   optional (STEFAN | JULIA)
limit         optional, 1 - 100, default 20
cursor        optional, opaque pagination token
```

## Implementation

Query `completedAt-index` with `ScanIndexForward = false`.

`Scan` is not permitted.

---

# GET /tenners/{tennerId}/history

Returns history for one Tenner, ordered by `completedAt` descending.

## Query Parameters

```text
limit         1 - 100, default 20
cursor        optional
```

## Index

Querying per Tenner requires an access pattern not covered by existing indexes.

Add a GSI to `tenner-history`:

```text
Index Name:     tennerId-completedAt-index
Partition Key:  tenantKey  (tenantId#tennerId)
Sort Key:       completedAt
```

Alternatively a composite attribute may be used if simpler. Document the decision
in `docs/architecture.md`.

Existing records must be backfilled with the new attribute. Provide an idempotent
backfill script.

---

# Undone Completions

Completions reverted by the Undo workflow (TICKET-014) must be excluded by default.

Support:

```text
includeUndone=true
```

for diagnostics.

---

# Pagination

Use DynamoDB `LastEvaluatedKey`, encoded as opaque base64url cursor.

The cursor must not expose raw table keys in a way that allows tenant switching.
Validate the decoded cursor's tenantId against the request tenant.

---

# Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "completionId": "8b4772cd-781d-49b8-8cd0-4e68d5267d32",
        "tennerId": "tenner-001",
        "tennerTitle": "Vacuum Office",
        "completedBy": "STEFAN",
        "completedAt": "2026-10-01T18:30:00Z",
        "actualMinutes": 12
      }
    ],
    "nextCursor": "eyJ..."
  }
}
```

`tennerTitle` is resolved via `BatchGetItem` on `tenner-tenners`.
Missing Tenners (hard-deleted in future) return `tennerTitle: null`.

---

# IAM

Allow only:

```text
dynamodb:Query on tenner-history and its indexes
dynamodb:BatchGetItem on tenner-tenners
```

---

# Testing Requirements

```text
Household History Ordering

Date Range Filtering

User Filtering

Per-Tenner History

Pagination Cursor Round Trip

Invalid Cursor

Foreign Tenant Cursor Rejected

Undone Completions Excluded

Limit Boundaries

Missing Tenner Title
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
GET /history

GET /tenners/{tennerId}/history

New GSI (Terraform)

Backfill script

DTOs, service, repository

Tests

Documentation
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

- Household history endpoint implemented
- Per-Tenner history endpoint implemented
- Results ordered newest first
- Pagination works with opaque cursors
- Undone completions excluded by default
- No Scan operations used
- New GSI provisioned via Terraform
- Backfill script is idempotent
- IAM follows least privilege
- Tests passing
- Documentation updated

---

# Definition of Done

- Completion history is readable through the API
- Recent Activity and detail views can consume real data
- Feature deploys through GitHub Actions

---

# Out of Scope

Do not implement:

- Editing or deleting history (DATA-007)
- Analytics aggregations (ANALYTICS domain)
- Export (DATA-001)
- Frontend integration (FRONTEND-009)

---

## Implementation Status

Implemented: 2026-10-01.

### Deliverables

- [x] `GET /history` and `GET /tenners/{tennerId}/history`: `backend/src/handlers/history.ts`, routes in `src/index.ts` and `local.api_routes`
- [x] DTOs (`HistoryRequest`, `TennerHistoryRequest`, `HistoryItemResponse`, `HistoryResponse`), schemas, `HistoryService`
- [x] Repositories:
  - `CompletionRepository.getHistory` and `getByTenner`, returning pages with `lastKey`
  - `TennerRepository.getTitles` (`BatchGetItem`)
- [x] Opaque cursors with tenant binding (`src/utils/cursor.ts`)
- [x] GSI: `tennerId-completedAt-index` (`tenantTennerId`, `completedAt`) **already exists from TICKET-014**.
  New completions write `tenantTennerId`, so no new index and no backfill are needed.
- [x] IAM: `dynamodb:BatchGetItem` on `tenner-tenners` only (statement 2), plus a Terraform test
- [x] Tests and documentation

### Acceptance Criteria

| Criterion | Status |
|---|---|
| Household history endpoint implemented | [x] |
| Per-Tenner history endpoint implemented | [x] (404 for unknown Tenners) |
| Results ordered newest first | [x] `ScanIndexForward: false` |
| Pagination works with opaque cursors | [x] round trip tested. The cursor points at the last *returned* item, so pages cut short by filters are correct |
| Undone completions excluded by default | [x] `includeUndone=true` includes them |
| No Scan operations used | [x] Queries on GSIs only |
| New GSI provisioned via Terraform | [x] exists since TICKET-014 |
| Backfill script is idempotent | [x] not needed. No completions without `tenantTennerId` exist, because none were deployed before TICKET-014 |
| IAM follows least privilege | [x] `BatchGetItem` only on the Tenner table (tested). `Query` on history indexes was already granted |
| Tests passing | [x] 362 backend tests (100% coverage), 27 Terraform tests |
| Documentation updated | [x] |

Covered test cases:
- household ordering, date range, user filter, per-Tenner history
- cursor round trip, invalid cursor, foreign-tenant cursor
- undone exclusion, limit boundaries (0, 101, non-numeric), missing Tenner title

### Validation Performed

Bundle against a fake DynamoDB endpoint:
- **First page:** the `completedAt-index` Query (filters `revertedAt` and `completedBy`) plus one `BatchGetItem`
  returns titles, with `null` for the missing Tenner, and a cursor.
- **Second page:** the cursor turns into a correct `ExclusiveStartKey`.

### Assumptions

- **Date range in UTC:** `from`/`to` are UTC days (`T00:00:00Z` to `T23:59:59Z`), consistent with how
  `completedAt` is stored (TD-005).
- **Page budget:** at most 20 DynamoDB pages per request. If heavy filtering stops the scan early, the response
  contains fewer items and a `nextCursor`.
- **`revertedAt`** is included in each item, so undone entries are recognizable with `includeUndone=true`.
- **`CompletionRepository.create()`** from TICKET-008 was removed. Completions are only written transactionally
  together with the Tenner (TICKET-013/014), so a standalone `create` would be a trap.
