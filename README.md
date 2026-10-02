# Tenner

Tenner is a small serverless web app that helps individuals and families keep up with
recurring responsibilities through small, ten-minute tasks ("Tenners").

> If something can be improved in 10 minutes, do a Tenner.

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
- the DynamoDB persistence layer (TICKET-006): tables `tenner-tenners` and `tenner-history` with GSIs
- the backend API (TICKET-008 to TICKET-016): CRUD, complete/undo/restore workflows and dashboard (see [`backend/README.md`](backend/README.md))
- frontend hosting (TICKET-017): private S3 bucket `tenner-frontend-<env>` behind CloudFront with Origin Access Control; URL in the Terraform output `frontend_url`
- the backend extension for archived Tenners (TICKET-024, `GET /tenners?deleted=true`) and API throttling (SECURITY-014)
- the German web app in [`frontend/`](frontend/README.md) (FRONTEND-001 – 007, FRONTEND-009, UX-005): dashboard,
  Tenner management with search and filters, create/edit dialogs, Quick Add, complete with undo, recent activity,
  Tenner detail with history, central error handling. It is published to CloudFront by `deploy.yml`.
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
- DynamoDB tables `tenner-tenners` and `tenner-history` (create, update, tag, PITR)
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
| [`pr.yml`](.github/workflows/pr.yml) | `pull_request` | Runs `terraform fmt -check`, `validate` and `test` offline. Then checks AWS identity, builds the Lambda bundle, runs `terraform plan` and enforces mandatory tags on the plan. Runs frontend and backend `npm ci`, `lint`, `test`, `build`. **Never applies.** |
| [`deploy.yml`](.github/workflows/deploy.yml) | push to `main` | Builds frontend and backend as a gate, checks AWS identity, then runs `terraform init` and `plan`, enforces mandatory tags, applies the checked plan, calls `GET /health` on the deployed API, then builds the frontend against that API and publishes it to S3/CloudFront (`scripts/deploy-frontend.sh`). |

Settings:

| Setting | Value |
|---|---|
| AWS region | `eu-central-1` |
| Terraform version | `1.16.4` (`TF_VERSION` in both workflows) |
| Node.js version | `22` (`NODE_VERSION` in both workflows) |
| Terraform directory | `terraform/` |
| Application directories | `frontend/`, `backend/` |

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
passwords. Anyone with a Google account can sign in, but only accounts that an administrator adds to a
household group can see or change data. Everyone else sees "Konto nicht eingerichtet" and gets 403 from the API.

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

#### Add someone to the household

Membership is a Cognito group `household:<tenantId>:<userId>`. Terraform creates `household:default:STEFAN`
and `household:default:JULIA`. After a person has signed in with Google once (and seen
"Konto nicht eingerichtet"), add them in AWS CloudShell (region `eu-central-1`):

```bash
POOL_ID=$(aws cognito-idp list-user-pools --max-results 20 \
  --query "UserPools[?Name=='tenner-users-prod'].Id | [0]" --output text)

# Who has signed in? Google users are named google_<number>.
aws cognito-idp list-users --user-pool-id "$POOL_ID" \
  --query "Users[].[Username, Attributes[?Name=='email'].Value | [0], UserCreateDate]" --output table

aws cognito-idp admin-add-user-to-group --user-pool-id "$POOL_ID" \
  --username "google_<number>" --group-name "household:default:STEFAN"
```

The person then signs out and in again (or waits up to 60 minutes for the next token refresh).
Each account must be in **exactly one** household group.

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

### API Throttling

The API stage is throttled to protect against cost spikes (SECURITY-014): burst 20 and
10 requests per second by default, shared by all clients. Excess requests get HTTP 429.
Change the limits through the Terraform variables `api_throttling_burst_limit` and
`api_throttling_rate_limit` (`terraform/variables.tf`), then merge to `main`.

### Rollback

- **Workflow or application changes:** revert the commit on `main`. The deploy workflow then
  re-applies the previous state and republishes the previous frontend.
- **Frontend only (emergency):** the bucket is versioned and keeps previous object versions for 30 days.
  Restore the previous `index.html` version in S3, then invalidate `/index.html`.
- **Infrastructure changes:** reverting the Terraform code and letting `deploy.yml` apply it
  is the only supported way. Manual changes in AWS are not allowed (see `docs/architecture.md`).

### Known Limitations

- `pr.yml` uses the deploy role for `terraform plan`, so pull request code runs with
  deploy permissions (TD-008).
- Actions are referenced by major version tag, not commit SHA (TD-009, SECURITY-008).
- Pull requests from forks get no OIDC token, so their Terraform job fails.
  Only same-repository branches are supported.
