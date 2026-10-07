# TICKET-001A: Establish Tagging and Resource Governance Standards

## Type

Infrastructure

---

## Priority

Critical

---

## Goal

Define and implement mandatory governance standards for all AWS resources created by the Tenner platform.

Every resource created by Terraform must:

- belong to a Tenner Resource Group
- contain a consistent set of mandatory tags
- support cost allocation
- support ownership tracking
- support operational management

No resource may be deployed without mandatory tags.

---

## Requirements

### Resource Group

Create an AWS Resource Group:

```text
Tenner
```

The Resource Group must automatically include all Tenner resources through tag-based inclusion.

---

## Mandatory Tags

Every resource must include the following tags.

```text
Name
Application
Project
Owner
Environment
CreatedBy
Purpose
Description
ManagedBy
Repository
CostCenter
```

---

## Standard Values

### Application

```text
Tenner
```

### Project

```text
Tenner
```

### Owner

```text
Stefan Schmidpeter
```

### ManagedBy

```text
Terraform
```

### CreatedBy

```text
GitHub Actions
```

### Repository

```text
Gh0stbasta/tenner
```

---

## Terraform Implementation

Create shared tagging logic.

Example:

```hcl
locals {
  common_tags = {
    Application = "Tenner"
    Project     = "Tenner"
    Owner       = "Stefan Schmidpeter"
    ManagedBy   = "Terraform"
    CreatedBy   = "GitHub Actions"
    Repository  = "Gh0stbasta/tenner"
    Environment = var.environment
  }
}
```

All future resources must consume:

```hcl
tags = merge(
  local.common_tags,
  {
    Name        = "..."
    Purpose     = "..."
    Description = "..."
  }
)
```

---

## Acceptance Criteria

- Resource Group exists
- Common tagging strategy exists
- All Terraform resources support tags
- Terraform validation succeeds
- Tagging documented in architecture.md

---

## Implementation Status

Implemented: 2026-10-01. It builds on TICKET-002, which already created the Resource Group and common tags.

### Changes

- [x] `CostCenter` tag added to `local.common_tags` (`var.cost_center`, default `Tenner`)
- [x] `local.mandatory_tag_keys`: the single list of all 11 mandatory keys, exposed as output `mandatory_tag_keys`
- [x] `scripts/check_tags.py` enforces the mandatory tags on the saved Terraform plan. It runs in `pr.yml` and in `deploy.yml` (before apply).
- [x] `deploy.yml` now applies the checked plan file (`plan -out=tfplan` → check → `apply tfplan`)
- [x] Tests:
  - `scripts/tests/test_check_tags.py`: 11 unit tests
  - 2 new Terraform tests: tag list, `cost_center` validation
- [x] `docs/architecture.md`: tagging enforcement, `default_tags` decision, cost allocation note

### Acceptance Criteria

- [x] Resource Group exists in code (`Tenner`, tag-based, TICKET-002). Deployed on the first apply after the TICKET-003 bootstrap.
- [x] Common tagging strategy exists (`default_tags` plus per-resource Name/Purpose/Description)
- [x] All Terraform resources support tags. Every taggable resource in the plan carries all 11 tags, verified with a real offline plan.
- [x] Terraform validation succeeds (`fmt`, `validate`; `test` passes 9 tests)
- [x] Tagging documented in `architecture.md`

### Validation Performed

- Generated a real plan offline (scratch copy, fake credentials, local backend) and ran `check_tags.py` on it:
  9 resources planned, and all taggable ones are compliant (exit 0).
- Removed the `Purpose` tag from the resource group in the scratch copy: the checker reported
  `aws_resourcegroups_group.tenner: Purpose` and exited with 1.

### Assumptions

- No `CostCenter` value is defined in this ticket. It defaults to `Tenner` and is configurable with `var.cost_center`.
- `default_tags` is used instead of `merge(local.common_tags, …)` on every resource. The result is the same,
  with less repetition. Documented as a decision in `architecture.md`.
- Activating cost allocation tags in the Billing console is a manual, account-level step (OPERATIONS-001).
