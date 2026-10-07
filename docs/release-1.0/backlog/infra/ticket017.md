# TICKET-017: Provision Frontend Hosting Infrastructure

## Type

Infrastructure

---

## Priority

Critical

---

## Phase

MVP

---

## Goal

Provision the AWS infrastructure required to host the Tenner React single-page application.

After completion of this ticket:

- A private S3 bucket stores the built frontend assets
- A CloudFront distribution serves the application over HTTPS
- The S3 bucket is only reachable through CloudFront
- Client-side routes (`/dashboard`, `/tenners`, `/settings`, ...) resolve correctly

---

# Background

The architecture defines the frontend delivery path:

```text
GitHub Actions
        ↓
Build
        ↓
S3
        ↓
CloudFront
```

The following capabilities already exist:

- CI/CD foundation (TICKET-001)
- Tagging standards (TICKET-001A)
- Terraform foundation and remote state (TICKET-002, TICKET-003)
- API foundation (TICKET-005)
- Frontend foundation (FRONTEND-001)

No ticket currently provisions frontend hosting. Without it, the MVP requirement
"All infrastructure is deployed using Terraform" cannot be met for the frontend.

---

# Dependencies

```text
TICKET-001A
TICKET-002
TICKET-003
FRONTEND-001
```

---

# Scope

Create with Terraform:

```text
S3 Bucket (frontend assets)

S3 Bucket Policy

CloudFront Origin Access Control

CloudFront Distribution

CloudFront Response Headers Policy
```

---

# S3 Bucket

## Name

```text
tenner-frontend-<environment>
```

## Requirements

```text
Block All Public Access

Server-Side Encryption (SSE-S3)

Versioning Enabled

Bucket Owner Enforced Object Ownership

Mandatory Tags
```

Static website hosting must not be enabled.

Access must happen exclusively via CloudFront Origin Access Control.

---

# CloudFront Distribution

## Requirements

```text
HTTPS Only (redirect HTTP to HTTPS)

Default Root Object: index.html

Origin Access Control (OAC), not legacy OAI

Price Class: PriceClass_100

HTTP/2 and HTTP/3 enabled

Compression enabled
```

---

## SPA Routing

Client-side routes must not return `403` or `404` from S3.

Configure custom error responses:

```text
403 → /index.html (200)
404 → /index.html (200)
```

---

## Caching Strategy

```text
index.html           → no-cache
/assets/* (hashed)   → long-lived (1 year, immutable)
```

Use AWS managed cache policies where possible.

---

## Security Headers

Attach a response headers policy containing:

```text
Strict-Transport-Security
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy (baseline, allows the API origin)
```

---

# API Integration

The frontend must be able to call the API Gateway endpoint.

Update the centralized API Gateway CORS configuration to allow the CloudFront
distribution domain as origin.

Do not use wildcard origins.

---

# Outputs

Expose Terraform outputs:

```text
frontend_bucket_name

cloudfront_distribution_id

cloudfront_domain_name
```

These outputs are consumed by the deployment workflow (TICKET-018).

---

# Cost

Expected monthly cost for personal usage:

```text
< 1 USD
```

Document the cost estimate in `docs/architecture.md`.

---

# Deliverables

Create or update:

```text
terraform/frontend-hosting (module or files)

Terraform outputs

API Gateway CORS configuration

docs/architecture.md

README.md
```

---

# Validation

The following must succeed:

```bash
terraform fmt -check

terraform validate

terraform plan
```

Manual verification after deployment:

```bash
curl -I https://<cloudfront_domain_name>/
curl -I https://<cloudfront_domain_name>/settings
```

Both must return `200`.

Direct S3 object access must return `403`.

---

# Acceptance Criteria

- Private S3 bucket exists with public access blocked
- CloudFront distribution serves the application over HTTPS
- S3 bucket is only accessible via OAC
- SPA routes resolve to index.html
- Cache policies differ for index.html and hashed assets
- Security headers are returned
- CORS allows only the CloudFront origin
- All resources carry mandatory tags
- Terraform outputs exist
- Documentation updated

---

# Definition of Done

- Frontend hosting is fully managed by Terraform
- No manual AWS configuration exists
- Infrastructure validation passes
- Infrastructure deploys through GitHub Actions

---

# Out of Scope

Do not implement:

- Frontend asset upload (TICKET-018)
- Custom domain and ACM certificate (TICKET-022)
- AWS WAF
- Authentication
- Multiple environments (TICKET-021)

This ticket only provisions frontend hosting infrastructure.

---

## Implementation Status

Implemented: 2026-10-01.

### Deliverables

- [x] `terraform/frontend-hosting.tf`:
  - S3 bucket with versioning, SSE-S3, Block Public Access, BucketOwnerEnforced and a 30-day lifecycle for old versions
  - Origin Access Control and a bucket policy (CloudFront plus `SourceArn` only, TLS only)
  - response headers policy and the CloudFront distribution
- [x] API Gateway CORS (`cors_configuration` in `terraform/api.tf`): only the CloudFront origin
- [x] Outputs `frontend_bucket_name`, `cloudfront_distribution_id`, `cloudfront_domain_name`, `frontend_url`
- [x] `terraform/tests/frontend_hosting.tftest.hcl`: 5 runs
- [x] `docs/architecture.md` (Frontend Hosting, including cost), `README.md` (CI permissions), TD-011 extended

### Acceptance Criteria

| Criterion | Status |
|---|---|
| Private S3 bucket exists with public access blocked | [x] defined and tested |
| CloudFront distribution serves the application over HTTPS | [x] `redirect-to-https`, TLS ≥ 1.2 (tested) |
| S3 bucket is only accessible via OAC | [x] OAC (SigV4, always) and bucket policy with `AWS:SourceArn` (tested) |
| SPA routes resolve to index.html | [x] 403/404 → `/index.html` with 200 (tested; mutation check fails without 404) |
| Cache policies differ for index.html and hashed assets | [x] CachingDisabled vs. CachingOptimized for `/assets/*` (tested) |
| Security headers are returned | [x] HSTS, nosniff, DENY, Referrer-Policy, CSP (tested) |
| CORS allows only the CloudFront origin | [x] tested. Mutation check: `"*"` makes the test fail |
| All resources carry mandatory tags | [x] offline plan: 40 resources, `check_tags.py` compliant |
| Terraform outputs exist | [x] |
| Documentation updated | [x] |

Manual verification (`curl` against CloudFront, 403 on direct S3 access) is only possible after the first deploy.

### Assumptions

- **CSP `connect-src`:** `https://*.execute-api.<region>.amazonaws.com` instead of the exact API host. The exact host
  would create a cycle (distribution → headers policy → API → CORS → distribution). TICKET-022 (custom domain) makes
  it exact.
- **Managed cache policies** are referenced by their fixed global IDs (constants in `locals.tf`), so `plan` needs no
  extra API lookups.
- **Default behavior:** "no-cache for index.html" is implemented as CloudFront `CachingDisabled` on the default
  behavior. The browser `Cache-Control` headers come from the upload in TICKET-018.
- The bucket is **not** `prevent_destroy`: it only holds rebuildable build artifacts, unlike state and tables.
- `frontend/` does not exist yet (FRONTEND-001). Hosting works independently of it. The upload follows in TICKET-018.
