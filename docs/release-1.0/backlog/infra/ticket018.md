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

---

## Implementation Status

Implemented: 2026-10-01.

### Deliverables

- [x] `.github/workflows/deploy.yml`: after apply and health check, it builds the frontend with
  `VITE_API_BASE_URL` = `terraform output api_endpoint`, then publishes. Skipped while `frontend/package.json` is missing.
- [x] `scripts/deploy-frontend.sh`: asset upload (immutable), then index and other files (no-cache, `--delete`),
  then CloudFront invalidation
- [x] `README.md`: deployment, rollback, required IAM permissions
- [x] IAM policy for `GithubActionsDeployRole`: documented. The role is managed outside this repository (TICKET-001).

### Acceptance Criteria

| Criterion | Status |
|---|---|
| Merge to main builds the frontend | [x] (once `frontend/` exists) |
| Assets are uploaded to the frontend bucket | [x] script tested with a fake `aws` CLI |
| index.html is served with no-cache | [x] `--cache-control no-cache` |
| Hashed assets are served with immutable caching | [x] `public, max-age=31536000, immutable` |
| CloudFront invalidation is executed for index.html only | [x] `/index.html` and `/` (the root path also serves index.html) |
| API base URL is injected from Terraform outputs | [x] `VITE_API_BASE_URL` |
| Deployment uses OIDC only | [x] same job as Terraform apply, no keys |
| IAM permissions follow least privilege | [x] documented: ListBucket, Put/DeleteObject on the bucket, CreateInvalidation on the distribution |
| Rollback procedure documented | [x] README: revert on `main`, or restore an S3 version for emergencies |

### Validation Performed

- `actionlint` passes for both workflows. `shellcheck` passes for `scripts/*.sh`.
- `deploy-frontend.sh` with a fake `aws` CLI: the order and arguments of the three calls are correct.
  The error paths (missing `index.html` → exit 1, wrong arguments → exit 2) work.
- A real pipeline run needs `frontend/` (FRONTEND-001) and AWS access.

### Assumptions

- **No `--delete` for `assets/`:** old hashed assets are kept, so browser tabs still running the previous release
  can lazy-load their chunks. Otherwise the SPA fallback would return `index.html` instead of the JavaScript.
  Growth is minimal at household scale. `index.html` and other files are synced with `--delete`.
- **Order:** assets first, then `index.html`, so a new `index.html` never references missing files.
- **Build location:** the frontend is built again in the Terraform job, after apply. This is needed for the API URL.
  The `build` job remains as an early gate.
- The output directory is `frontend/dist` (Vite default, FRONTEND-001).
