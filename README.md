# Tenner

Tenner is a small serverless web app that helps individuals and families keep up with
recurring responsibilities through small, ten-minute tasks ("Tenners").

> If something can be improved in 10 minutes, do a Tenner.

- Architecture: [`docs/architecture.md`](docs/architecture.md)
- Roadmap: [`docs/roadmap.md`](docs/roadmap.md)
- Backlog: [`docs/backlog/README.md`](docs/backlog/README.md)
- Technical debt: [`docs/technical-debt.md`](docs/technical-debt.md)

## Current State

The repository contains the CI/CD workflows (TICKET-001) and the project documentation.
Terraform, frontend and backend code will be added by later backlog tickets.

---

## Deployment

All deployments run in GitHub Actions. AWS access uses **GitHub OIDC only**: no AWS
access keys exist in GitHub or in this repository.

### Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| [`pr.yml`](.github/workflows/pr.yml) | `pull_request` | Checks AWS identity, runs `terraform fmt -check`, `init`, `validate`, `plan`, then frontend and backend `npm ci`, `lint`, `test`, `build`. **Never applies.** |
| [`deploy.yml`](.github/workflows/deploy.yml) | push to `main` | Builds frontend and backend as a gate, checks AWS identity, then runs `terraform init` and `terraform apply`. |

Settings:

| Setting | Value |
|---|---|
| AWS region | `eu-central-1` |
| Terraform version | `1.9.8` (`TF_VERSION` in both workflows) |
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

1. **IAM role `GithubActionsDeployRole`.** It must trust the GitHub OIDC provider
   `token.actions.githubusercontent.com` with audience `sts.amazonaws.com`, and allow these subjects:

   ```text
   repo:Gh0stbasta/tenner:ref:refs/heads/main   (deploy.yml)
   repo:Gh0stbasta/tenner:pull_request          (pr.yml: identity check and terraform plan)
   ```

2. **Repository secret `AWS_ROLE_ARN`** containing the ARN of that role.

If the PR subject is not trusted, `pr.yml` fails at "Configure AWS credentials".

### Verifying the setup

1. Open a pull request. Check that **PR Validation** passes and that the "Verify AWS identity"
   step prints the assumed `GithubActionsDeployRole` session.
2. Merge to `main`. Check that **Deploy** passes and shows the same identity.

### Rollback

- **Workflow or application changes:** revert the commit on `main`. The deploy workflow then
  re-applies the previous state.
- **Infrastructure changes:** reverting the Terraform code and letting `deploy.yml` apply it
  is the only supported way. Manual changes in AWS are not allowed (see `docs/architecture.md`).

### Known Limitations

- `pr.yml` uses the deploy role for `terraform plan`, so pull request code runs with
  deploy permissions (TD-008).
- Actions are referenced by major version tag, not commit SHA (TD-009, SECURITY-008).
- Pull requests from forks get no OIDC token, so their Terraform job fails.
  Only same-repository branches are supported.
