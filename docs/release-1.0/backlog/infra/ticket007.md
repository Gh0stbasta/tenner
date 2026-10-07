# TICKET-007: Integrate Lambda with DynamoDB

## Type

Infrastructure / Backend Foundation

---

## Priority

High

---

## Goal

Connect the Tenner API Lambda to the DynamoDB persistence layer and establish the application's data access foundation.

After completion of this ticket:

- Lambda can access DynamoDB
- IAM permissions are configured
- Table configuration is injected through environment variables
- Backend is able to read and write data
- Health endpoint includes DynamoDB connectivity verification

No Tenner business endpoints should be implemented yet.

---

## Background

The following infrastructure already exists:

- CI/CD Pipeline
- Terraform Foundation
- Resource Governance
- Remote State Backend
- Frontend Hosting
- API Infrastructure
- DynamoDB Persistence Layer

This ticket establishes the connection between the application runtime and the data layer.

---

# Architecture

```text
Client
   │
   ▼

API Gateway
   │
   ▼

Lambda
   │
   ▼

DynamoDB

 ├─ tenner-tenners
 │
 └─ tenner-history
```

---

# Scope

Configure:

```text
Lambda Environment Variables

Lambda IAM Permissions

DynamoDB Access

Connectivity Verification
```

No CRUD operations.

No domain logic.

No data mutations beyond connectivity testing.

---

# Lambda Environment Variables

Expose DynamoDB table names through Terraform.

Required variables:

```text
TENNERS_TABLE

HISTORY_TABLE

ENVIRONMENT

APPLICATION_NAME
```

Example:

```text
TENNERS_TABLE=tenner-tenners

HISTORY_TABLE=tenner-history

ENVIRONMENT=prod

APPLICATION_NAME=Tenner
```

Lambda code must consume table names through environment variables.

Hardcoded table names are not permitted.

---

# IAM Permissions

Update:

```text
tenner-api-role
```

Grant minimum permissions required for DynamoDB access.

---

## Allowed Actions

### Table Access

```text
dynamodb:GetItem

dynamodb:PutItem

dynamodb:UpdateItem

dynamodb:DeleteItem

dynamodb:Query

dynamodb:Scan
```

---

## Resource Scope

Permissions must be restricted to:

```text
tenner-tenners

tenner-history
```

Only.

Wildcard access is not permitted.

Example:

```text
Resource = [
  tenner-tenners ARN,
  tenner-history ARN
]
```

---

# Lambda Configuration

Update Lambda deployment package to include:

```text
AWS SDK v3

DynamoDB Client

Structured Logging
```

Preferred packages:

```text
@aws-sdk/client-dynamodb

@aws-sdk/lib-dynamodb
```

---

# DynamoDB Health Check

Enhance:

```text
GET /health
```

Endpoint must validate:

```text
Lambda Runtime Status

DynamoDB Connectivity

Environment Configuration
```

---

## Expected Response

```json
{
  "status": "ok",
  "application": "tenner",
  "environment": "prod",
  "database": "connected"
}
```

---

## Failure Response

```json
{
  "status": "error",
  "database": "unreachable"
}
```

Response details may vary.

Purpose is operational verification.

---

# Data Access Layer

Create reusable DynamoDB abstraction.

Suggested structure:

```text
backend/src/

├── clients/
│   └── dynamodb.ts
│
├── repositories/
│   └── base.repository.ts
│
└── handlers/
    └── health.ts
```

Objective:

Separate infrastructure concerns from future business logic.

---

# Logging Requirements

Log on startup:

```text
Environment

Application Name

Configured Tables
```

Do not log:

```text
Credentials

AWS Tokens

Request Payloads containing sensitive data
```

---

# Outputs

Expose Terraform outputs:

```text
Tenner Table ARN

History Table ARN

Lambda Role ARN
```

These outputs will be consumed by later tickets.

---

# Resource Governance

All modifications must continue to comply with:

```text
Tenner Naming Standards

Tenner Resource Group

Mandatory Tagging Standards
```

---

# Documentation

Update:

```text
docs/architecture.md
```

Add:

```text
Persistence Layer Architecture

Lambda → DynamoDB Integration

IAM Strategy

Environment Variable Strategy
```

---

# Deliverables

Update:

```text
terraform/api.tf

terraform/iam.tf

terraform/outputs.tf
```

Create:

```text
backend/src/clients/dynamodb.ts
```

Update:

```text
backend/src/handlers/health.ts
```

Update:

```text
docs/architecture.md
```

---

# Validation

The following must succeed:

```bash
terraform fmt

terraform validate

terraform plan

npm run build

npm test
```

---

# Acceptance Criteria

- Lambda can access DynamoDB
- Environment variables configured
- IAM policy follows least privilege
- Health endpoint verifies database connectivity
- No wildcard DynamoDB permissions
- Terraform validation succeeds
- Application build succeeds
- Documentation updated

---

# Definition of Done

- Lambda connected to DynamoDB
- IAM permissions correctly configured
- Database connectivity verifiable
- Reusable data access foundation established
- Infrastructure deploys through GitHub Actions
- Ready for CRUD implementation tickets

---

# Out of Scope

Do not implement:

- Create Tenner API
- Update Tenner API
- Delete Tenner API
- Completion History API
- Analytics API
- Authentication
- Frontend Integration

This ticket only establishes the connection between Lambda and DynamoDB.

---

## Implementation Status

Implemented: 2026-10-01.

### Deliverables

- [x] `terraform/api.tf`: `TENNERS_TABLE` and `HISTORY_TABLE` passed to Lambda from the table resources
- [x] `terraform/iam.tf`: policy `tenner-api-role-dynamodb` (6 actions, the two tables and their indexes)
- [x] `terraform/outputs.tf`: `api_lambda_role_arn`. The table ARNs already exist from TICKET-006.
- [x] `backend/src/clients/dynamodb.ts`: shared DocumentClient and `probeTables` (GetItem probe, timeout)
- [x] `backend/src/handlers/health.ts`: DynamoDB connectivity and configuration check
- [x] `backend/src/utils/logger.ts`: structured logger. The startup log contains environment, application and tables.
- [x] `terraform/tests/iam.tftest.hcl`: policy content tests. The API test now also checks the environment variables.
- [x] `docs/architecture.md`: Lambda → DynamoDB integration, IAM strategy, environment variable strategy

### Acceptance Criteria

| Criterion | Status |
|---|---|
| Lambda can access DynamoDB | [x] IAM and client in place. Locally verified against a fake DynamoDB endpoint: the bundled handler sends correct `GetItem` calls to both tables and returns 200 `connected`. Live check runs in `deploy.yml` |
| Environment variables configured | [x] tested in Terraform and in the offline plan |
| IAM policy follows least privilege | [x] only the ticket's actions on the two tables and their indexes |
| Health endpoint verifies database connectivity | [x] `connected` / `unreachable` (503) / `misconfigured` (503) |
| No wildcard DynamoDB permissions | [x] tested. A mutation check with `dynamodb:*` or `"*"` makes the test fail |
| Terraform validation succeeds | [x] `fmt`, `validate`; `test` passes 20 tests |
| Application build succeeds | [x] lint, 22 tests (statements 98%, branches 100%), build |
| Documentation updated | [x] |

### Assumptions

- Query on GSIs needs the index ARNs. The resource list therefore includes `<table-arn>/index/*` for both tables.
  This is still scoped to the two tables, not a wildcard across tables.
- `Scan` is granted because the ticket lists it explicitly. Later business tickets should avoid it (TICKET-010 uses Query).
- The health probe uses `GetItem` on a non-existent key instead of `DescribeTable`, because `DescribeTable`
  is not in the allowed action list. It is cheap, read-only and returns no data.
- `base.repository.ts` (suggested structure) was not created. Without any repository it would be an
  abstraction without users. TICKET-008 creates the repository layer.
- The AWS SDK v3 is bundled (as the ticket asks) and minified, which gives a 552 kB bundle.
  `keepNames` keeps stack traces readable.

### Not Yet Verified

- [ ] Live `/health` with `database: connected` after the first deploy (runs automatically in `deploy.yml`).
