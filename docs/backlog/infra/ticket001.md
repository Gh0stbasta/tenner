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
