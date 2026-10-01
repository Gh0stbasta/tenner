# TICKET-022: Configure Custom Domain and TLS

## Type

Infrastructure

---

## Priority

Low

---

## Phase

V2

---

## Goal

Serve Tenner under a memorable custom domain with a managed TLS certificate.

Example:

```text
https://tenner.<your-domain>
https://api.tenner.<your-domain>
```

---

# Background

After TICKET-017 the application is reachable only via a generated
`*.cloudfront.net` domain and the API via a generated `execute-api` domain.

A custom domain improves usability (bookmarking, PWA installation, notification links)
and is a prerequisite for some integrations (OAuth redirect URIs, Telegram webhooks).

---

# Dependencies

```text
TICKET-017
TICKET-005
```

---

# Scope

Create with Terraform:

```text
Route53 Hosted Zone (or data source for an existing zone)

ACM Certificate in us-east-1 (CloudFront)

ACM Certificate in eu-central-1 (API Gateway)

DNS validation records

CloudFront alternate domain name

API Gateway custom domain + API mapping

Route53 alias records
```

---

# Configuration

The domain must be configurable:

```text
var.domain_name
```

If `domain_name` is empty, no domain resources are created and the default
CloudFront/API domains continue to work.

Do not hardcode any domain in Terraform or source code.

---

# CORS

Update the API CORS configuration to allow the custom frontend origin.

---

# Cost

```text
Route53 Hosted Zone: ~0.50 USD / month
ACM: free
```

Document in `docs/architecture.md`.

---

# Deliverables

```text
Terraform domain resources

Configurable domain variables

Updated CORS configuration

Updated frontend build configuration (API base URL)

docs/architecture.md

README.md
```

---

# Validation

```bash
terraform fmt -check

terraform validate

terraform plan
```

Manual verification:

```bash
curl -I https://tenner.<domain>/
curl https://api.tenner.<domain>/health
```

---

# Acceptance Criteria

- Custom domain serves the frontend over HTTPS
- Custom API domain serves the API over HTTPS
- Certificates validated via DNS automatically
- Domain resources optional via variable
- No hardcoded domain values
- Documentation updated

---

# Definition of Done

- Tenner is reachable under a custom domain
- Certificates renew automatically
- Infrastructure deploys through GitHub Actions

---

# Out of Scope

Do not implement:

- Domain registration
- Email DNS records (SPF, DKIM, DMARC) — see NOTIFICATION-005
- Multiple domains
