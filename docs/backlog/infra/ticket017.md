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
