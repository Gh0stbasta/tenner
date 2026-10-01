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
