# Technical Debt

## TD-001: Duplicate ticket file for TICKET-003

### Description

`docs/backlog/infra/ticket004.md` is an exact copy of `infra/ticket003.md`
(both are "TICKET-003: Create Remote Terraform State Backend"). No real TICKET-004 exists.

### Reason

Most likely a copy/paste mistake when the infrastructure tickets were created.

### Impact

The numbering is confusing, and someone may "implement" the remote state backend twice.
It is unclear whether a TICKET-004 (possibly frontend hosting) was planned and lost.

### Suggested Improvement

Delete `infra/ticket004.md`, or replace it with the intended TICKET-004. Frontend hosting
is now covered by TICKET-017 and TICKET-018. META-001 forbids changing existing tickets,
so this needs an explicit decision by the owner.

### Related Work

META-001, TICKET-003, TICKET-017

---

## TD-002: Inconsistent backlog layout and naming conventions

### Description

- TICKET-001 (CI/CD) is in `docs/backlog/ticket001.md`, while `infra/ticket001.md` holds TICKET-001A.
- Backend tickets (TICKET-008 to 016) are in `infra/`, not in a `backend/` folder.
- META-001 refers to `backlog/infrastructure/` and `backlog/backend/`, which do not exist.
- `CLAUDE.md` asks for tickets at `backlog/YYYYMMDD-XX-short-title.md`, but the repository uses
  `docs/backlog/<domain>/ticketNNN.md` with domain prefixes.

### Reason

The conventions grew over time and were never consolidated.

### Impact

Tickets are harder to find, and automated agents may create tickets in the wrong place or format.

### Suggested Improvement

Pick one convention (recommended: the existing `docs/backlog/<domain>/ticketNNN.md` documented
in `docs/backlog/README.md`), update `CLAUDE.md` to match, and optionally move TICKET-001 into `infra/`
and backend tickets into `backend/` in a dedicated housekeeping change.

### Related Work

META-001, `docs/backlog/README.md`, `CLAUDE.md`

---

## TD-003: No authentication while the application is publicly reachable

### Description

All existing tickets exclude authentication. Once TICKET-017 hosts the frontend publicly,
the API can be reached without credentials.

### Reason

`architecture.md` deferred the authentication decision so it would not delay the MVP.

### Impact

Anyone who discovers the API URL can read, change or delete household data.
This is a high security risk.

### Suggested Improvement

Implement SECURITY-001 to SECURITY-004 before or together with TICKET-017/018.

### Related Work

SECURITY-001, SECURITY-002, SECURITY-003, SECURITY-004, TICKET-017

---

## TD-004: Allowed-services list does not cover planned capabilities

### Description

`architecture.md` allows only API Gateway, Lambda, DynamoDB, S3, CloudFront, EventBridge and Cognito.
Planned work needs SSM/Secrets Manager, SES, SNS, Route53/ACM, X-Ray, CloudTrail and an LLM provider.

### Reason

The list was written for the MVP scope.

### Impact

Each affected ticket must first go through an architecture decision, or the architecture
document will be silently violated.

### Suggested Improvement

Create ADRs in `docs/decisions/` as each ticket requires them (see `docs/roadmap.md`, section 3).
Consider turning the list into "serverless, pay-per-use managed services, subject to ADR".

### Related Work

SECURITY-006, NOTIFICATION-005, OBSERVABILITY-002, TICKET-022, OBSERVABILITY-004, SECURITY-012, AI-001

---

## TD-005: Due dates are calculated in UTC instead of household local time

### Description

TICKET-013 calculates `nextDue` from the UTC completion timestamp. For `Europe/Berlin`,
a completion shortly after local midnight is assigned to the previous day.

### Reason

The MVP simplified the date handling.

### Impact

Due dates can be off by one day, and "today" on the dashboard switches at 01:00 or 02:00 local time.

### Suggested Improvement

SCHEDULING-008: timezone-aware due-date calculation.

### Related Work

TICKET-013, TICKET-014, TICKET-016, SCHEDULING-008

---

## TD-006: Referenced documentation does not exist

### Description

`architecture.md` lists `README.md`, `docs/roadmap.md` and `docs/decisions/` in the repository
structure. `docs/decisions/` does not exist. `docs/roadmap.md` was created by META-001, and `README.md` by TICKET-001.

### Reason

The repository currently holds planning documents only.

### Impact

New contributors and agents have no entry point at the repository root.

### Suggested Improvement

Create `README.md` together with the first implementation ticket (TICKET-001 already requires
README updates). Create `docs/decisions/` with the first ADR (SECURITY-001).

### Related Work

TICKET-001, SECURITY-001

---

## TD-007: Several tickets mark the user list and categories as hardcoded

### Description

The tickets hardcode household users (`STEFAN`, `JULIA`) and categories in backend validation
and frontend dropdowns.

### Reason

This was enough for the MVP.

### Impact

Adding a household member or a category requires code changes in several places.

### Suggested Improvement

Keep each list in one central constant until HOUSEHOLD-ADMIN-001 and HOUSEHOLD-ADMIN-002 move
them into managed data.

### Related Work

TICKET-008, TICKET-013, FRONTEND-008, HOUSEHOLD-ADMIN-001, HOUSEHOLD-ADMIN-002

---

## TD-008: Pull request plan runs with the deploy role

### Description

`pr.yml` assumes `GithubActionsDeployRole` to run `aws sts get-caller-identity` and `terraform plan`.
Code in a pull request branch therefore runs with the same AWS permissions as a deployment.

### Reason

TICKET-001 requires a Terraform plan and an identity check in pull requests, and only
one role exists.

### Impact

Anyone who can push a branch and open a PR can run arbitrary code with deploy permissions,
without review or merge. In a single-owner repository the risk is low. It grows with every
collaborator.

### Suggested Improvement

Create a separate read-only plan role (for example `GithubActionsPlanRole`) trusted only for the
`pull_request` subject. Keep `GithubActionsDeployRole` trusted only for `refs/heads/main` or a
protected GitHub environment. Part of SECURITY-008.

### Related Work

TICKET-001, SECURITY-008, `.github/workflows/pr.yml`

---

## TD-009: GitHub Actions referenced by tag, not commit SHA

### Description

The workflows use `actions/checkout@v7`, `actions/setup-node@v7`, `hashicorp/setup-terraform@v4`
and `aws-actions/configure-aws-credentials@v6` by major version tag.

### Reason

Tags are readable, and no Dependabot setup exists yet to keep SHA pins updated.

### Impact

If a tag is moved maliciously, untrusted code could run in a job that holds AWS credentials.

### Suggested Improvement

Pin all actions to full commit SHAs and let Dependabot update them (SECURITY-007, SECURITY-008).

### Related Work

TICKET-001, SECURITY-007, SECURITY-008

---

## TD-010: Two lock mechanisms for Terraform state

### Description

`backend.tf` enables both S3 native locking (`use_lockfile = true`) and DynamoDB locking (`dynamodb_table`).

### Reason

TICKET-003 requires a DynamoDB lock table. Since Terraform 1.10, S3 native locking is available,
and DynamoDB locking is deprecated.

### Impact

There is an extra resource to operate, and newer Terraform versions print deprecation warnings.
A future Terraform version may remove `dynamodb_table`.

### Suggested Improvement

Once S3 locking has worked in CI for a while, remove `dynamodb_table` from `backend.tf`. Then remove
the `tenner-terraform-locks` table: remove `prevent_destroy` and deletion protection first, with explicit approval.

### Related Work

TICKET-003, `terraform/backend.tf`, `terraform/state-backend.tf`

---

## TD-011: State bucket name duplicated as backend literals

### Description

The state bucket and lock table names appear in `locals.tf` and, as literals, in `backend.tf`.
The bucket name `tenner-terraform-state` has no account-specific suffix.

### Reason

Terraform backend blocks cannot use variables or locals. The ticket prescribes the name without a suffix.

### Impact

The names can drift apart if only one place is changed (a test guards the `locals.tf` side).
If the global bucket name is taken, the bootstrap fails.

### Suggested Improvement

Move backend values to a partial configuration file (`environments/prod/backend.hcl`, passed with
`-backend-config`) when environments are introduced (TICKET-021). Add an account-specific suffix if required.

### Related Work

TICKET-003, TICKET-021

---

## TD-012: Lambda bundle size grows with Zod

### Description

The minified `tenner-api` bundle is about 1 MB. Zod 4 (classic API) contributes about 460 kB and the AWS SDK about 550 kB.

### Reason

Zod is the recommended validation library (TICKET-008), and the SDK is bundled on purpose (TICKET-007).

### Impact

Cold starts parse more JavaScript, probably about 10–30 ms on 256 MB arm64. Warm requests are not affected.

### Suggested Improvement

Measure the cold start with OBSERVABILITY-003. If needed, switch to `zod/mini` (tree-shakeable, same schemas with
a functional API), or use the runtime-provided AWS SDK.

### Related Work

TICKET-007, TICKET-008, TICKET-009, `backend/build.mjs`
