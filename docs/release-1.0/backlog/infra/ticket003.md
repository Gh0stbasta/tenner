# TICKET-003: Create Remote Terraform State Backend

## Type

Infrastructure

---

## Priority

Critical

---

## Goal

Create and configure a remote Terraform state backend for the Tenner platform.

The solution must provide:

- Centralized Terraform state storage
- State locking
- State versioning
- Recovery protection
- Governance and tagging compliance

All future Terraform deployments must use this backend.

No local Terraform state files should be used after completion of this ticket.

---

## Background

The Terraform foundation and governance model have already been established.

Before any application infrastructure is deployed, Terraform state management must be centralized to avoid:

- State corruption
- Concurrent modifications
- State loss
- Local developer dependencies

This backend becomes the foundation for all future infrastructure deployments.

---

## Scope

### Create Terraform State S3 Bucket

Provision:

```text
tenner-terraform-state
```

Purpose:

```text
Stores Terraform state files for the Tenner platform.
```

Description:

```text
Remote backend bucket used by Terraform for state management.
```

Requirements:

- Versioning enabled
- Server-side encryption enabled
- Public access blocked
- Lifecycle policy configured
- Fully Terraform managed

---

## Create Terraform Lock Table

Provision:

```text
tenner-terraform-locks
```

Purpose:

```text
Terraform state locking.
```

Description:

```text
Prevents concurrent modifications of Tenner infrastructure.
```

Requirements:

- PAY_PER_REQUEST
- Terraform compatible
- Fully Terraform managed

---

## Tagging Requirements

All resources must include standard Tenner tags.

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

Example values:

```text
Application = Tenner
Project     = Tenner
Owner       = Stefan Schmidpeter
ManagedBy   = Terraform
CreatedBy   = GitHub Actions
Repository  = Gh0stbasta/tenner
Environment = prod
```

---

## Resource Group Membership

All created resources must automatically appear in:

```text
Tenner
```

AWS Resource Group.

Membership must be tag-based.

No manual assignment allowed.

---

## Terraform Backend Configuration

Create backend configuration.

Example target state:

```hcl
terraform {
  backend "s3" {
    bucket         = "tenner-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "tenner-terraform-locks"
    encrypt        = true
  }
}
```

---

## Bootstrap Strategy

Terraform cannot store its own backend before the backend exists.

Document a bootstrap approach.

Expected process:

```text
1. Deploy state bucket and lock table.

2. Configure backend.

3. Migrate local state.

4. Verify remote state operation.

5. Remove local state files from repository.
```

---

## Security Requirements

S3 Bucket:

```text
Encryption enabled.

Public access blocked.

No public policies.

Versioning enabled.
```

DynamoDB:

```text
Encryption enabled.

Terraform locking compatible.
```

---

## Lifecycle Configuration

Create lifecycle policy.

Objectives:

```text
Protect current state.

Retain previous versions.

Reduce unnecessary storage growth.
```

Implementation choice left to engineer.

---

## Deliverables

Create:

```text
terraform/state-backend.tf

terraform/backend.tf
```

Update:

```text
docs/architecture.md

README.md
```

Document:

```text
Terraform state strategy

Bootstrap process

Recovery process
```

---

## Acceptance Criteria

- State bucket created
- Versioning enabled
- Encryption enabled
- Public access blocked
- Lock table created
- Terraform backend configured
- State successfully migrated
- Resource Group membership confirmed
- All governance tags applied
- Terraform validate succeeds

---

## Definition of Done

- Remote state fully operational
- State locking operational
- Local state no longer required
- Documentation updated
- Future infrastructure can safely deploy through GitHub Actions
- Terraform Apply from GitHub Actions successfully uses remote state backend

---

## Out of Scope

Do not create:

- CloudFront
- S3 Frontend Hosting
- Lambda
- API Gateway
- DynamoDB Application Tables
- Route53
- ACM Certificates
- Monitoring Resources

This ticket only establishes state management infrastructure.
``

---

## Implementation Status

Implemented: 2026-10-01. **The bootstrap in AWS is still pending (manual step, see below).**

### Deliverables

- [x] `terraform/state-backend.tf`: state bucket (versioning, SSE-S3, public access block, ownership controls, TLS-only policy, lifecycle) and lock table (`LockID`, PAY_PER_REQUEST, SSE, deletion protection), both with `prevent_destroy`
- [x] `terraform/backend.tf`: S3 backend `tenner-terraform-state`, key `prod/terraform.tfstate`, `dynamodb_table` and `use_lockfile`
- [x] `scripts/bootstrap-state.sh`: bootstrap with dry-run default
- [x] `terraform/tests/state_backend.tftest.hcl`: 4 offline tests
- [x] `docs/architecture.md` (State Management: strategy, bootstrap, recovery) and `README.md` updated

### Acceptance Criteria

| Criterion | Status |
|---|---|
| State bucket created | [x] defined. Created by the bootstrap (pending) |
| Versioning enabled | [x] defined and tested |
| Encryption enabled | [x] defined and tested |
| Public access blocked | [x] defined and tested |
| Lock table created | [x] defined. Created by the bootstrap (pending) |
| Terraform backend configured | [x] `backend.tf` |
| State successfully migrated | [ ] pending: run `scripts/bootstrap-state.sh --apply` |
| Resource Group membership confirmed | [x] via the `Project = Tenner` default tag. [ ] Check in the console after the bootstrap |
| All governance tags applied | [x] default tags plus Name/Purpose/Description (tested) |
| Terraform validate succeeds | [x] |

### Validation Performed

- `terraform fmt -check -recursive`, `terraform validate` and `terraform test` pass: 8 tests
  (4 foundation, 4 state backend).
- `shellcheck` passes for the bootstrap script.
- The local-backend override mechanism of the script was verified offline:
  `init -reconfigure` with `backend_override.tf` uses the local backend.
- Not possible from this environment: creating the resources and migrating state (no AWS credentials).

### Assumptions

- The bootstrap is a manual, one-time step by the account owner with administrator credentials.
  It must not run in CI, because the deploy role should not create its own state bucket.
- Locking: the ticket requires the DynamoDB table. Terraform >= 1.10 recommends `use_lockfile`.
  Both are enabled (TD-010).
- The bucket name `tenner-terraform-state` is taken from the ticket. S3 names are global, so it may
  already be taken. In that case change `locals.tf` and `backend.tf` (TD-011).
- Region and names in `backend.tf` are literals, because Terraform does not allow variables in backend blocks.

### Required Before Merging PR #1

1. Update the trust policy of `GithubActionsDeployRole` (PR subject).
2. Run `scripts/bootstrap-state.sh --apply` locally.
3. Grant `GithubActionsDeployRole` access to the state bucket and lock table (see README "CI Permissions").
4. Re-run the PR workflow: `terraform init` and `plan` must succeed against the remote state.

Until step 2 is done, `terraform init` in CI fails because the bucket does not exist.
