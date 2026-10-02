# TICKET-009: Implement Create Tenner API

## Type

Backend Feature

---

## Priority

High

---

## Goal

Implement the first Tenner business capability.

This ticket delivers the ability to create a new Tenner through the public API and persist it in DynamoDB.

This is the first end-to-end workflow that passes through:

```text
API Gateway
    ↓

Lambda Handler
    ↓

Service Layer
    ↓

Repository Layer
    ↓

DynamoDB
```

All architectural patterns established in previous tickets must be respected.

---

# Background

The following foundation already exists:

- API Infrastructure
- DynamoDB Infrastructure
- Lambda ⇄ DynamoDB Integration
- Domain Models
- DTOs
- Validation Framework
- Logging Framework
- Repository Interfaces
- Service Interfaces

This ticket implements the first business endpoint.

---

# Scope

Implement:

```text
POST /tenners
```

Purpose:

```text
Create a new Tenner.
```

---

# Endpoint

## Request

```http
POST /tenners
Content-Type: application/json
```

Example:

```json
{
  "title": "Vacuum Office",
  "category": "HOUSEHOLD",
  "estimatedMinutes": 10,
  "frequencyDays": 14,
  "assignedTo": "STEFAN"
}
```

---

# Validation Rules

## Title

Required.

```text
Minimum Length: 3

Maximum Length: 100
```

---

## Category

Required.

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

Required.

Valid range:

```text
1 - 480
```

---

## Frequency Days

Required.

Valid range:

```text
1 - 3650
```

---

## Assigned User

Required.

Allowed values:

```text
STEFAN
JULIA
```

---

# Generated Fields

The following values must be generated automatically.

---

## Tenant

```text
default
```

---

## Tenner ID

Generate UUID.

Example:

```text
5c2bfd9b-c8d1-4ab7-af57-b1dfe6ddbf05
```

---

## Active Flag

Default:

```text
true
```

---

## Last Completed

Default:

```text
null
```

---

## Next Due

Default:

```text
Current Date
```

A newly created Tenner should immediately appear in the due list.

---

## Created At

Current UTC timestamp.

---

## Updated At

Current UTC timestamp.

---

# Persistence

Persist the Tenner in:

```text
tenner-tenners
```

DynamoDB table.

Use repository implementation.

Handlers must not access DynamoDB directly.

---

# Response

## Success

HTTP:

```text
201 Created
```

Response:

```json
{
  "success": true,
  "data": {
    "tennerId": "uuid",
    "title": "Vacuum Office"
  }
}
```

---

## Validation Failure

HTTP:

```text
400 Bad Request
```

Response:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed"
  }
}
```

---

## Internal Error

HTTP:

```text
500 Internal Server Error
```

Response:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR"
  }
}
```

---

# Logging

Log:

```text
Tenner Created

Tenner ID

Assigned User

Category
```

Do not log:

```text
AWS credentials

Secrets

Internal stack traces
```

---

# Architecture Requirements

## Handler Responsibilities

Allowed:

```text
Request Parsing

Validation Invocation

Service Invocation

Response Mapping
```

Not Allowed:

```text
Business Logic

DynamoDB Access

Date Calculations
```

---

## Service Responsibilities

Allowed:

```text
Business Rules

Object Creation

Default Values

Domain Validation
```

---

## Repository Responsibilities

Allowed:

```text
Persistence

Reads

Writes
```

No business logic.

---

# Testing Requirements

Create unit tests for:

```text
Successful Creation

Invalid Title

Invalid Frequency Days

Invalid Category

Invalid Assigned User

Repository Failure
```

Minimum coverage:

```text
80%
```

for new code.

---

# Deliverables

Implement:

```text
POST /tenners
```

Create:

```text
CreateTennerRequest

CreateTennerService

TennerRepository Implementation
```

Update:

```text
API Routing

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

- POST /tenners implemented
- Validation enforced
- UUID generated
- DynamoDB persistence works
- CreatedAt populated
- UpdatedAt populated
- Active defaults to true
- NextDue defaults to today
- Standard API response returned
- Unit tests passing

---

# Definition of Done

- New Tenners can be created
- Tenner stored in DynamoDB
- Application architecture respected
- Validation enforced
- Logging operational
- Tests passing
- Deployable through GitHub Actions

---

# Out of Scope

Do not implement:

- List Tenners
- Update Tenners
- Delete Tenners
- Complete Tenners
- Analytics
- Authentication
- Frontend Integration

These will be delivered in separate tickets.

---

## Implementation Status

Implemented: 2026-10-01.

### Deliverables

- [x] `POST /tenners`: `backend/src/handlers/create-tenner.ts`, registered in `src/index.ts`, API Gateway route in `local.api_routes`
- [x] `CreateTennerRequest` (DTO from TICKET-008) and `createTennerSchema`
- [x] `CreateTennerService` (`src/services/create-tenner.service.ts`)
- [x] TennerRepository implementation: `DynamoDbTennerRepository.save` (`src/repositories/dynamodb/`)
- [x] Tests and documentation (`backend/README.md`, `docs/architecture.md`)

### Acceptance Criteria

| Criterion | Status |
|---|---|
| POST /tenners implemented | [x] |
| Validation enforced | [x] title 3–100, category, estimatedMinutes 1–480, frequencyDays 1–3650, assignedTo, unknown fields rejected |
| UUID generated | [x] `crypto.randomUUID()` |
| DynamoDB persistence works | [x] unit-tested command. The bundle was verified against a fake DynamoDB endpoint: a correct conditional `PutItem` and 201. Live verification after deploy |
| CreatedAt populated | [x] |
| UpdatedAt populated | [x] |
| Active defaults to true | [x] |
| NextDue defaults to today | [x] UTC date |
| Standard API response returned | [x] `{ success: true, data }`, 201 |
| Unit tests passing | [x] 94 tests (all ticket cases: success, invalid title/frequency/category/user, repository failure) |

Coverage for new code is 100%. Overall: statements 98.8%, branches 98.8%.

### Assumptions

- The response contains the full `TennerResponse` (a superset of the example `{ tennerId, title }`).
- `nextDue` = today's **UTC** date. Household timezone support comes in SCHEDULING-008 (TD-005).
- Timestamps use seconds precision (`2026-10-01T18:30:15Z`), consistent with the ticket examples.
- The repository implements only `save`. Further methods come with TICKET-010 to TICKET-012.
  The service depends on `Pick<TennerRepository, "save">`.
- An existing ID results in `409 CONFLICT`. This is practically impossible with UUIDs, but the
  conditional write prevents silent overwrites.
- Without configured tables, `POST /tenners` answers `503 SERVICE_UNAVAILABLE`.
- The API Gateway route resource became `for_each` over `local.api_routes`. A `moved` block keeps the existing
  `GET /health` route (no destroy/create).
- The bundle grows to about 1 MB because of Zod (TD-012).
