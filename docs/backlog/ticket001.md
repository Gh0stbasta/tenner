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
