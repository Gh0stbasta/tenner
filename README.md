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
- the frontend foundation (FRONTEND-001): React, MUI, routing, API client in [`frontend/`](frontend/README.md)
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
