# Architecture Overview

## Project

**Tenner** is a lightweight serverless web application that helps individuals and families stay on top of recurring responsibilities through small, manageable tasks.

The idea is simple:

> If something can be improved in 10 minutes, do a Tenner.

Instead of managing endless todo lists, Tenner focuses on recurring activities that often get neglected because they are not urgent enough to demand attention today.

Examples:

- Vacuum the office
- Clean exterior window sills
- Wash the car
- Change bed sheets
- Mobility workout
- Zone 2 ride
- Date night
- Review finances

A Tenner has a schedule and automatically becomes due again after it has been completed.

The goal is not productivity.

The goal is consistency.

---

# Vision

Tenner should become a simple personal operating system for recurring responsibilities.

Users should never need to ask:

- What should I do next?
- What have I forgotten?
- What hasn't been done for months?

Instead, Tenner should answer:

- What is due today?
- What is overdue?
- What areas of life am I neglecting?
- How consistent am I over time?

The application should work equally well for:

- Household management
- Fitness
- Family activities
- Home ownership
- Personal development
- Administrative tasks

---

# Design Principles

## Ten-Minute First

Most Tenners should be small enough to complete in approximately ten minutes.

Large projects should be split into smaller recurring activities.

Examples:

Instead of:

```text
Clean the entire house
```

Create:

```text
Vacuum office
Clean front door
Wipe exterior window sills
Clean downstairs windows
```

---

## Consistency Over Intensity

The goal is not maximizing output.

The goal is maintaining important responsibilities over long periods of time.

---

## Simplicity First

Life is already complicated.

The system should require almost no maintenance from its users.

---

## Serverless Only

No permanently running infrastructure.

Allowed:

- API Gateway
- Lambda
- DynamoDB
- S3
- CloudFront
- EventBridge
- Cognito

Not Allowed:

- EC2
- ECS
- EKS
- Self-managed databases

---

## Infrastructure as Code

All infrastructure must be provisioned and managed using Terraform.

Manual changes in AWS are not allowed.

Terraform is the single source of truth.

---

## Cost Awareness

Tenner should comfortably run inside AWS free tier or near-zero monthly cost.

The architecture should remain affordable for personal use.

---

## Claude-Friendly Development

The project is intentionally structured so that Claude Code can implement features through small, independent tickets.

Every backlog item should:

- have a single responsibility
- be independently testable
- include acceptance criteria
- minimize dependencies on other tickets

---

# High-Level Architecture

```text
                   GitHub Repository
                           │
                           │
                    GitHub Actions
                           │
                           ▼

                      AWS Account

           ┌────────────────────────────┐
           │                            │
           │         CloudFront         │
           │               │            │
           │               ▼            │
           │              S3            │
           │       React SPA Hosting    │
           │                            │
           └────────────────────────────┘
                           │
                           ▼

                     API Gateway
                           │
                           ▼

                     Lambda API
                           │
               ┌───────────┴───────────┐
               │                       │
               ▼                       ▼

           DynamoDB              CloudWatch
             Tasks                  Logs
            History
```

---

# Technology Stack

## Frontend

### Technologies

- React
- TypeScript
- Vite
- Material UI
- TanStack Query

### Responsibilities

- Today Dashboard
- Upcoming Tenners
- Overdue Tenners
- Task Management
- Analytics
- Settings

---

## Backend

### Technologies

- AWS Lambda
- Node.js
- TypeScript

### Responsibilities

- Task CRUD
- Completion Processing
- Due Date Calculation
- Analytics Aggregation

---

## API Layer

### Technology

- API Gateway REST API

### Initial Endpoints

```text
GET    /health

GET    /tenners
POST   /tenners

GET    /tenners/{id}
PUT    /tenners/{id}
DELETE /tenners/{id}

POST   /tenners/{id}/complete

GET    /dashboard

GET    /analytics
```

---

# Domain Model

## User

Represents a household member.

Examples:

```text
Stefan
Julia
```

Version 1 will support manually configured users only.

No registration process.

No self-service onboarding.

---

## Tenner

Represents a recurring responsibility.

Examples:

```text
Vacuum Office
Wash Car
Mobility Training
Long Zwift Ride
Clean Front Door
```

Properties:

```text
Title
Category
Frequency
Estimated Duration
Assigned User
Active Flag
```

---

## Completion

Represents an execution of a Tenner.

Every completion creates a history entry.

History entries are immutable.

---

# Database Design

## DynamoDB

Two-table approach.

---

## Table: Tenners

Stores current state.

Example:

```json
{
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

## Table: Completion History

Stores all completion events.

Example:

```json
{
  "tennerId": "tenner-001",
  "completedAt": "2026-10-01T18:20:00Z",
  "completedBy": "stefan",
  "actualMinutes": 12
}
```

History is append-only.

No updates.

No deletes.

---

# Scheduling Model

Version 1 intentionally keeps scheduling simple.

Example:

```text
Last Completed:
2026-10-01

Frequency:
14 Days

Next Due:
2026-10-15
```

Calculation:

```text
next_due =
last_completed +
frequency_days
```

Supported frequencies:

```text
Daily
Weekly
Every X Days
Monthly
Quarterly
Yearly
```

No cron expressions.

No advanced scheduling rules.

---

# Dashboard

## Today

Shows all Tenners due today.

Example:

```text
Today's Tenners

□ Vacuum Office
□ Mobility Workout
□ Clean Front Door

Estimated Effort:
30 Minutes
```

---

## Upcoming

Shows Tenners due within the next seven days.

---

## Overdue

Shows Tenners that should already have been completed.

---

## Metrics

Examples:

```text
Completed This Week
Completed This Month

Completion Rate

Time Spent By Category

Time Spent By User

Most Neglected Tenners

Longest Overdue Tenners
```

---

# Security

## MVP

Authentication is intentionally simplified.

Possible approaches:

```text
Single Shared Household Login
```

or

```text
Basic Cognito User Pool
```

Final decision deferred.

Authentication must not delay MVP delivery.

---

## Future

Potential migration:

```text
AWS Cognito
```

Features:

- Multiple households
- Individual accounts
- MFA
- Social Login

---

# Deployment

## Frontend

```text
GitHub Actions
        ↓
Build
        ↓
S3
        ↓
CloudFront
```

---

## Backend

```text
GitHub Actions
        ↓
Build Lambda
        ↓
Terraform Deploy
        ↓
API Gateway
```

---

# CI/CD

## Pull Requests

Run:

```text
terraform fmt

terraform validate

npm lint

npm test

typescript build
```

---

## Main Branch

Run:

```text
frontend build

backend build

terraform plan

terraform apply
```

---

# Repository Structure

```text
tenner/

├── .devcontainer/
│
├── .github/
│   └── workflows/
│
├── docs/
│   ├── architecture.md
│   ├── roadmap.md
│   └── decisions/
│
├── frontend/
│
├── backend/
│
├── terraform/
│
├── backlog/
│
├── CLAUDE.md
│
├── README.md
│
└── LICENSE
```

---

# MVP Definition

The MVP is complete when:

- Tenners can be created
- Tenners can be edited
- Tenners can be assigned
- Tenners support recurring schedules
- Due dates are automatically calculated
- Tenners can be marked as complete
- Completion history is stored
- Dashboard shows due and overdue Tenners
- All infrastructure is deployed using Terraform
- Deployments are automated using GitHub Actions

---
# Deployment Strategy

Tenner uses automated deployments through GitHub Actions.

## Pull Requests

Every pull request must execute:

- Terraform Format Check
- Terraform Validate
- Terraform Plan
- Frontend Build
- Backend Build
- Unit Tests

Pull requests must never execute Terraform Apply.

## Main Branch

Every merge into main automatically deploys the application.

Deployment steps:

1. Assume AWS role using GitHub OIDC
2. Execute Terraform Apply
3. Deploy frontend assets to S3
4. Invalidate CloudFront cache

## Authentication

GitHub Actions authenticates to AWS using OIDC.

No AWS access keys are allowed.

The IAM role used for deployments is:

```text
GithubActionsDeployRole
```

Terraform is the single source of truth for all infrastructure changes.
---

# Terraform Standards

Introduced by TICKET-002.

## Layout

```text
terraform/
├── versions.tf          Terraform and provider version constraints, backend placeholder
├── providers.tf         AWS provider with default tags
├── variables.tf         aws_region (default eu-central-1), environment (default prod)
├── locals.tf            naming prefix, resource group name, common tags
├── data.tf              shared data sources
├── resource-groups.tf   tag-based AWS Resource Group "Tenner"
├── outputs.tf           shared outputs
├── tests/               offline `terraform test` suites (mocked provider)
├── modules/             reusable modules (only when a pattern repeats)
└── environments/prod/   environment-specific configuration (TICKET-003, TICKET-021)
```

## Versions

| Component | Constraint | CI version |
|---|---|---|
| Terraform | `>= 1.10` | `1.16.4` (`TF_VERSION` in workflows) |
| AWS provider | `~> 6.0` | pinned by `terraform/.terraform.lock.hcl` |

The dependency lock file is committed. Provider upgrades happen through a deliberate lock file update.

## Validation

Every pull request runs `terraform fmt -check -recursive`, `terraform validate` and `terraform test`
before AWS authentication. It then runs `terraform plan` with OIDC credentials.

---

# Tagging Standards

Every resource carries these tags:

| Tag | Value | Source |
|---|---|---|
| Application | `Tenner` | provider `default_tags` (`local.common_tags`) |
| Project | `Tenner` | provider `default_tags` |
| Owner | `Stefan Schmidpeter` | provider `default_tags` |
| Environment | `var.environment` (`prod`) | provider `default_tags` |
| CreatedBy | `GitHub Actions` | provider `default_tags` |
| ManagedBy | `Terraform` | provider `default_tags` |
| Repository | `Gh0stbasta/tenner` | provider `default_tags` |
| CostCenter | `var.cost_center` (`Tenner`) | provider `default_tags` |
| Name | resource-specific | resource `tags` |
| Purpose | resource-specific | resource `tags` |
| Description | resource-specific | resource `tags` |

Resources must not redefine the common tags. They only add `Name`, `Purpose` and `Description`.

## Enforcement (TICKET-001A)

No resource may be deployed without the mandatory tags:

1. `local.mandatory_tag_keys` (`terraform/locals.tf`) is the single list of required keys.
   It is exposed as the output `mandatory_tag_keys`.
2. Both workflows save the plan (`-out=tfplan`) and run `scripts/check_tags.py` on its JSON form.
   Any taggable managed resource whose `tags_all` lacks a key, or has an empty value, fails the workflow
   before `terraform apply`.
3. `deploy.yml` applies exactly the checked plan file.

Resource types without tags (for example `aws_s3_bucket_versioning`) are skipped automatically.

## Decision: `default_tags` instead of `merge()`

TICKET-001A shows `tags = merge(local.common_tags, {...})` on every resource. Tenner uses
provider `default_tags = local.common_tags` instead, plus per-resource `Name`/`Purpose`/`Description`.

- **Effect:** the same (`tags_all` contains all keys).
- **Benefits:** less repetition, and a forgotten `merge()` cannot drop the common tags.
- **Trade-off:** the few resource types that ignore provider default tags must be caught by the plan check.

## Cost Allocation

AWS cost allocation by tag only works after the tags are activated as cost allocation tags in the
Billing console (account-level, manual). Activate `Project` and `CostCenter`. This is tracked in OPERATIONS-001.

---

# Naming Standards

```text
tenner-<resource>
```

Examples: `tenner-api`, `tenner-frontend`, `tenner-cloudfront`, `tenner-tenners`, `tenner-history`.

- No random names.
- No generated suffixes unless the resource type technically requires them,
  for example globally unique S3 bucket names.
- The prefix is centralized in `local.name_prefix`.

---

# Resource Groups

The AWS Resource Group `Tenner` (`terraform/resource-groups.tf`) uses a `TAG_FILTERS_1_0` query:

```text
ResourceTypeFilters: AWS::AllSupported
TagFilters:          Project = Tenner
```

Membership is purely tag-driven. Resources are never assigned manually.
Because `Project` is a default tag, every Terraform-managed resource joins the group automatically.

---

# State Management

Introduced by TICKET-003.

## Backend

| Item | Value |
|---|---|
| Backend | S3 (`terraform/backend.tf`) |
| Bucket | `tenner-terraform-state` |
| State key | `prod/terraform.tfstate` |
| Locking | S3 lock file (`use_lockfile`) and DynamoDB table `tenner-terraform-locks` |
| Encryption | SSE-S3 (AES256) on the bucket, `encrypt = true` in the backend |

The state bucket and lock table are defined in the same root configuration
(`terraform/state-backend.tf`). They are protected with `prevent_destroy`, and the table also
with deletion protection. Backend blocks cannot use variables, so `backend.tf` repeats the
names as literals. A test and a comment keep them in sync with `locals.tf`.

## Bucket Protection

- Versioning is enabled, and all public access is blocked.
- ACLs are disabled (`BucketOwnerEnforced`). A bucket policy denies requests without TLS.
- Lifecycle rules:
  - The current state version never expires.
  - Previous versions are kept for 90 days, and the 10 newest are always kept.
  - Incomplete multipart uploads are aborted after 7 days.

## Locking Decision

TICKET-003 requires a DynamoDB lock table. Terraform 1.10+ supports native S3 locking (`use_lockfile`),
and DynamoDB-based locking is deprecated. Both are enabled during the transition.
The table can be removed once S3 locking is proven (TD-010).

## Bootstrap

`scripts/bootstrap-state.sh` runs once per AWS account, with administrator credentials:

```text
1. Temporary local backend (git-ignored backend_override.tf)
2. terraform apply -target=<state bucket and lock table resources>
3. Remove override, terraform init -migrate-state (local → S3)
4. terraform state list (verify), delete local state files
```

Without `--apply` the script only plans. If the bucket already exists, it refuses to run.

## Recovery

- **Corrupted or wrong state:** restore a previous object version of `prod/terraform.tfstate`
  in the S3 console or with `aws s3api`, for example by copying the previous version over the current one.
- **Stuck lock:** after making sure no apply is running, use `terraform force-unlock <LOCK_ID>`.
- State files are never committed (`.gitignore`).

---

# Deployment Standards

- Infrastructure changes are applied only by `.github/workflows/deploy.yml` on `main`, using GitHub OIDC.
- Pull requests only validate, test and plan. They never apply.
- No manual changes in AWS. Terraform is the single source of truth.

---

# API Runtime

Introduced by TICKET-005.

```text
Client → API Gateway HTTP API (tenner-api-gateway, stage prod)
       → Lambda tenner-api (Node.js 22, arm64, 256 MB, 10 s)
       → CloudWatch Logs (/tenner/api, JSON)
```

| Resource | Name | Notes |
|---|---|---|
| Lambda | `tenner-api` | handler `index.handler`, bundle `backend/dist/index.mjs`, env `ENVIRONMENT`, `LOG_LEVEL`, `APPLICATION_NAME` |
| Execution role | `tenner-api-role` | `logs:CreateLogStream` and `logs:PutLogEvents` on `/tenner/api` only |
| HTTP API | `tenner-api-gateway` | route `GET /health`, Lambda proxy integration, payload format 2.0 |
| Stage | `prod` (`var.environment`) | auto deploy, JSON access logs to `/tenner/api/access` |
| Log groups | `/tenner/api`, `/tenner/api/access` | retention `var.log_retention_days` (default 30) |

## Decisions

- **HTTP API instead of REST API:** lower cost and latency, and simpler. No REST-only features are needed.
- **One Lambda function for all routes:** routes are registered explicitly per route key, with no `$default`
  catch-all. The function routes internally by `routeKey`.
- **Custom log group:** Lambda logs go to `/tenner/api` through `logging_config` instead of
  `/aws/lambda/tenner-api`. The group is Terraform-managed, with retention and tags.
- **Packaging:** esbuild bundles the code into one ESM file. Terraform zips it with `archive_file`, and
  `source_code_hash` triggers a redeploy when the code changes. The AWS SDK v3 is provided by the runtime
  and is not bundled.
- **Invoke permission:** limited to this API (`execution_arn/*/*`).

## Not Yet Included

Authentication (SECURITY-002), throttling (SECURITY-005), CORS (TICKET-017), alarms (OBSERVABILITY-002).

---

# Future Ideas

Out of scope for MVP.

## Notifications

- Telegram
- WhatsApp
- Email
- Push Notifications

## Smart Scheduling

Examples:

- Prefer weekends
- Avoid workdays
- Family balance

## Integrations

- Garmin
- Strava
- Zwift

## Mobile App

Potential React Native client.

## AI Assistant

Examples:

```text
What should I spend 20 minutes on today?

Which Tenners are most overdue?

What habits have I neglected recently?
```
