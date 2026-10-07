# TICKET-010: Implement List Tenners API

## Type

Backend Feature

---

## Priority

High

---

## Goal

Implement the ability to retrieve Tenners from the Tenner platform.

This ticket delivers the first read capability and provides the data required to build the frontend dashboard.

The API must support:

- Retrieval of all Tenners
- Filtering
- Sorting
- Due and overdue views
- User-specific views

The implementation must fully utilize the architecture established in previous tickets.

---

# Background

The following capabilities already exist:

- API Infrastructure
- DynamoDB Infrastructure
- Lambda ⇄ DynamoDB Integration
- Domain Foundation
- Create Tenner API

This ticket introduces retrieval capabilities for existing Tenners.

---

# Scope

Implement:

```text
GET /tenners
```

The endpoint must return all Tenners matching optional filtering parameters.

---

# Endpoint

## Request

```http
GET /tenners
```

---

## Query Parameters

All parameters are optional.

### assignedTo

Example:

```http
GET /tenners?assignedTo=STEFAN
```

---

### category

Example:

```http
GET /tenners?category=HOUSEHOLD
```

---

### active

Example:

```http
GET /tenners?active=true
```

---

### due

Example:

```http
GET /tenners?due=true
```

Definition:

```text
nextDue <= today
```

---

### overdue

Example:

```http
GET /tenners?overdue=true
```

Definition:

```text
nextDue < today
```

---

### sort

Allowed values:

```text
nextDue

title

createdAt

updatedAt
```

Example:

```http
GET /tenners?sort=nextDue
```

---

### order

Allowed values:

```text
asc

desc
```

Example:

```http
GET /tenners?sort=nextDue&order=asc
```

---

# Default Behavior

Without filters:

```http
GET /tenners
```

returns all active Tenners.

Equivalent:

```http
GET /tenners?active=true
```

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
  "data": [
    {
      "tennerId": "123",
      "title": "Vacuum Office",
      "category": "HOUSEHOLD",
      "frequencyDays": 14,
      "estimatedMinutes": 10,
      "assignedTo": "STEFAN",
      "nextDue": "2026-10-15",
      "active": true
    }
  ]
}
```

---

## Empty Result

HTTP:

```text
200 OK
```

Response:

```json
{
  "success": true,
  "data": []
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
list()
```

supporting:

```text
Filtering

Sorting

Mapping
```

The repository implementation is responsible only for data access.

Business interpretation remains inside the service layer.

---

# Service Layer

Implement:

```typescript
listTenners()
```

Responsibilities:

```text
Default Filters

Due Calculation

Overdue Calculation

Sorting Rules
```

---

# DTOs

Implement:

```typescript
ListTennersRequest

ListTennersResponse
```

---

# Mapping Rules

Expose only API-safe fields.

Do not expose:

```text
Internal Database Metadata

Partition Keys

Storage Implementation Details
```

---

# Logging

Log:

```text
List Tenners Request

Filter Criteria

Result Count
```

Do not log:

```text
Raw Query Objects

AWS Metadata

Sensitive Data
```

---

# DynamoDB Access Strategy

Use:

```text
GSI:
nextDue-index

GSI:
assignedTo-index
```

when beneficial.

Avoid unnecessary table scans whenever possible.

Performance should be considered from the beginning.

---

# Validation Rules

Validate:

```text
Assigned User

Category

Sort Fields

Sort Direction

Boolean Flags
```

Invalid values must produce:

```text
400 Bad Request
```

---

# Testing Requirements

Create tests for:

```text
List All Tenners

List Due Tenners

List Overdue Tenners

List By User

List By Category

Invalid Sort Option

Invalid User

Empty Result Set

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
GET /tenners
```

Create:

```text
ListTennersRequest

ListTennersResponse

ListTennersService
```

Update:

```text
Routing

Repository Implementation

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

- GET /tenners implemented
- Filtering works
- Sorting works
- Due filter works
- Overdue filter works
- User filter works
- Category filter works
- Validation enforced
- Standard API response returned
- Tests passing

---

# Definition of Done

- Tenners can be listed
- Dashboard data available
- Filtering available
- Sorting available
- Architecture respected
- Tests passing
- Deployable through GitHub Actions

---

# Out of Scope

Do not implement:

- Update Tenner
- Delete Tenner
- Complete Tenner
- Dashboard API
- Analytics API
- Authentication
- Pagination

Pagination will be introduced only when justified by actual usage.

---

## Implementation Status

Implemented: 2026-10-01.

### Deliverables

- [x] `GET /tenners`: handler `src/handlers/list-tenners.ts`, route in `src/index.ts` and `local.api_routes`
- [x] `ListTennersRequest`, `ListTennersResponse` (`src/dto/list-tenners.dto.ts`), `listTennersQuerySchema`
- [x] `ListTennersService` (defaults, due/overdue calculation, sorting)
- [x] Repository `list()` with query builder (`tenner.query.ts`), pagination and mapper (`tenner.mapper.ts`)
- [x] Tests and documentation

### Acceptance Criteria

| Criterion | Status |
|---|---|
| GET /tenners implemented | [x] |
| Filtering works | [x] `assignedTo`, `category`, `active`, `due`, `overdue` |
| Sorting works | [x] `nextDue`/`title`/`createdAt`/`updatedAt`, `asc`/`desc`, deterministic tie-breaking |
| Due filter works | [x] `nextDue <= today` |
| Overdue filter works | [x] `nextDue < today` |
| User filter works | [x] via `assignedTo-index` |
| Category filter works | [x] FilterExpression |
| Validation enforced | [x] invalid user, category, sort, order and boolean flags, plus unknown parameters → 400 |
| Standard API response returned | [x] `{ success: true, data: [...] }`, empty list → `data: []` |
| Tests passing | [x] 122 tests. All ticket cases are covered (all, due, overdue, by user, by category, invalid sort, invalid user, empty, repository failure) |

### Validation Performed

- `npm run lint`, `npm run build` and `npm test` pass. New modules are 100% covered.
- Bundle against a fake DynamoDB endpoint: 4 requests were checked.
  - No filter: Query on the base table with `active` filter.
  - User and due: `assignedTo-index`.
  - Overdue and category: `nextDue-index`.
  - Invalid `sort`: 400.
  - No Scan was issued.

### Assumptions

- `due=false` and `overdue=false` mean "no filter", not "not due". `active=false` lists only inactive Tenners.
- If both `due` and `overdue` are true, `overdue` wins (stricter).
- Default sort is `nextDue asc` (the ticket specifies none). Ties are broken by title, then ID.
- "Today" is the UTC date (TD-005).
- No pagination, as stated in Out of Scope. The repository reads all DynamoDB pages internally.
- Responses contain the full `TennerResponse` (a superset of the example), without `tenantId` or storage metadata.
- Sorting happens in the service, which owns the "Sorting Rules". The repository only filters.
