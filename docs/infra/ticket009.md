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
