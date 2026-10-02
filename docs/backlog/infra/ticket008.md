# TICKET-008: Establish Backend Domain Foundation

## Type

Backend Foundation

---

## Priority

High

---

## Goal

Establish the core backend architecture, domain model, validation framework, and application structure for Tenner.

This ticket creates the foundation that all future API endpoints and business logic will build upon.

No CRUD functionality should be implemented.

No business workflows should be implemented.

The objective is to create a clean, maintainable, testable backend architecture before feature development begins.

---

# Background

The following foundation already exists:

- CI/CD Pipeline
- Terraform Foundation
- Resource Governance
- Frontend Hosting
- API Infrastructure
- DynamoDB Infrastructure
- Lambda ⇄ DynamoDB Integration

The backend now requires a structured domain layer before feature development begins.

---

# Architectural Principles

## Domain First

Business concepts must be represented through domain models.

Avoid:

```text
Anonymous JSON Objects

Magic Strings

Inline Validation

Direct DynamoDB Access Inside Handlers
```

Favor:

```text
Domain Models

Repository Pattern

Service Layer

Central Validation

Typed Contracts
```

---

## Separation of Concerns

Responsibilities must be separated.

```text
Handlers
    ↓

Services
    ↓

Repositories
    ↓

Infrastructure Clients
```

Handlers must not contain business logic.

Repositories must not contain validation logic.

Services must not directly access DynamoDB.

---

## Type Safety First

All application data must be represented as strongly typed TypeScript objects.

Use strict TypeScript configuration.

Avoid:

```text
any

unknown bypasses

implicit typing
```

---

# Scope

Create:

```text
Domain Models

DTOs

Repository Interfaces

Service Interfaces

Validation Framework

Error Handling Framework

Response Contracts

Project Structure
```

No business endpoints.

No CRUD operations.

No data mutations.

---

# Backend Structure

Establish the following structure:

```text
backend/

├── src/
│
├── handlers/
│
├── services/
│
├── repositories/
│
├── clients/
│
├── models/
│
├── dto/
│
├── validators/
│
├── exceptions/
│
├── types/
│
├── utils/
│
└── tests/
```

Folder names may vary slightly if justified.

---

# Domain Models

## Tenner

Create primary domain model.

```typescript
Tenner
```

Minimum properties:

```text
tenantId

tennerId

title

category

estimatedMinutes

frequencyDays

assignedTo

lastCompleted

nextDue

active

createdAt

updatedAt
```

---

## Completion

Create completion domain model.

```typescript
Completion
```

Properties:

```text
tenantId

completionId

tennerId

completedBy

completedAt

actualMinutes
```

---

## User

Create household user representation.

```typescript
User
```

Properties:

```text
userId

displayName

active
```

---

# Enumerations

Create typed enums.

## Category

Initial values:

```text
HOUSEHOLD

FITNESS

FAMILY

HOME

PERSONAL

FINANCE
```

---

## User

Initial values:

```text
STEFAN

JULIA
```

---

# DTO Framework

Create separate request/response contracts.

Examples:

```typescript
CreateTennerRequest

UpdateTennerRequest

CompleteTennerRequest

TennerResponse

HealthResponse
```

Purpose:

Prevent leaking internal domain models into API contracts.

---

# Repository Layer

Define interfaces only.

No implementation.

---

## TennerRepository

Required methods:

```typescript
getById()

list()

save()

update()

delete()
```

---

## CompletionRepository

Required methods:

```typescript
create()

getHistory()

getByTenner()
```

---

# Service Layer

Define service interfaces only.

No implementation.

---

## TennerService

Methods:

```typescript
createTenner()

updateTenner()

completeTenner()

listDueTenners()
```

---

## AnalyticsService

Methods:

```typescript
getDashboard()

getCompletionMetrics()
```

---

# Validation Framework

Introduce schema validation.

Recommended:

```text
zod
```

Alternative:

```text
class-validator
```

if justified.

---

## Validation Objectives

Validate:

```text
Required Fields

String Lengths

Date Formats

Numeric Constraints

Enum Values
```

---

# Error Handling Framework

Create application-level exception hierarchy.

---

## Base Exception

```typescript
ApplicationError
```

---

## Derived Exceptions

```typescript
ValidationError

NotFoundError

ConflictError

PersistenceError

UnauthorizedError
```

---

# API Response Standard

Create standardized API responses.

---

## Success Response

Example:

```json
{
  "success": true,
  "data": {}
}
```

---

## Error Response

Example:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request."
  }
}
```

---

# Configuration Framework

Create centralized configuration management.

Do not access:

```typescript
process.env
```

throughout the codebase.

Create:

```typescript
config.ts
```

as single source of truth.

---

# Logging Framework

Create reusable logger abstraction.

Requirements:

```text
Structured Logging

JSON Format

Log Levels

Request Correlation Support
```

Preferred:

```text
pino
```

or equivalent.

---

# Testing Foundation

Create test setup.

Requirements:

```text
Unit Test Framework

Mock Support

Repository Mocks

Service Mocks
```

Preferred:

```text
Vitest
```

---

# Documentation

Create:

```text
backend/README.md
```

Document:

```text
Architecture

Layer Responsibilities

Dependency Flow

Domain Model Definitions
```

---

# Deliverables

Create:

```text
Domain Models

DTOs

Repository Interfaces

Service Interfaces

Validation Framework

Exception Framework

Logging Framework

Configuration Framework

Test Foundation
```

Update:

```text
docs/architecture.md
```

---

# Validation

The following must succeed:

```bash
npm install

npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- Domain models created
- DTO layer created
- Repository interfaces created
- Service interfaces created
- Validation framework configured
- Error handling framework created
- Logging abstraction created
- Configuration abstraction created
- Test framework configured
- Documentation updated

---

# Definition of Done

- Backend architecture established
- Domain model finalized
- Separation of concerns enforced
- Type safety enforced
- Validation strategy defined
- Error handling standardized
- Ready for CRUD implementation
- Build pipeline passes successfully

---

# Out of Scope

Do not implement:

- Create Tenner Endpoint
- Update Tenner Endpoint
- Delete Tenner Endpoint
- Complete Tenner Endpoint
- Analytics Endpoints
- Authentication
- Authorization
- Frontend Integration

This ticket only establishes the backend domain and application architecture foundation.

---

## Implementation Status

Implemented: 2026-10-01.

### Deliverables

| Deliverable | Location |
|---|---|
| Domain models | `backend/src/models/`: `Tenner`, `Completion`, `User`, enumerations `CATEGORIES`/`Category`, `USER_IDS`/`UserId`, `HOUSEHOLD_USERS` |
| DTOs | `backend/src/dto/`: `CreateTennerRequest`, `UpdateTennerRequest`, `CompleteTennerRequest`, `TennerResponse`, `CompletionResponse`, `HealthResponse`, `DashboardResponse`, `CompletionMetrics`, response envelope, mappers |
| Repository interfaces | `backend/src/repositories/`: `TennerRepository` (getById, list, save, update, delete) and `CompletionRepository` (create, getHistory, getByTenner) |
| Service interfaces | `backend/src/services/`: `TennerService` (createTenner, updateTenner, completeTenner, listDueTenners) and `AnalyticsService` (getDashboard, getCompletionMetrics) |
| Validation framework | `backend/src/validators/`: Zod schemas, central `LIMITS`, `validate()`, `parseJsonBody()` |
| Exception framework | `backend/src/exceptions/`: `ApplicationError` plus 5 subclasses; central mapping to HTTP in `utils/http.ts` and `index.ts` |
| Logging framework | `backend/src/utils/logger.ts`: JSON, levels, `child()` for correlation, `errorFields()` |
| Configuration framework | `backend/src/config.ts`: the only reader of `process.env` (enforced by ESLint) |
| Test foundation | Vitest and `backend/tests/mocks/` (config, logger, repository and service mocks, fixture) |
| Documentation | `backend/README.md`, `docs/architecture.md` (Backend Architecture) |

### Acceptance Criteria

- [x] Domain models created
- [x] DTO layer created (the mappers never expose `tenantId`)
- [x] Repository interfaces created (no implementation)
- [x] Service interfaces created (no implementation)
- [x] Validation framework configured (Zod 4. All rules from TICKET-009/013 are covered by tests, including boundaries)
- [x] Error handling framework created
- [x] Logging abstraction created (with request correlation)
- [x] Configuration abstraction created
- [x] Test framework configured (73 tests, 99% statements, 100% branches)
- [x] Documentation updated

### Validation Performed

- `npm install` and `npm audit --omit=dev` (0 vulnerabilities)
- `npm run lint` passes
- `npm run build` passes (553 kB bundle)
- `npm test`: 10 files, 73 tests
- The ESLint architecture rules were checked with a deliberate violation (`process.env` and an `@aws-sdk` import in `services/`).
  Both are reported as errors.

### Assumptions

- **Tests location:** tests live in `backend/tests/`, not in `backend/src/tests/`, so test code is never bundled.
- **Logger:** a small built-in logger instead of `pino`, which the ticket allows ("or equivalent"). It needs no
  dependency and covers JSON output, levels and correlation.
- **Validation library:** Zod (recommended by the ticket), pinned to 4.6.5.
- **`completionId`:** the domain name for the stored `historyId`, matching the TICKET-013 response.
  The repository implementation does the mapping.
- **`tenantId`:** comes from configuration (`default`) until SECURITY-004.
- **Analytics DTOs:** `DashboardResponse` and `CompletionMetrics` are initial contracts.
  TICKET-016 and the ANALYTICS domain finalize them.
- **Layout:** `http.ts` moved to `utils/http.ts` to match the requested structure.
