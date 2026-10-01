# TICKET-018: Automate Frontend Deployment

## Type

Infrastructure / CI/CD

---

## Priority

Critical

---

## Phase

MVP

---

## Goal

Extend the GitHub Actions deployment workflow so that every merge to `main`
builds the frontend and publishes it to the hosting infrastructure.

After completion of this ticket a merge to `main` must result in the new frontend
version being live on CloudFront without any manual step.

---

# Background

The architecture defines the main-branch deployment sequence:

```text
1. Assume AWS role using GitHub OIDC
2. Execute Terraform Apply
3. Deploy frontend assets to S3
4. Invalidate CloudFront cache
```

Steps 1 and 2 exist (TICKET-001). Hosting infrastructure is provided by TICKET-017.

Steps 3 and 4 are missing.

---

# Dependencies

```text
TICKET-001
TICKET-017
FRONTEND-001
```

---

# Scope

Update:

```text
.github/workflows/deploy.yml
```

Add jobs or steps:

```text
Frontend Install (npm ci)

Frontend Build

Read Terraform Outputs

Upload Assets To S3

Invalidate CloudFront
```

---

# Build Configuration

The frontend build must receive the API base URL from Terraform outputs.

Example:

```text
VITE_API_BASE_URL=<api_endpoint_output>
```

Do not hardcode API URLs in the workflow or source code.

---

# Upload Strategy

Upload in two passes:

```text
1. /assets/*  with Cache-Control: public, max-age=31536000, immutable
2. index.html and remaining files with Cache-Control: no-cache
```

Use:

```bash
aws s3 sync --delete
```

The upload must be idempotent.

---

# Cache Invalidation

Invalidate only:

```text
/index.html
/
```

Hashed assets do not require invalidation.

This keeps CloudFront invalidation within the free monthly allowance.

---

# IAM Requirements

Extend `GithubActionsDeployRole` permissions only if required:

```text
s3:PutObject
s3:DeleteObject
s3:ListBucket
cloudfront:CreateInvalidation
```

Restrict resources to the frontend bucket and distribution ARN.

Wildcard resources are not permitted.

Changes to the role must be made via Terraform if the role is Terraform-managed.
If the role is managed outside this repository, document the required policy instead.

---

# Ordering

Frontend deployment must run only after Terraform Apply succeeded.

A failed frontend build must not leave a partially uploaded release.
Build first, upload afterwards.

---

# Rollback

Document rollback in `README.md`:

```text
Revert the commit on main → pipeline redeploys the previous version
```

S3 versioning (TICKET-017) provides an additional manual recovery path.

---

# Deliverables

Update:

```text
.github/workflows/deploy.yml

README.md (deployment + rollback)
```

Optionally update:

```text
IAM policy for GithubActionsDeployRole
```

---

# Validation

```bash
npm run lint

npm run build
```

Verify a full pipeline run on `main` and that the deployed version is served by CloudFront.

---

# Acceptance Criteria

- Merge to main builds the frontend
- Assets are uploaded to the frontend bucket
- index.html is served with no-cache
- Hashed assets are served with immutable caching
- CloudFront invalidation is executed for index.html only
- API base URL is injected from Terraform outputs
- Deployment uses OIDC only
- IAM permissions follow least privilege
- Rollback procedure documented

---

# Definition of Done

- Frontend is continuously deployed
- No manual deployment step exists
- Pipeline runs successfully in GitHub Actions
- Documentation updated

---

# Out of Scope

Do not implement:

- Preview environments per pull request
- Multiple environments
- Blue/green deployments
- Post-deployment smoke tests (OPERATIONS-006)
