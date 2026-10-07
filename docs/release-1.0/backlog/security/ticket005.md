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
SECURITY-014
```

---

# Scope

Stage throttling was moved to SECURITY-014 (cost cap before the first deployment).
Verify it here as part of the baseline. Lambda reserved concurrency is tracked as TD-014.

## API Gateway

```text
Access logging enabled (JSON, no auth headers)
Payload size limits validated in handlers
```

## Lambda

```text
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

- [ ] API throttling (SECURITY-014) verified — configuration verified by tests; live burst test is a manual step
- [x] IAM policies reviewed and least privilege
- [x] Storage protections verified
- [x] Security documentation created

---

# Definition of Done

- Baseline security controls are in place and documented
- Infrastructure deploys through GitHub Actions

---

# Out of Scope

- AWS WAF (cost ~5+ USD/month; reconsider for Public SaaS, FUTURE-003)
- GuardDuty / Security Hub (cost evaluation needed; may become separate ticket)

---

# Implementation Status

Implemented 2026-10-05.

- IAM review (`docs/security.md`): `tenner-api-role` loses `dynamodb:Scan` and `dynamodb:DeleteItem` (never used;
  soft deletes only). Every remaining wildcard is justified (log streams, GSI ARNs). The deploy role is outside
  the repository; its broad grants are listed.
- CloudFront: `minimum_protocol_version = "TLSv1"`. With the default certificate CloudFront always uses TLSv1 and
  ignored `TLSv1.2_2021` (the permanent plan diff). TLS 1.2+ needs a custom domain (TD-025, TICKET-022).
- API: access logging verified (JSON, no headers/tokens/bodies). Request bodies > 16 KiB → 413
  `PAYLOAD_TOO_LARGE` before parsing (`parseJsonBody`).
- Lambda: Node.js 22, no secrets in environment variables (new Terraform test).
- DynamoDB/S3/Cognito: encryption, PITR, deletion protection, Block Public Access, TLS-only policies verified by
  existing Terraform tests.
- Docs: `docs/security.md` (trust boundaries, controls, IAM review, manual checks, residual risks), README,
  architecture link, TD-025.

Validation: Terraform `fmt -check`, `validate`, `test` (45 passed); backend lint, build, 438 tests.

Open (manual, outside Terraform):

- Account-level S3 Block Public Access: verify with the command in `docs/security.md` (not managed by Terraform,
  because the account may hold other projects).
- Throttling burst test (≤ 100 requests) in CloudShell; the sandbox used for implementation cannot reach the API.
