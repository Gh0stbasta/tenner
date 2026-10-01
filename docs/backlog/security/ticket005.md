# SECURITY-005: Harden AWS Resources

## Type

Infrastructure / Security

---

## Priority

High

---

## Phase

MVP

---

## Goal

Apply a security baseline to all Tenner AWS resources and verify least privilege.

---

# Background

Individual tickets introduced resources with sensible defaults, but no ticket
verifies the overall security posture. Specific gaps:

```text
API throttling limits not defined (cost and abuse risk)
IAM policies not reviewed as a whole
No account-level S3 public access block verification
Log retention and data encryption not reviewed centrally
```

---

# Dependencies

```text
TICKET-005
TICKET-006
TICKET-017
```

---

# Scope

## API Gateway

```text
Default route throttling: burst 20, rate 10 req/s (adjust after measurement)
Access logging enabled (JSON, no auth headers)
Payload size limits validated in handlers
```

## Lambda

```text
Reserved concurrency cap (e.g. 10) to bound cost under abuse
Environment variables contain no secrets
Runtime on a supported version
```

## IAM

- Review every policy; no `*` actions or resources except where AWS requires them
  (document each exception).
- Document the final permission set per role in `docs/security.md`.

## S3 / CloudFront

```text
Account-level S3 Block Public Access (if account owned by project — otherwise document)
TLS 1.2+ minimum protocol on CloudFront
```

## DynamoDB

```text
PITR enabled (verify)
Deletion protection enabled (verify)
Encryption at rest (verify)
```

## Documentation

Create `docs/security.md` summarizing controls, trust boundaries and residual risks.

---

# Testing Requirements

```text
terraform validate
Throttling verified with a short load test (≤ 100 requests)
IAM policy review checklist completed
```

---

# Deliverables

```text
Terraform hardening changes
docs/security.md
IAM review checklist
```

---

# Validation

```bash
terraform fmt -check

terraform validate

terraform plan
```

---

# Acceptance Criteria

- API throttling configured
- Lambda concurrency capped
- IAM policies reviewed and least privilege
- Storage protections verified
- Security documentation created

---

# Definition of Done

- Baseline security controls are in place and documented
- Infrastructure deploys through GitHub Actions

---

# Out of Scope

- AWS WAF (cost ~5+ USD/month; reconsider for Public SaaS, FUTURE-003)
- GuardDuty / Security Hub (cost evaluation needed; may become separate ticket)
