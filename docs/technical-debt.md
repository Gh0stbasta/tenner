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

## TD-003: No authentication while the application is publicly reachable (resolved)

> Resolved by SECURITY-002 – SECURITY-004 (2026-10-02), effective with their deployment: the JWT authorizer protects
> every route except `GET /health`, and the backend takes tenant and user only from the verified claims.

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

## TD-005: Due dates are calculated in UTC instead of household local time (resolved)

> Resolved by SCHEDULING-008 (2026-10-05): create, complete, undo, list and dashboard use the household timezone.
> `nextDue` values computed before the change may be one day early for completions between local midnight and
> 01:00/02:00; they correct themselves with the next completion.

### Description

TICKET-013 calculates `nextDue` from the UTC completion timestamp. For `Europe/Berlin`,
a completion shortly after local midnight is assigned to the previous day.

### Reason

The MVP simplified the date handling.

### Impact

Due dates can be off by one day, and "today" on the dashboard switches at 01:00 or 02:00 local time.

Since TICKET-016, `GET /dashboard` determines "today" in `APPLICATION_TIMEZONE` (Europe/Berlin). Other parts
still use UTC dates:
- `nextDue` calculation on create, complete and undo
- `due`/`overdue` in `GET /tenners`

Between 00:00 and 02:00 Berlin time, the dashboard and the list can therefore disagree about "today".

### Suggested Improvement

SCHEDULING-008: compute all calendar dates (creation, completion, list filters) in `APPLICATION_TIMEZONE`.
The configuration and `utils/timezone.ts` already exist.

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

## TD-007: Several tickets mark the user list and categories as hardcoded (resolved)

> Household members resolved by HOUSEHOLD-ADMIN-001 (2026-10-05): members are managed data in `tenner-households`;
> only the seed members (STEFAN, JULIA) remain as one constant. Categories resolved by HOUSEHOLD-ADMIN-002 the same way.

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

`pr.yml` assumes `GitHubActionsDeployRole` to run `aws sts get-caller-identity` and `terraform plan`.
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
`pull_request` subject. Keep `GitHubActionsDeployRole` trusted only for `refs/heads/main` or a
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

## TD-011: State bucket name duplicated as backend literals; global S3 names

### Description

The state bucket and lock table names appear in `locals.tf` and, as literals, in `backend.tf`.
The bucket name `tenner-terraform-state` has no account-specific suffix.

### Reason

Terraform backend blocks cannot use variables or locals. The ticket prescribes the name without a suffix.

### Impact

The names can drift apart if only one place is changed (a test guards the `locals.tf` side).
If the global bucket name is taken, the bootstrap fails. The same risk applies to `tenner-frontend-<env>`
(TICKET-017): if that name is taken, the first apply fails.

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

---

## TD-013: Lambda role grants unused DynamoDB actions

### Description

`tenner-api-role-dynamodb` allows `dynamodb:DeleteItem` and `dynamodb:Scan`. The code uses neither:
deletes are soft deletes (TICKET-012), and lists always use Query (TICKET-010).

### Reason

TICKET-007 prescribes this action list.

### Impact

If the function were compromised, an attacker could physically delete items or scan whole tables.
That is more than the application needs (least privilege).

### Suggested Improvement

Remove `DeleteItem` and `Scan` from the policy and update the IAM test. Add `TransactWriteItems` with TICKET-013.

### Related Work

TICKET-007, TICKET-010, TICKET-012, `terraform/iam.tf`

---

## TD-014: No Lambda reserved concurrency for `tenner-api`

### Description

`tenner-api` has no reserved concurrency. Only the API Gateway stage throttling (SECURITY-014)
and the account-wide Lambda concurrency limit bound how many instances run in parallel.

### Reason

Decision 2026-10-02: deferred to keep SECURITY-014 small. Reserved concurrency also depends on
the account limit: AWS keeps at least 100 executions unreserved, so a reservation fails on
accounts whose limit is only 10.

### Impact

Low while API Gateway is the only trigger, because stage throttling stops excess requests before
Lambda. If another trigger is added, or throttling is raised, a traffic spike can scale the
function up to the account limit. That raises cost and can starve other functions in the account.

### Suggested Improvement

Check the account limit with `aws lambda get-account-settings`. If it is at least 1000, set
`reserved_concurrent_executions` (e.g. 5) through a validated Terraform variable.
Do this as part of SECURITY-005.

### Related Work

SECURITY-014, SECURITY-005, `terraform/api.tf`

---

## TD-015: AWS-side validation rules are not covered offline

### Description

`terraform validate`, `terraform test` (mocked provider) and `terraform plan` do not check
service-specific value rules such as allowed characters in descriptions. The first deployment
failed on two such rules (TICKET-023). The tag check now covers tag characters, and a Terraform
test covers the resource group description, but other per-service fields are still unchecked.

### Reason

These rules are enforced by the AWS APIs at create time. The mocked provider does not know them.

### Impact

A deploy can fail half-way through `apply`. The resources created so far stay in the state and
the next apply continues, so the impact is a failed run, not data loss.

### Suggested Improvement

Keep description strings to letters, digits, spaces, `.`, `-` and `_`. Add a check for new
resource types with known description patterns when they are introduced, or add a short-lived
staging environment (TICKET-021) where `apply` runs before production.

### Related Work

TICKET-023, TICKET-021, `scripts/check_tags.py`, `terraform/tests/foundation.tftest.hcl`

---

## TD-016: API throttling is global, not per client

### Description

The HTTP API stage throttles all routes together (burst 20, 10 req/s, SECURITY-014). All clients
share this budget.

### Reason

Without authentication there is no client identity to throttle on. Per-client limits need
SECURITY-002 (JWT authorizer) or a WAF rate-based rule (~5+ USD/month).

### Impact

A flood from one source can push legitimate household users into HTTP 429 responses (denial of
service). Cost stays bounded, which is the goal of SECURITY-014.

### Suggested Improvement

After SECURITY-002, review per-route limits. Consider a WAF rate-based rule if the app becomes
public (FUTURE-003).

### Related Work

SECURITY-014, SECURITY-002, SECURITY-005, TD-003, `terraform/api.tf`

---

## TD-017: Frontend bundle is a single 780 kB chunk

### Description

`npm run build` produces one JavaScript chunk of about 780 kB (240 kB gzip). Vite warns about chunks above 500 kB.
MUI, React Router, TanStack Query, React Hook Form and Zod are all in the initial download.

### Reason

The MVP routes are small and loaded together; code splitting was not part of the FRONTEND tickets.

### Impact

Slower first load on mobile networks (CloudFront and the immutable cache of `assets/` keep repeat visits fast).
No functional impact.

### Suggested Improvement

Lazy-load routes (`React.lazy` for the detail page, management page and dialogs) and set a performance budget
(UX-007). Check the bundle with `vite build --mode production` and a visualizer.

### Related Work

UX-007, FRONTEND-001, `frontend/vite.config.ts`

---

## TD-018: Current user is chosen per device without authentication (resolved)

> Resolved by SECURITY-003 (2026-10-02): the current user comes from the Cognito ID token; the selector is removed.

### Description

The "Ich bin" selector in the header stores the current user (Stefan/Julia) in `localStorage`. Completions, undo,
restores and Quick Add use it. Anyone can pick any user.

### Reason

Authentication (SECURITY-001 – 004) is not implemented yet; FRONTEND-007 needs a current user.

### Impact

`completedBy` is self-declared and not trustworthy for analytics or audit. No security impact beyond TD-003.

### Suggested Improvement

After SECURITY-002/004, derive the user from the identity token and remove the selector (or limit it to the
household's members). FRONTEND-008 moves the selection to the settings page in the meantime.

### Related Work

FRONTEND-007, FRONTEND-008, SECURITY-004, TD-003


---

## TD-019: Records written before authentication have no audit user

### Description

`createdBy` / `updatedBy` on Tenners and `recordedBy` on completions are only set since SECURITY-004. Older records
return `null` for these fields. `updatedBy` is filled in on the next write; `createdBy` and `recordedBy` stay `null`.

### Reason

A backfill would have to guess the user; the data volume (one household, a few days of use) does not justify a
migration script.

### Impact

Audit and analytics cannot attribute the creation of old Tenners or who recorded old completions.
`completedBy` of old completions is self-declared (see TD-018). No security impact.

### Suggested Improvement

Accept the gap, or run a one-off backfill (e.g. `createdBy = assignedTo`) if an analytics feature needs non-null
values.

### Related Work

SECURITY-004, TD-018, `backend/src/repositories/dynamodb/tenner.mapper.ts`, `completion.mapper.ts`

---

## TD-020: Anyone with a Google account can create a Cognito user

### Description

Since FUTURE-011, Cognito creates a user on every first Google sign-in. Their users stay in the pool until an
administrator deletes them. Since HOTFIX-001, a new user picks a household member on the first login; each
member can be claimed once. **Until every member is claimed, a stranger who knows the URL can claim a free
member and gets full household access.** After that, strangers see "Kein freier Platz" (403). Since
HOUSEHOLD-ADMIN-001, every member added in the settings is a new free place until its person signs in.

### Reason

Owner decisions 2026-10-02 (no allowlist, ADR 0002) and 2026-10-05 (self-assignment, each member once,
HOTFIX-001).

### Impact

- The user list can fill with strangers; each one is a monthly active user (Essentials: 10,000 MAU free,
  then about 0.015 USD per MAU).
- Window of exposure for unclaimed members (today: until Julia has signed in once).
- No alert when someone signs in or claims a member; a wrong claim is only noticed when the real person sees
  "Bereits vergeben".

### Suggested Improvement

A notification (SNS e-mail) on every assignment, an invitation code per member, or a pre-sign-up Lambda trigger
with an e-mail allowlist (GitHub secret) that rejects strangers.

### Related Work

FUTURE-011, HOTFIX-001, ADR 0002, `terraform/auth.tf`, README → "Google Sign-In and User Accounts"

---

## TD-021: Google client secret is stored in the Terraform state

### Description

`aws_cognito_identity_provider.google` receives the Google client secret from `var.google_client_secret`
(GitHub secret `GOOGLE_CLIENT_SECRET`). Terraform stores it in plain text inside the state file.

### Reason

Terraform has no way to pass a secret to this resource without storing it in state. SSM/Secrets Manager are
not in the allowed services yet (TD-004, SECURITY-006).

### Impact

Anyone who can read `s3://tenner-terraform-state/prod/` can read the secret. The bucket is private, encrypted
(SSE-S3) and versioned, so old versions keep old secrets after a rotation. The secret alone grants no access
to household data; it lets someone impersonate the Tenner Google client.

### Suggested Improvement

Restrict state bucket access to the deploy role and administrators (already the case) and rotate the secret
when someone leaves. Later: an ephemeral or write-only argument if the AWS provider supports one for this
resource.

### Related Work

FUTURE-011, SECURITY-006, `terraform/auth.tf`, `terraform/variables.tf`

---

## TD-022: Unused identity attributes and household members defined in three places

### Description

- The user pool schema still contains `custom:tenantId` and `custom:userId` (SECURITY-002), which nothing reads
  since FUTURE-011. Removing a schema attribute replaces the pool and deletes all users.
- The household members (`STEFAN`, `JULIA`) are defined in `terraform/locals.tf` (groups), the backend
  (`USER_IDS`) and the frontend (`USER_IDS`).

### Reason

Pool replacement is destructive; the member list is hardcoded until HOUSEHOLD-ADMIN-001 (TD-007).

### Impact

Small confusion when reading the schema. Adding a member needs changes in three places and a deploy.

### Suggested Improvement

Leave the attributes until the pool must be replaced for another reason. Move members into managed data with
HOUSEHOLD-ADMIN-001 and derive the groups from it.

### Related Work

FUTURE-011, TD-007, HOUSEHOLD-ADMIN-001

---

## TD-023: The API Lambda can change Cognito group membership

### Description

For self-assignment (HOTFIX-001), `tenner-api-role` may call `AdminAddUserToGroup`, `AdminRemoveUserFromGroup`,
`AdminListGroupsForUser`, `ListUsersInGroup` and, since HOUSEHOLD-ADMIN-001, `CreateGroup` (groups of members added
in the app are created on their first assignment) on the Tenner user pool. IAM cannot restrict which user or group
is affected; the code only ever adds the calling user to one household group and only after checking it is free.
Concurrent claims of the same member are resolved by a re-count after adding (the later account withdraws).

### Reason

Storing membership as Cognito groups keeps the authorization path unchanged (groups in the ID token) and needs
no extra table. A dedicated, narrowly scoped Lambda would add infrastructure for a two-person household.

### Impact

A bug or code-injection in the API Lambda could add any user to any household group. The re-count is not a
transaction: in a very unlikely interleaving both concurrent claims withdraw and the member stays free.

### Suggested Improvement

Move the assignment into its own small Lambda (only `POST /onboarding/assignment`) with the Cognito permissions,
and keep the main API role without them; or store claims in DynamoDB with a conditional write and sync groups.

### Related Work

HOTFIX-001, `terraform/iam.tf` (`api_cognito`), `backend/src/services/household-assignment.service.ts`

---

## TD-024: Smoke tests cover only unauthenticated requests

### Description

`scripts/smoke-test.sh` (OPERATIONS-006) checks the frontend, `/health` and that protected routes return 401. It
does not sign in, so a broken household route (e.g. a Lambda error that only occurs with a valid token) passes
the smoke tests.

### Reason

Sign-in is Google only (ADR 0002). A non-interactive test user would need a password login or a separate app
client, which reopens a second way into the user pool.

### Impact

Authenticated regressions are found by unit tests and by the household, not by the pipeline.

### Suggested Improvement

A dedicated, read-only smoke-test app client with a client-credentials flow and a resource server scope that the
backend accepts only for `GET /health`-like read routes, or a synthetic canary with a stored refresh token
(SECURITY-006 for the secret).

### Related Work

OPERATIONS-006, ADR 0002, `scripts/smoke-test.sh`

---

## TD-025: CloudFront accepts TLS 1.0/1.1 with the default certificate

### Description

The frontend uses the default `*.cloudfront.net` certificate. With it, CloudFront always applies the `TLSv1`
security policy; the configured `TLSv1.2_2021` was ignored and only caused a permanent plan diff. SECURITY-005
set the value to `TLSv1` so the code matches reality.

### Reason

A minimum of TLS 1.2 requires a custom domain with an ACM certificate (owner decision: no own domain for now).

### Impact

Clients could negotiate TLS 1.0/1.1. Current browsers do not; the risk is limited to outdated clients. The API
(API Gateway) already requires TLS 1.2.

### Suggested Improvement

Custom domain with ACM certificate and `TLSv1.2_2021` (TICKET-022).

### Related Work

SECURITY-005, TICKET-022, `terraform/frontend-hosting.tf`

## TD-026: History date filters use UTC days

### Description

`GET /history?from=…&to=…` filters `completedAt` by inclusive UTC days, while due dates and "today" use the
household timezone since SCHEDULING-008.

### Reason

SCHEDULING-008 covers due-date calculation; the history filter is a read-only view and was kept unchanged to limit scope.

### Impact

Completions between local midnight and 01:00/02:00 (Europe/Berlin) appear under the previous day when filtering
history by date. No data is wrong.

### Suggested Improvement

Convert `from`/`to` into UTC instants of the household's local day boundaries before querying `completedAt-index`.

### Related Work

SCHEDULING-008, TICKET-020, `backend/src/services/history.service.ts`.

## TD-027: Default frequency for new Tenners is in days only

### Description

The Settings default ("Häufigkeit (alle … Tage)") and Quick Add still use a day count. A default of "monthly"
cannot be configured; Quick Add always creates DAY-based Tenners.

### Reason

SCHEDULING-001 limited the change to the Tenner form and API; the per-browser preferences (FRONTEND-008) keep
their stored format to avoid a preferences migration.

### Impact

Small: a monthly Tenner created through Quick Add drifts by days until it is edited to "Monatlich".

### Suggested Improvement

Store `defaultFrequencyUnit` + `defaultFrequencyInterval` in the preferences envelope (new version with migration)
and send them from Quick Add and the create dialog.

### Related Work

SCHEDULING-001, FRONTEND-008, `frontend/src/features/settings/useNewTennerDefaults.ts`.

## TD-028: Snooze and skip events are stored but not readable through the API

### Description

SCHEDULING-003 and SCHEDULING-004 write audit events (`eventType = SNOOZE` / `SKIP`) into `tenner-history`, but no
endpoint or UI lists them, a skip cannot be undone, and undoing a completion does not restore a snooze it cleared.

### Reason

The ticket requires snoozes to be auditable and distinguishable from completions; analytics (ANALYTICS domain)
is the intended consumer and does not exist yet.

### Impact

Snoozes can only be inspected in DynamoDB. Analytics cannot yet report how often Tenners are postponed.

### Suggested Improvement

Add a base-table query (`tenantId`, `begins_with(historyId, "snooze#")` or `"skip#"`) behind a read endpoint when analytics
needs it; consider a GSI if per-Tenner snooze history is needed at scale.

### Related Work

SCHEDULING-003, SCHEDULING-004, ANALYTICS tickets, `backend/src/repositories/dynamodb/completion.mapper.ts` (`toSnoozeItem`, `toSkipItem`).

## TD-029: Pause and vacation simplifications

### Description

SCHEDULING-005 evaluates pauses at read time and moves due dates only when a pause or vacation is set. Known gaps:

- `GET /tenners?due=true|overdue=true` still includes paused Tenners (the UI shows them as "Pausiert").
- A single pause moves the Tenner to the day after the pause without load spreading; only vacations spread.
- Ending a vacation early does not pull moved due dates forward; changing it later only moves Tenners again.
- Undo of a completion does not consider the vacation; no history of past pauses is kept.
- A vacation reschedules Tenners with sequential conditional writes (not one transaction); concurrently changed
  Tenners keep their date and are reported as conflicts.

### Reason

Keeps the feature free of a scheduler and new infrastructure for one household (see `docs/architecture.md`).

### Impact

Minor inconsistencies in list filters and edge cases; no data loss.

### Suggested Improvement

Pass the vacation into the list service for due/overdue filters; reuse `distributeResume` for single pauses; add a
pause history when analytics needs it (ANALYTICS-006/008).

### Related Work

SCHEDULING-005, `backend/src/utils/pause.ts`, `backend/src/services/vacation.service.ts`.

## TD-030: Quick Add category suggestions know only the seed categories

### Description

`suggestCategory` (FRONTEND-006) maps German/English keywords to the six seed categories. Categories added in the
settings never get suggested; archived ones are skipped.

### Reason

HOUSEHOLD-ADMIN-002 made categories managed data; keywords per category were not part of the ticket.

### Impact

New categories must be picked manually in the create dialog; Quick Add uses the default category.

### Suggested Improvement

Store optional keywords per category (or match the category name) and build the suggestion table from
`GET /categories`.

### Related Work

HOUSEHOLD-ADMIN-002, FRONTEND-006, `frontend/src/features/tenners/quickAdd.ts`.

## TD-031: Handover give-back runs on read, not on a schedule

### Description

HOUSEHOLD-004 gives handed-over Tenners back when `GET /dashboard`, `GET /tenners` or `GET /household` notices
that a handover's last day has passed (`HandoverService.expireDue`). Known gaps:

- Without any of these reads, Tenners stay with the cover after `until` (nothing else reads assignments yet; a
  future notifier or analytics job must call `expireDue` first).
- Each of these reads costs one extra GetItem on `tenner-households` (household settings are read several times per
  request already, see the services' `membersOf`/`timezoneOf`/`vacationOf` sources).
- Starting, ending and expiring move Tenners with sequential `UpdateItem` calls, not one transaction. A failure
  leaves a partial state that the next identical start, the next end or the next read completes.
- Give-back scans all non-deleted Tenners of the household (no index on `originalAssignee`).
- Two requests expiring at the same moment may both give back (idempotent) and one save loses the version race
  (logged as `Handover expiry skipped`, retried on the next read).

### Reason

Same decision as SCHEDULING-005: no scheduler or new infrastructure for one household (see `docs/architecture.md`).

### Impact

Assignments may be outdated until the next app open; slightly higher DynamoDB read cost per read request.

### Suggested Improvement

When NOTIFICATION-001 introduces a scheduled Lambda, call `expireDue` from it daily and drop the read hook; load
the household item once per request and pass it to all services.

### Related Work

HOUSEHOLD-004, `backend/src/services/handover.service.ts`, `backend/src/index.ts`.

## TD-032: Executive dashboard is maintained by hand

### Description

`dashboard.md` (REPORTING-001) is a dated snapshot. Ticket counts, debt levels, risks and next actions are compiled by
hand from the ticket files, `docs/technical-debt.md`, `docs/security.md`, the roadmap and GitHub Actions. AI spend is
not recorded anywhere, so the dashboard shows it as "not tracked". The debt levels (High, Medium, Low) are a
judgement made for the dashboard; `docs/technical-debt.md` has no severity field.

### Reason

The ticket requires plain Markdown without external tooling; the ticket files have no machine-readable status field
(done = an "Implementation Status" section).

### Impact

The dashboard drifts when a ticket is completed without refreshing it; the owner may steer on stale numbers.

### Suggested Improvement

Refresh the dashboard as part of each block's completion. Later, add a `Status:` and `Severity:` line to tickets and
debt entries and a small script (or CI job) that regenerates the numbers; record AI spend per session in a log file.

### Related Work

REPORTING-001, `dashboard.md`.
