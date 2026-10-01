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
