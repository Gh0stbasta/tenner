# TICKET-001: Establish CI/CD Pipeline and AWS Deployment Foundation

## Type

Infrastructure

---

## Priority

High

---

## Goal

Create the complete CI/CD foundation for Tenner so that all future development can be automatically validated and deployed.

The pipeline must support:

- Pull Request validation
- Terraform planning
- Automatic deployment after merge to main
- AWS authentication using GitHub OIDC
- Infrastructure deployment via Terraform

This ticket establishes the deployment foundation required for all subsequent work.

---

## Background

The AWS deployment account and GitHub OIDC configuration already exist.

The following IAM role is available and intended for deployments:

```text
GithubActionsDeployRole
```

The repository secret already exists:

```text
AWS_ROLE_ARN
```

GitHub Actions must use OIDC authentication exclusively.

AWS access keys must never be created or stored in GitHub.

---

## Requirements

### GitHub Actions

Create the following workflows:

```text
.github/workflows/pr.yml

.github/workflows/deploy.yml
```

---

### PR Validation Workflow

Trigger:

```text
pull_request
```

Workflow responsibilities:

```text
Terraform format validation
Terraform validation
Terraform plan

Frontend build

Backend build
```

The workflow must fail if:

- Terraform formatting is invalid
- Terraform validation fails
- Frontend build fails
- Backend build fails

Terraform Apply must never execute during pull requests.

---

### Deployment Workflow

Trigger:

```text
push to main
```

Workflow responsibilities:

```text
Authenticate to AWS using OIDC

Terraform Init

Terraform Apply
```

Deployment must use:

```text
AWS_ROLE_ARN
```

from GitHub repository secrets.

Deployment must target:

```text
eu-central-1
```

---

## AWS Authentication

Use:

```yaml
aws-actions/configure-aws-credentials
```

Requirements:

```text
OIDC only

No AWS access keys

No static credentials

No manual login
```

---

## Verification Step

Both workflows should verify AWS authentication using:

```bash
aws sts get-caller-identity
```

The command output should confirm successful role assumption.

---

## Repository Updates

Create:

```text
.github/workflows/pr.yml

.github/workflows/deploy.yml
```

Update:

```text
README.md
```

with deployment information.

---

## Acceptance Criteria

### Pull Requests

When a pull request is opened:

- Terraform fmt check executes
- Terraform validate executes
- Terraform plan executes
- Frontend build executes
- Backend build executes
- No infrastructure changes are applied

---

### Main Branch

When code is merged to main:

- GitHub Actions successfully authenticates to AWS
- GithubActionsDeployRole is assumed
- Terraform Apply executes successfully
- Infrastructure changes are deployed automatically

---

## Definition of Done

- CI/CD workflows exist
- OIDC authentication works
- Terraform Plan executes in pull requests
- Terraform Apply executes on merge to main
- No AWS access keys are used
- Documentation updated
- Workflow runs successfully in GitHub Actions

---

## Out of Scope

Do not implement:

- Frontend hosting
- CloudFront deployment
- S3 deployment
- Lambda deployment
- Application infrastructure

This ticket only establishes the CI/CD deployment foundation.

---

## Implementation Status

Implemented: 2026-10-01.

### Deliverables

- [x] `.github/workflows/pr.yml`
- [x] `.github/workflows/deploy.yml`
- [x] `README.md` with deployment, prerequisites and rollback information

### Acceptance Criteria Verification

The workflow definitions implement every criterion. Local checks: `actionlint` with
shellcheck passes, and the Terraform and npm commands were run against throwaway projects.
Behavior on GitHub can only be verified by real workflow runs.

| Criterion | Implemented | Verified on GitHub |
|---|---|---|
| PR: Terraform fmt check executes | [x] | [ ] |
| PR: Terraform validate executes | [x] | [ ] |
| PR: Terraform plan executes | [x] | [ ] |
| PR: Frontend build executes | [x] | [ ] |
| PR: Backend build executes | [x] | [ ] |
| PR: No infrastructure changes are applied | [x] (no apply step in `pr.yml`) | [ ] |
| Main: authenticates to AWS | [x] | [ ] |
| Main: GithubActionsDeployRole is assumed | [x] | [ ] |
| Main: Terraform Apply executes | [x] | [ ] |
| Main: changes deployed automatically | [x] | [ ] |

### Assumptions

- No `terraform/`, `frontend/` or `backend/` directories exist yet. Their steps are skipped with
  a notice until the directories exist, and then run automatically. Until TICKET-002, Terraform
  steps are skipped on GitHub.
- The role `GithubActionsDeployRole` and the secret `AWS_ROLE_ARN` already exist (stated in
  Background). The PR workflow also needs the role to trust the `pull_request` OIDC subject,
  because it runs `aws sts get-caller-identity` and `terraform plan`.
- `docs/architecture.md` (authoritative) lists `npm lint` and `npm test` for pull requests, so
  `pr.yml` runs them with `--if-present` in addition to the builds this ticket requires.
- Terraform `1.9.8` and Node.js `22` are pinned in the workflow `env` blocks.

### Remaining Verification (requires GitHub/AWS)

- [ ] First PR run passes and shows the assumed role.
- [ ] First `main` run passes and shows the assumed role.

### Technical Debt

TD-008 (PR plan uses deploy role), TD-009 (actions not pinned by SHA).
