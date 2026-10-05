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
- Billing features without runtime: AWS Budgets, Cost Anomaly Detection ([ADR 0003](decisions/0003-cost-monitoring.md))

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

### Expected Monthly Cost (OPERATIONS-001, eu-central-1, one household)

Assumption: about 10,000 API requests, a few hundred writes and a few MB of logs per month.

| Service | Usage | Expected cost |
|---|---|---|
| API Gateway HTTP API | ~10,000 requests (1.20 USD per million) | < 0.02 USD |
| Lambda (arm64, 256 MB) | ~10,000 invocations; always-free tier 1M requests / 400,000 GB-s | 0 USD |
| DynamoDB on-demand + PITR | a few hundred writes, < 1 MB data | < 0.01 USD |
| S3 (frontend, state) | a few MB, a few hundred requests | < 0.01 USD |
| CloudFront | always-free tier 1 TB / 10M requests | 0 USD |
| CloudWatch Logs | a few MB ingestion and storage, 30-day retention | < 0.01 USD |
| Cognito (Essentials) | 10,000 MAU free | 0 USD |
| AWS Budgets, Cost Anomaly Detection | first two budgets free; anomaly detection free | 0 USD |
| **Total** | | **< 0.10 USD per month** |

Monitoring: a 5 USD monthly budget with alerts at 50 %, 80 % and 100 % forecast plus a daily anomaly summary
(`terraform/costs.tf`). Worst case under abuse is capped by throttling at about 2–3 USD per day (SECURITY-014).

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

Calculation (SCHEDULING-001):

```text
next_due = calculateNextDue(local date(last_completed), frequency_unit, frequency_interval)
```

Supported frequencies, stored as a unit plus an interval:

```text
Daily        → DAY,   1
Weekly       → WEEK,  1
Every X Days → DAY,   X
Monthly      → MONTH, 1
Quarterly    → MONTH, 3
Yearly       → YEAR,  1
```

Any interval up to 10 years is allowed (e.g. every 2 weeks, every 6 months).

## Scheduling Model (SCHEDULING-001)

- `frequencyUnit` (`DAY`, `WEEK`, `MONTH`, `YEAR`) and `frequencyInterval` (≥ 1) define the recurrence.
- `calculateNextDue` (`backend/src/utils/schedule.ts`) is the only function that derives a due date from a frequency.
  Complete and Undo use it.
- DAY and WEEK add exact days. MONTH and YEAR keep the calendar day and clamp to the last day of the target
  month: `2026-01-31 + 1 MONTH → 2026-02-28`, `2028-01-31 + 1 MONTH → 2028-02-29`,
  `2028-02-29 + 1 YEAR → 2029-02-28`. Each step starts from the actual completion date, so a monthly Tenner
  completed on the 31st and then on the 28th continues from the 28th (completion-based recurrence).
- `frequencyDays` is kept for compatibility and analytics: exact for DAY/WEEK, an approximation for MONTH/YEAR
  (30/365 per unit). It is never used for due dates.
- API: clients send either `frequencyDays` (→ DAY, interval = days; the pre-SCHEDULING-001 form) or
  `frequencyUnit` + `frequencyInterval`, never both. The validator normalizes the request to all three fields.
- Migration: none required. Items without `frequencyUnit` are read as DAY with `frequencyInterval = frequencyDays`.
  `scripts/backfill_frequency_unit.py` optionally writes these values (dry run by default, conditional and
  idempotent).
- Changing the frequency does not move `nextDue`; it applies from the next completion.

No cron expressions.

No weekday rules (SCHEDULING-002) and no fixed-schedule (non-completion-based) recurrence.

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

The consolidated baseline (controls, trust boundaries, IAM review, residual risks) is in
[`security.md`](security.md) (SECURITY-005).

## Authentication (ADR 0001)

Decided in [`decisions/0001-authentication.md`](decisions/0001-authentication.md) (SECURITY-001), amended by
[`decisions/0002-google-sign-in.md`](decisions/0002-google-sign-in.md) (FUTURE-011):

- Amazon Cognito User Pool (Essentials tier), **one account per household member**, no password sign-up.
- Sign-in **only with Google** (Cognito federation, Authorization Code flow with PKCE, public SPA client).
  Anyone with a Google account can sign in; household access requires a Cognito group
  `household:<tenantId>:<userId>`. On the first login the user picks a household member; each member can be
  claimed by one account only (HOTFIX-001, ADR 0002 amendment).
- The API Gateway JWT authorizer protects every route except `GET /health`. The browser sends the
  Cognito **ID token** because it carries `cognito:groups`.
- The backend derives tenant and acting user only from verified claims (SECURITY-004).
- Tokens are kept in `localStorage` for up to 30 days (refresh token), so a device stays logged in.

Implementation: SECURITY-002 (infrastructure), SECURITY-003 (frontend), SECURITY-004 (backend),
FUTURE-011 (Google sign-in, groups).

### Infrastructure (SECURITY-002, `terraform/auth.tf`)

```text
Browser ──(Authorization Code + PKCE, identity_provider=Google)──► Cognito  tenner-prod-<hash>.auth.eu-central-1.amazoncognito.com
   │                                          │  ▲
   │                                          ▼  │ (OIDC, client ID + secret)
   │                                       Google accounts
   │◄──────────── ID token (cognito:groups), refresh token ────┘
   │
   └── Authorization: Bearer <ID token> ──► API Gateway JWT authorizer (issuer = user pool, audience = app client)
                                                   └── Lambda tenner-api (claim: cognito:groups → household:<tenantId>:<userId>)
```

| Resource | Settings |
|---|---|
| `aws_cognito_user_pool.users` (`tenner-users-prod`) | Essentials tier, admin-only sign-up, e-mail username, password ≥ 12, deletion protection, custom attributes `tenantId` (immutable) and `userId` |
| `aws_cognito_user_pool_client.web` (`tenner-web-prod`) | public client, code flow + PKCE, scopes `openid email`, identity provider Google only, auth flow refresh token only (no passwords), callback `https://<cloudfront>/auth/callback`, tokens 60 min, refresh 30 days, revocation on, cannot write custom attributes |
| `aws_cognito_identity_provider.google` | Google, scopes `openid email profile`, maps `email` and `username = sub`; client ID/secret from `var.google_client_id` / `var.google_client_secret` (GitHub variable/secret) |
| `aws_cognito_user_group.household` | `household:default:STEFAN`, `household:default:JULIA` |
| `aws_iam_role_policy.api_cognito` | API Lambda may add/remove the caller to/from household groups and read group membership on this pool only (HOTFIX-001, TD-023) |
| `aws_cognito_user_pool_domain.login` | managed login v2, prefix `tenner-prod-<first 8 hex of sha1(account id)>` |
| `aws_apigatewayv2_authorizer.cognito` | JWT authorizer on every route except `GET /health` (`local.api_public_routes`) |

The CloudFront CSP allows `connect-src` to `cognito-idp.eu-central-1.amazonaws.com` (discovery, JWKS) and the
managed login domain (token endpoint). Outputs: `cognito_user_pool_id`, `cognito_client_id`, `cognito_issuer_url`,
`cognito_login_url`, `cognito_google_redirect_uri`, `cognito_household_groups`. Users are created by Cognito on
their first Google sign-in and pick their household member in the app (README → "Google Sign-In and User
Accounts"). The redirect to Google is a top-level navigation and needs no CSP change.

### Authorization Model (SECURITY-004, FUTURE-011, `backend/src/auth/identity.ts`)

```text
API Gateway JWT authorizer (signature, issuer, audience, expiry)
  ↓ requestContext.authorizer.jwt.claims
identityFromEvent → Identity from the one group "household:<tenantId>:<userId>" in cognito:groups
  ↓
handlers / services → repositories (every key and query uses identity.tenantId)
```

- **Tenant and acting user:** only from the household group in `cognito:groups`. Groups are assigned by an
  administrator only (users cannot change their groups). There is no default tenant and no tenant parameter;
  client-supplied `tenantId` fields are rejected (strict schemas) or ignored (headers). The user must be a
  household member (`STEFAN` or `JULIA`). The HTTP API passes the array claim as a string `"[a b]"`; both forms
  are accepted.
  - `completedBy` defaults to the acting user. Another member is allowed (covering for someone); the completion
    then also stores `recordedBy` = acting user.
  - `revertedBy` and `restoredBy` are the acting user; a different value returns 403.
  - `createdBy` / `updatedBy` on Tenners are set on every write.
- **Errors:** no claims → `401 UNAUTHORIZED`; signed in without exactly one valid household group → `403 FORBIDDEN`
  (403, because a new token would not help and the frontend treats 401 as "log in again").
- **Permissions inside a household:** every member may read and change every Tenner of the household.
  Roles are out of scope (HOUSEHOLD-ADMIN-005).
- Records written before authentication have `null` audit fields (TD-019).

#### First-login self-assignment (HOTFIX-001)

```text
Signed in, no household group → GET /onboarding (principal = cognito:username)
  → member chosen → POST /onboarding/assignment
      account already in a household group → 409 ALREADY_ASSIGNED
      member already has an account        → 409 MEMBER_TAKEN
      AdminAddUserToGroup → re-count; >1 member → withdraw, 409 MEMBER_TAKEN
  → frontend refreshes the session (refresh token) → ID token with the group → dashboard
```

The onboarding routes need a verified token (`cognito:username`) but no household; every other route still
needs exactly one household group.

## Future

- MFA (SECURITY-011)
- Sign in with Apple (FUTURE-011 follow-up)
- Multiple households (FUTURE-001): new groups `household:<tenantId>:<userId>` per household, no data migration

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
GitHubActionsDeployRole
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
   before `terraform apply`. The check also rejects tag keys and values with characters outside the
   common AWS tag set (letters, numbers, whitespace and `_ . : / = + - @`). S3 enforces this set
   strictly; a comma in a tag broke the first deployment (TICKET-023).
3. `deploy.yml` applies exactly the checked plan file.

Resource types without tags (for example `aws_s3_bucket_versioning`) are skipped automatically.

Description fields of resources (not tags) follow per-service rules that the tag check does not
cover. The resource group description is guarded by a Terraform test (TICKET-023).

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

## Throttling (SECURITY-014)

The `prod` stage throttles every route through `default_route_settings`:

| Variable | Default | Meaning |
|---|---|---|
| `api_throttling_burst_limit` | 20 | Maximum burst of concurrent requests |
| `api_throttling_rate_limit` | 10 | Steady-state requests per second |

Requests above the limit get HTTP 429 from API Gateway. They never invoke Lambda or DynamoDB.

**Worst-case cost:** without throttling, only the account-wide Lambda concurrency limit bounded
the load. At 1000 req/s (~86M requests/day) and about 2–3 USD per million requests, a sustained
flood could cost 150–250 USD/day. At 10 req/s the API serves at most ~864,000 requests/day,
about 2–3 USD/day. Rejected requests are not billed by API Gateway HTTP APIs.

The limits are global, not per client (TD-016).

## Not Yet Included

Alarms (OBSERVABILITY-002). Authentication: see "Security" (SECURITY-002). CORS was added with TICKET-017.

---

# Persistence Layer

Introduced by TICKET-006 (`terraform/dynamodb.tf`).

| Table | Primary key | GSIs | Purpose |
|---|---|---|---|
| `tenner-tenners` | `tenantId` (PK), `tennerId` (SK) | `nextDue-index` (`tenantId`, `nextDue`), `assignedTo-index` (`tenantId`, `assignedTo`) | Current state of Tenners |
| `tenner-history` | `tenantId` (PK), `historyId` (SK) | `completedAt-index` (`tenantId`, `completedAt`), `tennerId-completedAt-index` (`tenantTennerId`, `completedAt`, TICKET-014) | Immutable completion history |
| `tenner-households` | `tenantId` (PK) | – | Household settings: `timezone`, `updatedAt`, `updatedBy` (SCHEDULING-008) |

All tables use:
- `PAY_PER_REQUEST` billing
- SSE with the AWS managed KMS key (`aws/dynamodb`)
- point-in-time recovery (35 days)
- deletion protection and Terraform `prevent_destroy`
- GSI projection `ALL`. Items are small and household data volume is low, so this keeps queries simple
  without extra reads.

## Multi-Tenancy Readiness

Every key starts with `tenantId`, which comes from the verified household group in the ID token (SECURITY-004,
FUTURE-011). All
current data belongs to `default`. More households can be added without redesigning the tables (FUTURE-001).
Tenant isolation is enforced in code until FUTURE-002.

## Cost

On-demand billing with household volume stays within cents per month. PITR adds a small storage-based
charge per GB, which is negligible at this size.

## Not Yet Included

Lambda data access (TICKET-007), the per-Tenner history index (TICKET-020), seed data.

---

# Lambda → DynamoDB Integration

Introduced by TICKET-007.

```text
API Gateway → Lambda tenner-api ──(AWS SDK v3 DocumentClient)──> tenner-tenners
                                                               └> tenner-history
```

## Environment Variable Strategy

| Variable | Source | Purpose |
|---|---|---|
| `TENNERS_TABLE` | `aws_dynamodb_table.tenners.name` | table name (never hardcoded in code) |
| `HISTORY_TABLE` | `aws_dynamodb_table.history.name` | table name |
| `HOUSEHOLDS_TABLE` | `aws_dynamodb_table.households.name` | table name (SCHEDULING-008) |
| `ENVIRONMENT` | `var.environment` | environment label |
| `APPLICATION_NAME` | `local.common_tags.Application` | application label |
| `LOG_LEVEL` | `var.api_log_level` | logger threshold |

`backend/src/config.ts` reads all variables in one place. If a table variable is missing, the configuration
is incomplete: `/health` reports `misconfigured` and never calls AWS.

## IAM Strategy

The `tenner-api-role` has two inline policies:

| Policy | Actions | Resources |
|---|---|---|
| `tenner-api-role-logging` | `logs:CreateLogStream`, `logs:PutLogEvents` | `/tenner/api` log streams |
| `tenner-api-role-dynamodb` | `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, `Query`, `Scan` | the two table ARNs and their `/index/*` |
| `tenner-api-role-dynamodb` (statement 2, TICKET-020) | `BatchGetItem` | `tenner-tenners` only (title lookup for history pages) |

- No wildcard actions, and no wildcard resources beyond each table's own indexes.
- Terraform tests check both policies, and a mutation check showed that wildcards make the tests fail.
- New actions (for example `TransactWriteItems` in TICKET-013) are added by the ticket that needs them.

## Data Access Foundation

- `backend/src/clients/dynamodb.ts` creates one shared `DynamoDBDocumentClient` per Lambda container
  (`maxAttempts: 2`, `removeUndefinedValues`).
- The AWS SDK v3 is bundled into `dist/index.mjs` (minified, about 550 kB) and pinned via
  `package-lock.json`. The runtime-provided SDK is not used, so builds are reproducible.

## Health Check

`GET /health` sends a `GetItem` for the non-existent key `__healthcheck__` to both tables, in parallel,
with a 2-second timeout. This is read-only and costs one read unit per table.

| Result | HTTP | Body `database` |
|---|---|---|
| both tables answer | 200 | `connected` |
| error or timeout (for example AccessDenied, missing table) | 503 | `unreachable` |
| table variables missing | 503 | `misconfigured` |

## Logging

`backend/src/utils/logger.ts` writes JSON lines with level filtering. On startup the function logs
the environment, application name and table names. It never logs credentials, tokens or request payloads.

---

# Backend Architecture

Introduced by TICKET-008. Details are in [`backend/README.md`](../backend/README.md).

```text
index.ts (routing, correlation, error mapping)
  → handlers/ (HTTP, validation)
  → services/ (business rules, interfaces)
  → repositories/ (persistence interfaces)
  → clients/ (AWS SDK)
```

- **Domain models:** `Tenner`, `Completion`, `User`. The enumerations `Category` and `UserId` are the single
  source of allowed values.
- **Validation:** Zod schemas with centralized limits. `validate()` raises `ValidationError` with field details.
- **Errors:** an `ApplicationError` hierarchy (`ValidationError` 400, `UnauthorizedError` 401, `ForbiddenError` 403, `NotFoundError` 404,
  `ConflictError` 409, `PersistenceError` 500). Errors are mapped centrally to `{ success: false, error: { code, message } }`.
  Unknown errors become `500 INTERNAL_ERROR` without internal details.
- **Responses:** `{ success: true, data }` for business endpoints. `/health` keeps its operational format.
- **Configuration:** `src/config.ts` is the only reader of `process.env`. The tenant is not configuration; it comes
  from the JWT claims (SECURITY-004).
- **Logging:** JSON lines, level filtering, and a child logger per request with `correlationId`
  (`x-correlation-id` header or the API Gateway request ID, echoed in the response).
- **Enforcement:** ESLint fails if code outside `config.ts` reads `process.env`, or if handlers or services
  import the AWS SDK or `clients/`.
- **Endpoints:** API routes are listed in `local.api_routes` (`terraform/locals.tf`). Each one is an explicit
  API Gateway route, and there is no catch-all. Implemented so far: `GET /health`, `POST /tenners` (TICKET-009), `GET /tenners` (TICKET-010), `PUT /tenners/{tennerId}` (TICKET-011), `DELETE /tenners/{tennerId}` (TICKET-012), `POST /tenners/{tennerId}/complete` (TICKET-013), `POST /tenners/{tennerId}/undo-completion` (TICKET-014), `POST /tenners/{tennerId}/restore` (TICKET-015), `GET /dashboard` (TICKET-016), `GET /tenners/{tennerId}` (TICKET-019), `GET /history` and `GET /tenners/{tennerId}/history` (TICKET-020).
- **Read access:** lists always use a DynamoDB Query on the tenant partition, choosing `assignedTo-index` or
  `nextDue-index` when a filter allows it, and never a Scan. The `dynamodb:Scan` permission (TICKET-007) is unused.
- **Write access:** creates are conditional puts (`attribute_not_exists`). Updates are conditional `UpdateItem`
  calls that set only the changed attributes (`attribute_exists`), so they cannot cause lost updates on other fields.
- **Deletion:** soft delete only (`active = false`, `deletedAt`). Records and history stay, so analytics keep
  their relationships. Deleted Tenners are excluded from lists and cannot be updated until they are restored.
  `DeleteItem` is never used by the code (TD-013). Restore (TICKET-015) reverses a soft delete (`active = true`,
  `deletedAt = null`) with an `updatedAt` lock. It never changes the schedule or the history.
- **Completion workflow (TICKET-013):** completing a Tenner appends an immutable history record and moves the Tenner
  into its next cycle (`nextDue = calculateNextDue(local date(completedAt), unit, interval)`, SCHEDULING-001/008) in one `TransactWriteItems`. Optimistic
  locking checks the loaded state (`updatedAt`, `lastCompleted`, `frequencyDays`, active and not deleted), and
  a conflict returns `409 CONCURRENT_MODIFICATION`. The optional `Idempotency-Key` maps to a deterministic UUID v5
  completion ID. Retries return the original result, and conflicting reuse returns 409. Transactions need no extra
  IAM action, because DynamoDB authorizes them through `PutItem` and `UpdateItem`.
- **Undo workflow (TICKET-014):** completions are never deleted. Undo marks the latest non-reverted completion
  (`revertedAt`, `revertedBy`, `revertReason`) and restores the Tenner from the previous active completion, using the
  current frequency. If no previous completion exists, `lastCompleted` becomes `null` and `nextDue` the
  `createdAt` date. Both writes happen in one `TransactWriteItems`, with conditions on "not yet reverted" and the
  loaded Tenner state. History per Tenner is read through the GSI `tennerId-completedAt-index`
  (`tenantTennerId = "<tenant>#<tenner>"`, newest first, no Scan).
- **Snooze (SCHEDULING-003):** `POST /tenners/{tennerId}/snooze` with `until` or `days` sets `nextDue` and
  `snoozedUntil` to the new date. Rules: after today (household timezone) and after the current `nextDue`, at most
  one frequency interval or 30 days ahead (whichever is later); inactive or archived → 409. The next completion
  clears `snoozedUntil`. One `TransactWriteItems` writes an audit event and the Tenner (optimistic lock on
  `updatedAt`, active, not deleted).
  - **Storage decision:** the audit event lives in `tenner-history` (`eventType = SNOOZE`, `historyId =
    snooze#<id>`), not in a new table or a counter attribute. It has no `completedAt` and no `tenantTennerId`,
    so the sparse GSIs `completedAt-index` and `tennerId-completedAt-index` never contain it: completion history,
    undo and analytics ignore snoozes without code changes. `#` cannot occur in completion IDs (UUIDs), so keys
    cannot collide. Considered: a separate table (more infrastructure for few items) and a snooze counter on the
    Tenner (not auditable).
  - Snooze events are not exposed through the API yet (TD-028).
- **Dashboard read model (TICKET-016):** `GET /dashboard` returns due today, overdue, upcoming (next 7 days),
  a summary and actionable workload per user and category in one response. It is backed by one `nextDue-index`
  Query (`nextDue <= reference + 7`, active and not deleted). The reference date is "today" in the household timezone, or the `date` parameter.
- **Time and IDs:** services receive a `Clock` and an `IdGenerator` (`utils/clock.ts`), so tests are deterministic.
  Calendar dates are household-local (see "Date Semantics").
- **Date semantics (SCHEDULING-008):** `nextDue` is a calendar date (`YYYY-MM-DD`) in the **household timezone**.
  - The household timezone (IANA, e.g. `Europe/Berlin`) is stored in `tenner-households` and edited in Settings
    (`GET`/`PUT /household`). Without a stored value, `APPLICATION_TIMEZONE` (default `Europe/Berlin`) applies.
  - All services get it through one function, `TimeZoneSource = (tenantId) => Promise<string>`.
  - `today = localDate(now, tz)`; `nextDue = calculateNextDue(localDate(completedAt, tz), unit, interval)`; a new Tenner is due on
    its local creation date. Timestamps (`completedAt`, `createdAt`, …) stay UTC ISO strings.
  - Local dates come from the platform `Intl` API (`utils/timezone.ts`), which carries the IANA database and DST
    rules. Adding days is pure calendar arithmetic, so DST changes never shift a date. No date library is needed.
  - The frontend computes "today" for due/overdue labels in the household timezone too (`useToday()`).
  - Migration: none. Values computed before 2026-10-05 were UTC dates and may be one day early for completions
    between local midnight and 01:00/02:00; the next completion corrects them.
  - Changing the timezone does not rewrite stored `nextDue` values; it only changes how future dates and "today"
    are computed.

---

# Frontend Hosting

Introduced by TICKET-017 (`terraform/frontend-hosting.tf`).

```text
Browser ──HTTPS──> CloudFront (tenner-cloudfront, PriceClass_100, HTTP/2+3, TLS ≥ 1.2)
                      │  Origin Access Control (SigV4)
                      ▼
                   S3 tenner-frontend-<env> (private, versioned, SSE-S3, BucketOwnerEnforced)
```

| Topic | Implementation |
|---|---|
| Access | Block Public Access. The bucket policy allows `s3:GetObject` only to `cloudfront.amazonaws.com` with `AWS:SourceArn` = this distribution. Requests without TLS are denied |
| SPA routing | 403/404 from S3 → `/index.html` with status 200 |
| Caching | `/assets/*` (content-hashed) uses `Managed-CachingOptimized`. Everything else, including `index.html`, uses `Managed-CachingDisabled`, so new deployments are visible immediately |
| Security headers | HSTS (1 year), `nosniff`, `X-Frame-Options: DENY`, `strict-origin-when-cross-origin`, CSP |
| CSP | `connect-src 'self' https://*.execute-api.<region>.amazonaws.com`. A wildcard is needed because the exact API host would create a Terraform cycle; TICKET-022 narrows it |
| CORS (central, on the HTTP API) | Origin only `https://<cloudfront-domain>`. Methods GET/POST/PUT/DELETE/OPTIONS. Headers `content-type`, `idempotency-key`, `x-correlation-id`, `authorization`. Exposes `x-correlation-id` |
| Rollback | S3 versioning keeps previous objects for 30 days. Normal rollback is a revert on `main` |
| Cost | under 1 USD/month at household traffic (CloudFront free tier 1 TB/month, S3 a few MB) |

Outputs: `frontend_bucket_name`, `cloudfront_distribution_id`, `cloudfront_domain_name`, `frontend_url`.

---

# Frontend Application

Introduced by FRONTEND-001 (`frontend/`). Details: [`frontend/README.md`](../frontend/README.md).

```text
Browser ── CloudFront (index.html, assets/*) ── S3 tenner-frontend-<env>
   │
   └── fetch (src/api/client.ts) ──► API Gateway HTTP API (CORS: CloudFront origin only)
```

| Concern | Decision |
|---|---|
| Stack | React 19, TypeScript (strict), Vite 8, MUI 9, React Router 8, TanStack Query 5, React Hook Form, Zod |
| Language | German UI (decision 2026-10-02); internationalization follows with UX-004 |
| Configuration | `VITE_API_BASE_URL`, injected at build time by `deploy.yml` from the Terraform output `api_endpoint`; read only in `src/config.ts` |
| API access | `src/api/client.ts` only (ESLint forbids `fetch` elsewhere): envelope unwrapping, Zod validation of payloads, `ApiError` with status and backend error code |
| Server state | TanStack Query; reads retry transient failures (network, 429, 5xx) up to 3 times, writes are never retried automatically |
| Structure | feature folders under `src/features/`; shared UI in `src/components/` |
| Fonts | system font stack, no web fonts (the CSP allows only `'self'`) |

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
