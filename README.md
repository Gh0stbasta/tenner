# Tenner

Tenner is a small serverless web app that helps individuals and families keep up with
recurring responsibilities through small, ten-minute tasks ("Tenners").

> If something can be improved in 10 minutes, do a Tenner.

- **Project status at a glance:** [`dashboard.md`](dashboard.md)
- Architecture: [`docs/architecture.md`](docs/architecture.md)
- Roadmap: [`docs/roadmap.md`](docs/roadmap.md)
- Backlog: [`docs/backlog/README.md`](docs/backlog/README.md)
- Technical debt: [`docs/technical-debt.md`](docs/technical-debt.md)

## Current State

The repository contains:

- the CI/CD workflows (TICKET-001)
- the Terraform foundation in `terraform/` (TICKET-002): provider, tagging, naming standards and the tag-based AWS Resource Group `Tenner`
- the remote Terraform state backend (TICKET-003): S3 bucket `tenner-terraform-state` and lock table `tenner-terraform-locks`
- tag enforcement on every plan (TICKET-001A, `scripts/check_tags.py`): mandatory keys and valid AWS tag characters (TICKET-023)
- the API runtime (TICKET-005): Lambda `tenner-api` and HTTP API `tenner-api-gateway` with `GET /health` (code in [`backend/`](backend/README.md))
- the DynamoDB persistence layer (TICKET-006): tables `tenner-tenners` and `tenner-history` with GSIs (plus `tenner-households` for household settings, SCHEDULING-008)
- the backend API (TICKET-008 to TICKET-016): CRUD, complete/undo/restore workflows and dashboard (see [`backend/README.md`](backend/README.md))
- frontend hosting (TICKET-017): private S3 bucket `tenner-frontend-<env>` behind CloudFront with Origin Access Control; URL in the Terraform output `frontend_url`
- the backend extension for archived Tenners (TICKET-024, `GET /tenners?deleted=true`) and API throttling (SECURITY-014)
- the German web app in [`frontend/`](frontend/README.md) (FRONTEND-001 – 007, FRONTEND-009, UX-005): dashboard,
  Tenner management with search and filters, create/edit dialogs, Quick Add, complete with undo, recent activity,
  Tenner detail with history, central error handling. It is published to CloudFront by `deploy.yml`.
- the Alexa skill foundation in [`alexa/`](alexa/README.md) (ALEXA-001, [ADR 0005](docs/decisions/0005-alexa-platform.md)): German skill skeleton, skill Lambda `tenner-alexa-skill` in eu-west-1 (created once the GitHub variable `ALEXA_SKILL_ID` is set)
- the project documentation

## Terraform (local)

```bash
cd terraform
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
terraform test        # offline, mocked AWS provider
cd ..
python3 -m unittest discover -s scripts/tests   # tag checker tests
```

`terraform plan` and `apply` need AWS credentials. Infrastructure is applied only by the deploy workflow.

## Terraform State

State lives in S3 (`s3://tenner-terraform-state/prod/terraform.tfstate`) with locking.
Details are in [`docs/architecture.md`](docs/architecture.md), section "State Management".

### One-Time Bootstrap (required before the first deployment)

The state bucket must exist before CI can run `terraform init`. Run this once, locally, with
administrator credentials for the AWS account:

```bash
scripts/bootstrap-state.sh            # dry run: shows the plan
scripts/bootstrap-state.sh --apply    # creates bucket and lock table, migrates state
```

Requirements: `terraform` (>= 1.10) and `aws` CLI. The bucket name `tenner-terraform-state` must be
globally available. If it is taken, change it in `terraform/locals.tf` **and** `terraform/backend.tf`.

### CI Permissions

Besides permissions for the managed resources, `GitHubActionsDeployRole` needs the following.

For the managed resources so far:
- Resource Groups
- S3 and DynamoDB (state resources)
- Lambda
- API Gateway (`apigateway:*` on `tenner-api-gateway`)
- DynamoDB tables `tenner-tenners`, `tenner-history` and `tenner-households` (create, update, tag, PITR, deletion protection; SCHEDULING-008 added `tenner-households`)
- S3 bucket `tenner-frontend-<env>` (bucket configuration, policy) and CloudFront (distribution, origin access control, response headers policy)
- Frontend publishing (TICKET-018):
  - `s3:ListBucket` on `arn:aws:s3:::tenner-frontend-<env>`
  - `s3:PutObject` and `s3:DeleteObject` on `arn:aws:s3:::tenner-frontend-<env>/*`
  - `cloudfront:CreateInvalidation` on the distribution ARN
- CloudWatch Logs (`/tenner/*`)
- Authentication (SECURITY-002, FUTURE-011): `cognito-idp:*` on the Tenner user pool (create/update pool, app client,
  domain, managed login branding, Google identity provider, groups, tags), `cognito-idp:CreateUserPool`, `cognito-idp:DescribeUserPoolDomain`,
  API Gateway authorizers (`apigateway:*` on `tenner-api-gateway` already covers them) and `sts:GetCallerIdentity`
  (always allowed)
- IAM: create and manage `tenner-api-role` and its inline policy, plus `iam:PassRole` for that role to Lambda
- Cost monitoring (OPERATIONS-001): AWS Budgets and Cost Explorer anomaly permissions, see "Cost Monitoring"
- Alexa skill (ALEXA-001): Lambda, IAM role and CloudWatch Logs for `tenner-alexa-skill` in **eu-west-1**, see
  [`alexa/README.md`](alexa/README.md) → "CI Permissions" (only needed before `ALEXA_SKILL_ID` is set)

For the state backend:

- `s3:ListBucket` on `arn:aws:s3:::tenner-terraform-state`
- `s3:GetObject`, `s3:PutObject` and `s3:DeleteObject` on `arn:aws:s3:::tenner-terraform-state/prod/*`
  (the state file and its `.tflock` file)
- `dynamodb:GetItem`, `PutItem` and `DeleteItem` on the `tenner-terraform-locks` table

### Recovery

- Restore a previous version of `prod/terraform.tfstate` (bucket versioning).
- Use `terraform force-unlock <LOCK_ID>` only when no apply is running.
Standards are documented in [`docs/architecture.md`](docs/architecture.md) (Terraform, tagging, naming).

---

## Deployment

All deployments run in GitHub Actions. AWS access uses **GitHub OIDC only**: no AWS
access keys exist in GitHub or in this repository.

### Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| [`pr.yml`](.github/workflows/pr.yml) | `pull_request` | Runs `terraform fmt -check`, `validate` and `test` offline. Then checks AWS identity, builds the Lambda bundle, runs `terraform plan` and enforces mandatory tags on the plan. Runs frontend, backend and alexa `npm ci`, `lint`, `test`, `build`. **Never applies.** |
| [`deploy.yml`](.github/workflows/deploy.yml) | push to `main` | Builds frontend and backend as a gate, checks AWS identity, then runs `terraform init` and `plan`, enforces mandatory tags, applies the checked plan, calls `GET /health` on the deployed API, then builds the frontend against that API and publishes it to S3/CloudFront (`scripts/deploy-frontend.sh`). When `ALEXA_SKILL_ID` is set, it also deploys the Alexa skill package (`scripts/deploy-alexa-skill.sh`). |

Settings:

| Setting | Value |
|---|---|
| AWS region | `eu-central-1` |
| Terraform version | `1.16.4` (`TF_VERSION` in both workflows) |
| Node.js version | `22` (`NODE_VERSION` in both workflows) |
| Terraform directory | `terraform/` |
| Application directories | `frontend/`, `backend/`, `alexa/` |

If `terraform/` contains no `*.tf` files, the Terraform steps are skipped with a notice.
If `frontend/package.json` or `backend/package.json` is missing, that build is skipped.
This lets the pipeline run before those projects exist. Once a directory exists, its steps
run automatically and a failure fails the workflow.

Each Node project must commit its `package-lock.json`, because `npm ci` requires it.
The `lint` and `test` scripts are optional (`--if-present`). The `build` script is required.

Deployments to `main` run one at a time (`concurrency: deploy-main`). A running
`terraform apply` is never cancelled.

### Prerequisites (outside this repository)

These must exist before the workflows can authenticate. This repository does not manage them.

1. **IAM role `GitHubActionsDeployRole`.** It must trust the GitHub OIDC provider
   `token.actions.githubusercontent.com` with audience `sts.amazonaws.com`, and allow these subjects:

   ```text
   repo:Gh0stbasta@163649161/tenner@1400531132:ref:refs/heads/main   (deploy.yml)
   repo:Gh0stbasta@163649161/tenner@1400531132:pull_request          (pr.yml: identity check and terraform plan)
   ```

   GitHub includes the numeric owner and repository IDs in the `sub` claim
   (`<owner>@<owner-id>/<repo>@<repo-id>`). A subject without the IDs, such as
   `repo:Gh0stbasta/tenner:pull_request`, never matches. The IDs are public, not secrets.
   The `pull_request` subject was verified in CI on 2026-10-02; the `main` subject is assumed
   to follow the same format and is verified by the first deployment.
   Use `StringEquals` for exact subjects. Wildcards (`*`) only work with `StringLike`.

2. **Repository secret `AWS_ROLE_ARN`** containing the ARN of that role.
3. **Repository variable `GOOGLE_CLIENT_ID` and secret `GOOGLE_CLIENT_SECRET`** for Google sign-in
   (FUTURE-011, see "Google Sign-In and User Accounts"). `terraform plan` fails in both workflows without them.
4. **Repository secret `BUDGET_ALERT_EMAIL`** (and optionally the variable `COST_ANOMALY_MONITOR_ARN`) for cost
   alerts (OPERATIONS-001, see "Cost Monitoring").

If the PR subject is not trusted, `pr.yml` fails at "Configure AWS credentials".

### Verifying the setup

1. Open a pull request. Check that **PR Validation** passes and that the "Verify AWS identity"
   step prints the assumed `GitHubActionsDeployRole` session.
2. Merge to `main`. Check that **Deploy** passes and shows the same identity.

### Frontend Publishing

`scripts/deploy-frontend.sh <dist-dir> <bucket> <distribution-id>` runs in `deploy.yml` after a successful apply
and health check. The build gets `VITE_API_BASE_URL` from the Terraform output `api_endpoint`.

| Step | Files | `Cache-Control` |
|---|---|---|
| 1 | `assets/*` (content-hashed) | `public, max-age=31536000, immutable`. Old assets are kept |
| 2 | everything else, including `index.html` (`--delete`, excluding `assets/`) | `no-cache` |
| 3 | CloudFront invalidation of `/index.html` and `/` only, which stays within the free monthly invalidation quota | — |

A failed build stops the job before anything is uploaded.

### Google Sign-In and User Accounts (FUTURE-011)

The app and the API require a login (Cognito, [ADR 0001](docs/decisions/0001-authentication.md)).
Sign-in is **only with Google** ([ADR 0002](docs/decisions/0002-google-sign-in.md)); there are no Tenner
passwords. Anyone with a Google account can sign in. On the first login the app asks "who are you?"
(Stefan or Julia, HOTFIX-001). **Each person can be chosen by one Google account only**: once both are
taken, everyone else sees "Kein freier Platz" and gets 403 from the API.

> Until both of you have signed in once, a stranger who knows the URL could claim the free person.
> Sign in right after the deploy; check the assignments with the commands below.

#### One-time setup: Google OAuth client

1. Google Cloud Console → create a project (e.g. `tenner`) → "Google Auth Platform" / "OAuth consent screen":
   user type **External**, app name `Tenner`, scopes `openid`, `email`, `profile`.
   Set the publishing status to **In production**; in "Testing" only listed test users can sign in.
   The basic scopes need no Google verification.
2. "Clients" → "Create client" → type **Web application**:
   - Authorized redirect URI: `https://<cognito-domain>/oauth2/idpresponse`. The value is the Terraform output
     `cognito_google_redirect_uri`; the domain is the one in `cognito_login_url` and already exists since
     SECURITY-002. No JavaScript origin is needed (Cognito exchanges the code server-side).
3. GitHub → repository → Settings → Secrets and variables → Actions:
   - **Variable** `GOOGLE_CLIENT_ID` = the client ID (`<number>-<id>.apps.googleusercontent.com`)
   - **Secret** `GOOGLE_CLIENT_SECRET` = the client secret

Without both values, `terraform plan` fails in CI with a message naming the missing value. The secret is never
committed; Terraform keeps it in the encrypted state bucket (TD-021).

#### Household membership

Membership is a Cognito group `household:<tenantId>:<userId>`. Terraform creates `household:default:STEFAN`
and `household:default:JULIA`. Members added in the app (Settings → "Haushaltsmitglieder", HOUSEHOLD-ADMIN-001)
get their group from the API on their first assignment. Normally the app assigns the group itself when someone picks
a person on the first login. **A newly added member is a free place until its person signs in** (TD-020), so add
members only when they are about to sign in. To check or fix assignments, use AWS CloudShell (region `eu-central-1`):

```bash
POOL_ID=$(aws cognito-idp list-user-pools --max-results 20 \
  --query "UserPools[?Name=='tenner-users-prod'].Id | [0]" --output text)

# Who has signed in? Google users are named google_<number>.
aws cognito-idp list-users --user-pool-id "$POOL_ID" \
  --query "Users[].[Username, Attributes[?Name=='email'].Value | [0], UserCreateDate]" --output table

# Who is Stefan / Julia?
aws cognito-idp list-users-in-group --user-pool-id "$POOL_ID" --group-name "household:default:JULIA" \
  --query "Users[].[Username, Attributes[?Name=='email'].Value | [0]]" --output table

# Assign by hand (instead of the first-login choice)
aws cognito-idp admin-add-user-to-group --user-pool-id "$POOL_ID" \
  --username "google_<number>" --group-name "household:default:STEFAN"
```

After a manual change the person signs out and in again (or waits up to 60 minutes for the next token
refresh). Each account must be in **exactly one** household group, and each group should have exactly one
member. **Wrong claim** (a stranger took a person): remove them from the group, sign them out globally and
delete the user; the person is free again.

| Group | Meaning |
|---|---|
| `household:default:STEFAN` | Stefan in the household `default` (all existing data belongs to `default`) |
| `household:default:JULIA` | Julia in the household `default` |

Other admin tasks:

```bash
aws cognito-idp admin-remove-user-from-group --user-pool-id "$POOL_ID" --username "google_<number>" \
  --group-name "household:default:STEFAN"                                                    # revoke access
aws cognito-idp admin-user-global-sign-out --user-pool-id "$POOL_ID" --username "google_<number>" # end sessions now
aws cognito-idp admin-delete-user        --user-pool-id "$POOL_ID" --username "<username>"      # remove a stranger
```

Without a global sign-out, a removed member keeps access until the ID token expires (at most 60 minutes).
Password accounts created before FUTURE-011 can no longer sign in and can be deleted.

Never commit e-mail addresses, client secrets or tokens.

### Cost Monitoring (OPERATIONS-001)

`terraform/costs.tf` creates a monthly AWS Budget (default 5 USD, `monthly_budget_usd`) with e-mail alerts at
50 % and 80 % of actual and 100 % of forecasted spend, and Cost Anomaly Detection with a daily e-mail summary for
anomalies of at least 1 USD ([ADR 0003](docs/decisions/0003-cost-monitoring.md)). Expected cost: under 0.10 USD
per month (table in `docs/architecture.md`).

Before the first deployment with OPERATIONS-001:

1. GitHub → Settings → Secrets and variables → Actions → **Secret** `BUDGET_ALERT_EMAIL` = your e-mail address.
   `terraform plan` fails without it. AWS sends a confirmation e-mail for the anomaly subscription.
2. Extend `GitHubActionsDeployRole` (see "CI Permissions"): `budgets:ViewBudget`, `budgets:ModifyBudget`,
   `budgets:ListTagsForResource`, `budgets:TagResource`, `budgets:UntagResource` on
   `arn:aws:budgets::<account-id>:budget/tenner-monthly-*`, and `ce:CreateAnomalyMonitor`,
   `ce:GetAnomalyMonitors`, `ce:UpdateAnomalyMonitor`, `ce:DeleteAnomalyMonitor`, `ce:CreateAnomalySubscription`,
   `ce:GetAnomalySubscriptions`, `ce:UpdateAnomalySubscription`, `ce:DeleteAnomalySubscription`,
   `ce:TagResource`, `ce:UntagResource`, `ce:ListTagsForResource` (resource `*`; Cost Explorer has no
   resource-level permissions for creation).
3. Check for an existing AWS-services anomaly monitor (only one per account is allowed):

   ```bash
   aws ce get-anomaly-monitors --query "AnomalyMonitors[?MonitorType=='DIMENSIONAL'].[MonitorName, MonitorArn]" --output table
   ```

   If one exists, set the GitHub **variable** `COST_ANOMALY_MONITOR_ARN` to its ARN; Terraform then reuses it.

Optional: activate the `Application` cost allocation tag (Billing console → Cost allocation tags), wait up to
24 hours, then set `budget_filter_by_application_tag = true` to count only Tenner resources. Without activation
the filtered budget would see no cost, so the default covers the whole account.

### Security Baseline (SECURITY-005)

Controls, trust boundaries, the IAM review and residual risks are summarized in
[`docs/security.md`](docs/security.md), including two manual checks (account-level S3 Block Public Access and a
short throttling burst test). Request bodies above 16 KiB are rejected with 413.

### Dependency Scanning (SECURITY-007)

- **Dependabot** (`.github/dependabot.yml`): weekly update PRs for `frontend/` and `backend/` npm packages
  (minor and patch grouped) and GitHub Actions, monthly for the Terraform providers. At most 3 open PRs per
  ecosystem. Major updates of `typescript` (until typescript-eslint supports them) and `@types/node` (follows the
  Node.js 22 runtime) are ignored. Each update PR runs the PR validation **without the Terraform plan**: Dependabot
  runs get no repository secrets, and they should not get the deploy role (TD-008). The deploy workflow plans after
  the merge, so review Terraform provider updates with extra care (HOTFIX-002).
- **CI audit** (PR validation and deploy build): `npm audit --omit=dev` for frontend and backend, evaluated by
  `scripts/check_npm_audit.py`. High or critical vulnerabilities in **production** dependencies fail the build.
  Dev-only tools (Vite, ESLint, Vitest) are not blocking.
- **Exceptions** (`.github/npm-audit-allowlist.json`): only if no fix exists or the vulnerable code is not
  reachable. Each entry needs the advisory ID (`GHSA-…`), the package, a reason and an expiry date (at most
  90 days). Expired entries fail the build again; unused entries are reported. Example:

  ```json
  { "advisory": "GHSA-xxxx-xxxx-xxxx", "package": "example", "reason": "No fix released; only used at build time", "expires": "2026-12-31" }
  ```

- **Repository settings (manual, once):** GitHub → Settings → Code security → enable **Dependabot alerts** and
  **Dependabot security updates**. These settings are not stored in the repository.

### API Throttling

The API stage is throttled to protect against cost spikes (SECURITY-014): burst 20 and
10 requests per second by default, shared by all clients. Excess requests get HTTP 429.
Change the limits through the Terraform variables `api_throttling_burst_limit` and
`api_throttling_rate_limit` (`terraform/variables.tf`), then merge to `main`.

### Smoke Tests (OPERATIONS-006)

After every deployment, `deploy.yml` runs `scripts/smoke-test.sh <frontend_url> <api_endpoint>`. It only sends
GET requests and never touches household data:

| Check | Expected |
|---|---|
| Frontend `/` | 200, app root element, `Content-Security-Policy` header |
| Frontend `/dashboard` | 200 (SPA routing through CloudFront) |
| API `/health` | 200, `"status":"ok"`, `"database":"connected"` |
| API `/dashboard`, `/onboarding` without a token | 401 (the JWT authorizer protects the API) |

Transient errors (refused connections, timeouts, 429, 5xx) are retried 3 times. Any failure fails the run with a
GitHub error annotation and points to the rollback section below. Signed-in requests are not covered (TD-024).
Run it locally with the Terraform outputs:

```bash
scripts/smoke-test.sh "$(terraform -chdir=terraform output -raw frontend_url)" \
  "$(terraform -chdir=terraform output -raw api_endpoint)"
```

### Data Backfill (optional, SCHEDULING-001)

Tenners created before SCHEDULING-001 have no `frequencyUnit`; the API reads them as `DAY` with
`frequencyInterval = frequencyDays`, so no migration is needed. To store the values explicitly, run in
AWS CloudShell (needs `dynamodb:Scan` and `dynamodb:UpdateItem` on `tenner-tenners`):

```bash
python3 scripts/backfill_frequency_unit.py           # dry run: lists affected Tenners
python3 scripts/backfill_frequency_unit.py --apply   # conditional, idempotent writes
```

### Rollback

- **Workflow or application changes:** revert the commit on `main`. The deploy workflow then
  re-applies the previous state and republishes the previous frontend.
- **Frontend only (emergency):** the bucket is versioned and keeps previous object versions for 30 days.
  Restore the previous `index.html` version in S3, then invalidate `/index.html`.
- **Calendar frequencies (SCHEDULING-001):** code before SCHEDULING-001 ignores `frequencyUnit` and uses
  `frequencyDays`, so after a revert monthly/yearly Tenners recur every 30/365 days. No data is lost.
  Code before SCHEDULING-002 ignores `weekdays`; weekday-bound Tenners then recur every 7 × interval days.
- **Pause and vacation (SCHEDULING-005):** code before it ignores `pausedAt`/`pausedUntil` and the stored vacation;
  paused Tenners then appear as due again. Due dates already moved by a vacation stay moved.
- **Infrastructure changes:** reverting the Terraform code and letting `deploy.yml` apply it
  is the only supported way. Manual changes in AWS are not allowed (see `docs/architecture.md`).

### Monitoring (OBSERVABILITY-001)

The CloudWatch dashboard `tenner-<environment>` shows API Gateway (requests, 4xx, 5xx, latency p50/p95), every
Lambda (invocations, errors, throttles, concurrency, duration p95 — the Alexa skill from eu-west-1, the notifier when
enabled), DynamoDB per table (capacity, throttles, system errors) and CloudFront (requests, 4xx/5xx rate, us-east-1
metrics). Link: Terraform output `cloudwatch_dashboard_url`. Cost: 0 USD (3 dashboards are free).

**Alarms (OBSERVABILITY-002, [ADR 0006](docs/decisions/0006-alarm-notifications.md)):** API 5xx rate > 5 % for 5
minutes, Lambda errors in 2 of 3 periods and throttles per function, DynamoDB system errors and throttles (all
tables), no successful notifier run for 2 hours. Thresholds: Terraform variable `alarm_thresholds`. They e-mail
the `BUDGET_ALERT_EMAIL` address through SNS topic `tenner-alarms`; confirm the subscription e-mail AWS sends after
the first deploy. Each alarm links its section in [`docs/runbooks/alarms.md`](docs/runbooks/alarms.md). At most 10
standard alarms: free.

Dashboard and alarms are created when the GitHub **variable** `OBSERVABILITY_ENABLED` is `true`; before that, allow
for `GitHubActionsDeployRole`: `cloudwatch:PutDashboard`, `GetDashboard`, `DeleteDashboards` on
`arn:aws:cloudwatch::<account-id>:dashboard/tenner-*`; `cloudwatch:PutMetricAlarm`, `DeleteAlarms`,
`DescribeAlarms`, `TagResource`, `UntagResource`, `ListTagsForResource` on `arn:aws:cloudwatch:*:<account-id>:alarm:tenner-*`;
`sns:CreateTopic`, `DeleteTopic`, `GetTopicAttributes`, `SetTopicAttributes`, `Subscribe`, `Unsubscribe`,
`GetSubscriptionAttributes`, `ListSubscriptionsByTopic`, `TagResource`, `UntagResource`, `ListTagsForResource` on
`arn:aws:sns:*:<account-id>:tenner-alarms`.

### Notifications (NOTIFICATION-001)

The notifier Lambda `tenner-notifier` runs every 15 minutes (EventBridge rule) and sends notifications through
pluggable channels, deduplicated by the delivery log table `tenner-notifications` (TTL 90 days). It is created only
when the GitHub **variable** `NOTIFICATIONS_ENABLED` is `true`. Before setting it, extend `GitHubActionsDeployRole`:

- Lambda: manage `tenner-notifier` (create/update/delete function, configuration, tags, `AddPermission`,
  `RemovePermission`, `GetPolicy`)
- EventBridge: `events:PutRule`, `DescribeRule`, `DeleteRule`, `PutTargets`, `RemoveTargets`, `ListTargetsByRule`,
  `TagResource`, `UntagResource`, `ListTagsForResource` on `arn:aws:events:eu-central-1:<account-id>:rule/tenner-notifier-schedule`
- DynamoDB: create/update/tag the table `tenner-notifications` incl. `UpdateTimeToLive`, `DescribeTimeToLive`
- IAM: create/manage `tenner-notifier-role` and its inline policy, `iam:PassRole` for it to Lambda
- CloudWatch Logs: `/tenner/notifier`

Content: the daily digest (NOTIFICATION-003) at each member's time and overdue alerts (NOTIFICATION-004) at 17:00; until a real channel is connected it is
written to the notifier log only (`NotificationLogged`).

### Secrets (SECURITY-006)

Runtime secrets live in SSM Parameter Store as `SecureString` (AWS managed key `aws/ssm`) below
`/tenner/<environment>/<component>/<name>` ([ADR 0004](docs/decisions/0004-secrets-management.md)). Terraform
knows only the names (IAM and Lambda configuration) and never the values; an administrator sets them with AWS
access (placeholders, never commit or paste real values):

```bash
# create or rotate (warm Lambdas pick up a new value within 5 minutes)
aws ssm put-parameter --name /tenner/prod/<component>/<name> --type SecureString --value '<secret>' --overwrite
# mandatory tags (only needed once, after the first put-parameter)
aws ssm add-tags-to-resource --resource-type Parameter --resource-id /tenner/prod/<component>/<name> \
  --tags Key=Application,Value=Tenner Key=Project,Value=Tenner Key=Environment,Value=prod Key=ManagedBy,Value=Manual
# check that it exists (prints the name and version, not the value)
aws ssm describe-parameters --parameter-filters Key=Name,Values=/tenner/prod/<component>/<name>
# remove
aws ssm delete-parameter --name /tenner/prod/<component>/<name>
```

Secrets in use:

| Parameter | Feature | Value |
|---|---|---|
| `/tenner/prod/alexa/lwa-client-id` | Echo Show widget, Alexa notifications (ALEXA-007/008) | Alexa developer console → Tenner → Build → Permissions → "Alexa Skill Messaging" Client ID |
| `/tenner/prod/alexa/lwa-client-secret` | same | Client Secret from the same page | A missing secret only disables the feature
that needs it; the Lambda logs `secret unavailable` with the parameter name.

### Alexa Skill (ALEXA-001)

Setup, the one-time activation in the Alexa developer console, the GitHub variables `ALEXA_SKILL_ID` and
`ALEXA_REDIRECT_URLS` (account linking, ALEXA-002), the secrets `ASK_REFRESH_TOKEN` and `ASK_VENDOR_ID`, and
rollback are described in [`alexa/README.md`](alexa/README.md).
Without `ALEXA_SKILL_ID` nothing Alexa-related is deployed.

### Known Limitations

- `pr.yml` uses the deploy role for `terraform plan`, so pull request code runs with
  deploy permissions (TD-008).
- Actions are referenced by major version tag, not commit SHA (TD-009, SECURITY-008).
- Pull requests from forks get no OIDC token, so their Terraform job fails.
  Only same-repository branches are supported.
