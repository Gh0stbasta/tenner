# TICKET-006: Create DynamoDB Persistence Layer

## Type

Infrastructure

---

## Priority

High

---

## Goal

Provision the DynamoDB persistence layer for the Tenner platform.

This ticket establishes the database foundation required to store:

- Tenners
- Completion History
- Future Analytics Data

The objective is to create a scalable, serverless, low-cost persistence layer while keeping the data model intentionally simple for the MVP.

No business logic should be implemented as part of this ticket.

---

## Background

The following infrastructure is expected to exist:

- CI/CD Pipeline
- Terraform Foundation
- Resource Governance
- Resource Group
- Remote State Backend
- Frontend Hosting
- API Infrastructure

This ticket introduces the first application data layer.

---

# Architecture

```text
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

Future analytics functionality will derive its data from these tables.

---

# Scope

Create the following DynamoDB tables:

```text
tenner-tenners

tenner-history
```

Both tables must be fully managed through Terraform.

---

# Table 1: tenner-tenners

## Purpose

Stores the current state of all Tenners.

---

## Description

Stores recurring responsibilities and their scheduling information.

---

## Billing Mode

```text
PAY_PER_REQUEST
```

---

## Encryption

```text
AWS Managed Encryption
```

Enabled by default.

---

## Point In Time Recovery

```text
Enabled
```

Recovery of accidental writes/deletes.

---

## Primary Key Design

### Partition Key

```text
tenantId
```

Type:

```text
String
```

---

### Sort Key

```text
tennerId
```

Type:

```text
String
```

---

## Example Record

```json
{
  "tenantId": "default",
  "tennerId": "tenner-001",
  "title": "Vacuum Office",
  "category": "household",
  "frequencyDays": 14,
  "estimatedMinutes": 10,
  "assignedTo": "stefan",
  "lastCompleted": "2026-10-01",
  "nextDue": "2026-10-15",
  "active": true
}
```

---

# Table 2: tenner-history

## Purpose

Stores immutable completion history.

---

## Description

Stores every completion event created by users.

Used for:

```text
Analytics

Reporting

Consistency Tracking

Usage History
```

---

## Billing Mode

```text
PAY_PER_REQUEST
```

---

## Encryption

```text
Enabled
```

---

## Point In Time Recovery

```text
Enabled
```

---

## Primary Key Design

### Partition Key

```text
tenantId
```

---

### Sort Key

```text
historyId
```

---

## Example Record

```json
{
  "tenantId": "default",
  "historyId": "completion-123",
  "tennerId": "tenner-001",
  "completedBy": "stefan",
  "completedAt": "2026-10-01T18:45:00Z",
  "actualMinutes": 12
}
```

---

# Future-Proofing Requirements

The design must support future enhancements without table redesign.

Examples:

```text
Multiple Households

Additional Users

Notifications

Analytics

Mobile Application

AI Features
```

---

# Global Secondary Indexes

Create the following indexes.

---

## GSI 1 - Due Tenners

Table:

```text
tenner-tenners
```

Index Name:

```text
nextDue-index
```

Purpose:

```text
Find due and overdue Tenners.
```

---

Partition Key:

```text
tenantId
```

Sort Key:

```text
nextDue
```

---

## GSI 2 - User Assignment

Table:

```text
tenner-tenners
```

Index Name:

```text
assignedTo-index
```

Purpose:

```text
Find Tenners assigned to a specific user.
```

---

Partition Key:

```text
tenantId
```

Sort Key:

```text
assignedTo
```

---

## GSI 3 - Completion History

Table:

```text
tenner-history
```

Index Name:

```text
completedAt-index
```

Purpose:

```text
Support reporting and analytics.
```

---

Partition Key:

```text
tenantId
```

Sort Key:

```text
completedAt
```

---

# Backup & Recovery

Requirements:

```text
Point In Time Recovery Enabled

Deletion Protection Enabled

Terraform Managed
```

---

# Resource Naming

### Table

```text
tenner-tenners
```

Purpose:

```text
Primary Tenner storage.
```

Description:

```text
Stores recurring responsibilities and schedules.
```

---

### Table

```text
tenner-history
```

Purpose:

```text
Completion tracking.
```

Description:

```text
Stores historical execution data.
```

---

# Resource Group

All resources must automatically belong to:

```text
Tenner
```

AWS Resource Group.

Membership must be tag-based.

---

# Tagging Requirements

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

# Outputs

Create Terraform outputs for:

```text
tenner-tenners table name

tenner-tenners table arn

tenner-history table name

tenner-history table arn
```

These outputs will be consumed in future Lambda integrations.

---

# Deliverables

Create:

```text
terraform/dynamodb.tf
```

Update:

```text
terraform/outputs.tf

docs/architecture.md
```

---

# Validation

The following must succeed:

```bash
terraform fmt

terraform validate

terraform plan
```

---

# Acceptance Criteria

- tenner-tenners table created
- tenner-history table created
- PAY_PER_REQUEST enabled
- PITR enabled
- Encryption enabled
- Required GSIs created
- Outputs exposed
- Resource Group membership verified
- Mandatory tags applied
- Terraform validation succeeds

---

# Definition of Done

- Persistence layer deployed
- Future analytics supported
- Future multi-user support possible
- Governance requirements fulfilled
- Lambda integration ready
- Infrastructure deploys through GitHub Actions

---

# Out of Scope

Do not implement:

- CRUD operations
- Lambda database access
- Seed data
- User management
- Authentication
- Analytics calculations

This ticket only provisions the DynamoDB persistence layer.

---

## Implementation Status

Implemented: 2026-10-01.

### Deliverables

- [x] `terraform/dynamodb.tf`: `tenner-tenners` and `tenner-history`
- [x] `terraform/outputs.tf`: name and ARN of both tables
- [x] `terraform/tests/dynamodb.tftest.hcl`: 3 offline tests
- [x] `docs/architecture.md` (Persistence Layer), `README.md`

### Acceptance Criteria

| Criterion | Status |
|---|---|
| tenner-tenners table created | [x] defined and tested. Created on the first deploy |
| tenner-history table created | [x] defined and tested. Created on the first deploy |
| PAY_PER_REQUEST enabled | [x] tested |
| PITR enabled | [x] tested |
| Encryption enabled | [x] SSE with the AWS managed key, tested |
| Required GSIs created | [x] `nextDue-index`, `assignedTo-index`, `completedAt-index` (tested) |
| Outputs exposed | [x] |
| Resource Group membership verified | [x] `Project` default tag. Tag check on the offline plan passes |
| Mandatory tags applied | [x] offline plan: 21 resources, `check_tags.py` compliant |
| Terraform validation succeeds | [x] `fmt`, `validate` (no warnings); `test` passes 18 tests |

### Assumptions

- Deletion protection is required. In addition, Terraform `prevent_destroy` protects against accidental
  removal through code changes.
- GSI projection `ALL`, because the ticket specifies none. Items are small, so this avoids extra reads.
- AWS provider 6.x deprecates `hash_key`/`range_key` inside `global_secondary_index`, so the GSIs use
  `key_schema` blocks. Table keys still use `hash_key`/`range_key`, which are not deprecated.
- No Lambda permissions in this ticket. They come in TICKET-007, according to Out of Scope.
