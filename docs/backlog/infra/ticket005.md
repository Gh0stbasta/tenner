# TICKET-005: Create API Foundation Infrastructure

## Type

Infrastructure

---

## Priority

High

---

## Goal

Provision the complete backend runtime foundation for the Tenner platform.

This ticket establishes the serverless API infrastructure that will host all future Tenner business logic.

The objective is to create a secure, scalable, fully serverless API platform without implementing any actual application functionality.

At the end of this ticket a working health endpoint must be accessible through API Gateway and Lambda.

---

## Background

The following infrastructure is expected to exist:

- CI/CD Pipeline
- Terraform Foundation
- Resource Group
- Tagging Framework
- Remote State Backend
- Frontend Hosting Infrastructure

This ticket provisions the backend runtime layer.

No Tenner business logic should be implemented yet.

---

## Scope

Provision:

```text
Lambda Function

Lambda IAM Execution Role

API Gateway

CloudWatch Log Groups

CloudWatch Log Retention

API Gateway Stage
```

---

## Architecture

```text
Client
  │
  ▼

CloudFront
  │
  ▼

API Gateway
  │
  ▼

Lambda
  │
  ▼

CloudWatch Logs
```

Future DynamoDB integration will be added in a separate ticket.

---

## Resource Naming

### Lambda Function

```text
tenner-api
```

Purpose:

```text
Tenner backend API runtime.
```

Description:

```text
Processes all Tenner API requests.
```

---

### Lambda Role

```text
tenner-api-role
```

Purpose:

```text
Lambda execution permissions.
```

Description:

```text
Provides runtime access for Tenner backend functions.
```

---

### API Gateway

```text
tenner-api-gateway
```

Purpose:

```text
Public API endpoint for Tenner.
```

Description:

```text
Routes HTTP requests to backend services.
```

---

### CloudWatch Log Group

```text
/tenner/api
```

Purpose:

```text
Application logging.
```

Description:

```text
Stores operational and application logs for Tenner API.
```

---

## Lambda Requirements

### Runtime

```text
Node.js 22.x
```

Use latest supported Lambda runtime.

---

### Architecture

```text
arm64
```

Preferred for lower cost.

---

### Memory

Initial configuration:

```text
256 MB
```

---

### Timeout

Initial configuration:

```text
10 Seconds
```

---

### Environment Variables

Prepare support for:

```text
ENVIRONMENT

LOG_LEVEL

APPLICATION_NAME
```

Values:

```text
ENVIRONMENT=prod

LOG_LEVEL=INFO

APPLICATION_NAME=Tenner
```

---

## API Gateway Requirements

### Type

```text
HTTP API
```

Use HTTP API unless a clear requirement exists for REST API features.

Goal:

```text
Lower cost

Lower latency

Simpler configuration
```

---

### Stage

```text
prod
```

Auto deploy enabled.

---

## Health Endpoint

Create:

```text
GET /health
```

Expected response:

```json
{
  "status": "ok",
  "application": "tenner",
  "environment": "prod"
}
```

---

## Logging Requirements

Enable:

```text
Lambda Logs

API Gateway Access Logs
```

---

## Retention Policy

CloudWatch log retention:

```text
30 Days
```

Configurable through Terraform variable.

---

## IAM Requirements

### Lambda Execution Role

Follow least privilege principles.

Initially allow:

```text
CloudWatch Logs
```

Only.

Do not add DynamoDB permissions.

Do not add S3 permissions.

Do not add wildcard administrative permissions.

Future permissions will be added as needed.

---

## Monitoring Outputs

Create Terraform outputs for:

```text
API Endpoint URL

API Gateway ID

Lambda Function ARN

Lambda Function Name
```

---

## Resource Group Membership

All resources must automatically belong to:

```text
Tenner
```

AWS Resource Group.

Membership must be tag-driven.

---

## Tagging Requirements

Every resource must include standard Tenner tags.

Required tags:

```text
Name
Application
Project
Owner
Environment
CreatedBy
ManagedBy
Repository
Purpose
Description
```

Standard values:

```text
Application = Tenner
Project     = Tenner
Owner       = Stefan Schmidpeter
CreatedBy   = GitHub Actions
ManagedBy   = Terraform
Repository  = Gh0stbasta/tenner
Environment = prod
```

---

## Deliverables

Create:

```text
terraform/api.tf

terraform/iam.tf

terraform/logging.tf
```

Update:

```text
terraform/outputs.tf

docs/architecture.md
```

---

## Validation

The following must succeed:

```bash
terraform fmt

terraform validate

terraform plan
```

---

## Acceptance Criteria

- Lambda function created
- Lambda role created
- API Gateway created
- Health endpoint available
- CloudWatch logs enabled
- Log retention configured
- Resource Group membership verified
- Mandatory tags applied
- Outputs exposed
- Terraform validation succeeds

---

## Definition of Done

- API runtime infrastructure exists
- Health endpoint responds successfully
- Logging operational
- Governance requirements fulfilled
- Infrastructure deploys through GitHub Actions
- Ready for DynamoDB integration in the next ticket

---

## Out of Scope

Do not implement:

- DynamoDB tables
- CRUD operations
- Authentication
- Cognito
- Business logic
- Tenner domain model
- Frontend integration

These will be implemented in later tickets.

---

## Implementation Status

Implemented: 2026-10-01.

### Deliverables

- [x] `terraform/api.tf`: Lambda `tenner-api`, HTTP API `tenner-api-gateway`, Lambda proxy integration, route `GET /health`, stage `prod` (auto deploy, access logs), invoke permission limited to this API
- [x] `terraform/iam.tf`: `tenner-api-role`. It trusts only `lambda.amazonaws.com`, with an inline policy for logs only
- [x] `terraform/logging.tf`: `/tenner/api` (Lambda, JSON) and `/tenner/api/access` (API Gateway), retention `var.log_retention_days` (default 30)
- [x] `terraform/outputs.tf`: `api_endpoint`, `api_gateway_id`, `api_lambda_function_arn`, `api_lambda_function_name`
- [x] `backend/`: TypeScript project with handler, router and health endpoint; esbuild bundle, Vitest, ESLint
- [x] Workflows: the Terraform job builds the Lambda bundle before `plan`. `deploy.yml` calls `GET /health` after apply.
- [x] `docs/architecture.md` (API Runtime), `README.md`, `backend/README.md`

### Acceptance Criteria

| Criterion | Status |
|---|---|
| Lambda function created | [x] defined and tested. Created on the first deploy |
| Lambda role created | [x] defined and tested |
| API Gateway created | [x] defined and tested |
| Health endpoint available | [x] route and handler. The response was verified against the bundled handler locally. Live check runs in `deploy.yml` |
| CloudWatch logs enabled | [x] Lambda (JSON) and API access logs |
| Log retention configured | [x] 30 days, configurable and validated |
| Resource Group membership verified | [x] via the `Project` default tag. All taggable resources pass the tag check |
| Mandatory tags applied | [x] offline plan: 19 resources, `check_tags.py` reports compliant |
| Outputs exposed | [x] |
| Terraform validation succeeds | [x] `fmt`, `validate`; `test` passes 15 tests |

### Validation Performed

- `backend`: `npm run lint` passes. `npm test` passes 9 tests with 100% coverage. `npm run build` type-checks and bundles 1.9 kB.
- The bundled `dist/index.mjs` was invoked with Node 22: `GET /health` returns 200 with the specified body,
  and an unknown route returns 404.
- Terraform: `fmt`, `validate` and `test` pass (15 tests: 6 new for the API).
- Offline end-to-end plan with a real archive of the bundle and fake credentials: 19 resources, tag check passes,
  and the zip contains `index.mjs`.
- `actionlint` passes.

### Assumptions

- Background lists "Frontend Hosting Infrastructure" as existing, but it is not (it is TICKET-017).
  The API does not depend on it. CORS is added together with frontend hosting.
- Lambda logs go to the custom group `/tenner/api` (`logging_config`), so the ticket's log group name is used
  instead of `/aws/lambda/tenner-api`.
- Health response `application` is `APPLICATION_NAME` in lowercase (`tenner`), matching the expected response.
- New dev dependencies, pinned to exact versions:
  - `typescript`, `esbuild` (bundling)
  - `vitest`, `@vitest/coverage-v8` (preferred by TICKET-008)
  - `eslint`, `@eslint/js`, `typescript-eslint` (required by the `npm lint` step in architecture.md)
  - `@types/aws-lambda`, `@types/node`
  - There are no runtime dependencies.
- A new Terraform provider, `hashicorp/archive` `~> 2.7`, is used to package the bundle. It is recorded in the lock file.
- The deploy role needs additional permissions (Lambda, API Gateway, Logs, IAM role management, `iam:PassRole`).
  These are documented in the README and are an external prerequisite.

### Not Yet Verified

- [ ] Live `GET /health` through API Gateway. This runs automatically in `deploy.yml` after the first deploy.
