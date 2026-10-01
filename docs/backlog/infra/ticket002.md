# TICKET-002: Bootstrap Terraform Foundation

## Type

Infrastructure

---

## Priority

Critical

---

## Goal

Create the foundational Terraform structure for the Tenner platform.

This ticket establishes the Terraform standards, provider configuration, repository structure, tagging framework, resource governance model, and deployment baseline that all future infrastructure will build upon.

No business resources (S3, Lambda, DynamoDB, CloudFront, etc.) should be created as part of this ticket.

---

## Background

Tenner uses:

- AWS
- Terraform
- GitHub Actions
- OIDC-based deployment authentication

The CI/CD pipeline has already been defined in Ticket-001.

All future infrastructure must follow shared tagging and governance standards.

---

## Scope

### Create Terraform Foundation

Establish the complete Terraform project structure.

```text
terraform/

├── providers.tf
├── versions.tf
├── variables.tf
├── locals.tf
├── outputs.tf
├── resource-groups.tf
├── data.tf
│
├── modules/
│
└── environments/
    └── prod/
```

---

## Terraform Version

Define project standards.

Required:

```hcl
terraform {
  required_version = ">= 1.10"
}
```

---

## AWS Provider

Create AWS provider configuration for:

```text
eu-central-1
```

Requirements:

- Default Tags enabled
- Centralized configuration
- Reusable structure

---

## Common Tagging Strategy

Implement centralized tagging through Terraform locals.

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

---

## Default Tag Values

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

## Terraform Locals

Create:

```hcl
locals {
  common_tags = {
    ...
  }
}
```

All future resources must inherit these tags automatically.

---

## AWS Resource Group

Create AWS Resource Group:

```text
Tenner
```

The group must automatically include all resources with:

```text
Project = Tenner
```

No manual assignment allowed.

Membership must be tag-driven.

---

## Naming Standard

Establish naming standards.

Pattern:

```text
tenner-<resource>
```

Examples:

```text
tenner-api

tenner-frontend

tenner-cloudfront

tenner-tenners

tenner-history
```

No random names.

No generated suffixes unless technically required.

---

## State Management Preparation

Design repository structure to support future migration to remote state.

This ticket does not create state resources.

That is handled in Ticket-003.

Requirements:

```text
Backend configuration placeholder

Documented state strategy

Ready for S3 backend integration
```

---

## Documentation Updates

Update:

```text
docs/architecture.md
```

Add sections:

```text
Terraform Standards

Tagging Standards

Naming Standards

Resource Groups

Deployment Standards
```

---

## Validation

The following commands must succeed:

```bash
terraform fmt

terraform validate
```

---

## Deliverables

Create:

```text
terraform/providers.tf

terraform/versions.tf

terraform/variables.tf

terraform/locals.tf

terraform/outputs.tf

terraform/resource-groups.tf

terraform/data.tf
```

Update:

```text
docs/architecture.md
```

---

## Acceptance Criteria

- Terraform project structure exists
- AWS provider configured
- Default tags configured
- Common tags implemented
- AWS Resource Group created
- Naming convention documented
- Tagging convention documented
- Terraform formatting passes
- Terraform validation passes

---

## Definition of Done

- Terraform foundation established
- Resource governance established
- Resource Group deployed
- Shared tagging framework implemented
- Project ready for future infrastructure tickets
- No application resources created yet

---

## Out of Scope

Do not create:

- S3 Buckets
- CloudFront
- Lambda
- API Gateway
- DynamoDB
- Route53
- ACM Certificates
- Monitoring Resources

These will be implemented in later tickets.
``
