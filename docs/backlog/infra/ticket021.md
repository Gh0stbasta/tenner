# TICKET-021: Introduce Environment Separation

## Type

Infrastructure

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Introduce a separate non-production environment so that changes can be verified
before they reach the household's production data.

Target environments:

```text
dev
prod
```

---

# Background

All infrastructure is currently deployed into a single environment on every merge to `main`.

As features such as notifications, integrations and authentication are introduced,
a broken deployment directly affects daily household usage.

The tagging standard already defines an `Environment` tag (TICKET-001A) and resource
names already include environment suffixes where applicable.

---

# Dependencies

```text
TICKET-001
TICKET-003
TICKET-017
TICKET-018
```

---

# Scope

## Terraform

Parameterize all stacks by:

```text
var.environment
```

Use separate state keys per environment:

```text
tenner/dev/terraform.tfstate
tenner/prod/terraform.tfstate
```

Do not use Terraform workspaces unless justified; separate state keys with
per-environment `tfvars` files are preferred for clarity.

---

## Deployment Flow

```text
Merge to main
        ↓
Deploy dev
        ↓
Smoke tests (OPERATIONS-006, when available)
        ↓
Manual approval (GitHub Environment protection rule)
        ↓
Deploy prod
```

Use GitHub Environments:

```text
dev
prod
```

`prod` requires a reviewer approval.

---

## Data Isolation

Each environment has its own:

```text
DynamoDB tables
S3 frontend bucket
CloudFront distribution
Lambda functions
API Gateway
Log groups
```

No environment may read another environment's data.

---

## Cost

Dev uses the same pay-per-request services and should remain near zero cost.

Document expected cost in `docs/architecture.md`.

---

# Deliverables

```text
Environment-specific tfvars

Backend state configuration per environment

Updated deploy workflow with GitHub Environments

docs/architecture.md (environment model)

README.md (how to deploy each environment)
```

---

# Validation

```bash
terraform fmt -check

terraform validate

terraform plan -var-file=env/dev.tfvars

terraform plan -var-file=env/prod.tfvars
```

Production plan must show **no changes** for existing resources after migration.
If resources would be replaced, stop and document a migration plan first.

---

# Migration Safety

Existing production resources must not be destroyed or recreated.

Use `terraform state mv` or `moved` blocks where addresses change.

Approval is required before applying any change that affects production state.

---

# Acceptance Criteria

- dev and prod environments exist
- Separate Terraform state per environment
- Merge to main deploys dev automatically
- prod deployment requires manual approval
- Environments are fully isolated
- Existing production resources were not recreated
- Documentation updated

---

# Definition of Done

- Changes are verifiable before production
- Production data is protected from test deployments
- Pipeline runs successfully for both environments

---

# Out of Scope

Do not implement:

- Per-pull-request preview environments
- Separate AWS accounts per environment
- Data synchronization between environments
