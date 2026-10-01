# NOTIFICATION-005: Implement Email Notification Channel

## Type

Backend / Infrastructure

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Deliver notifications by email.

---

# Background

Email is universal and requires no extra app.

Amazon SES is **not** in the list of allowed services in `docs/architecture.md`
(API Gateway, Lambda, DynamoDB, S3, CloudFront, EventBridge, Cognito).

SES is serverless and pay-per-use, so it is consistent with the "Serverless Only"
principle, but the list must be extended through a documented architecture decision.

---

# Dependencies

```text
NOTIFICATION-001
NOTIFICATION-002
TICKET-022 (custom domain for sender identity)
```

---

# Scope

## Architecture Decision

Create an ADR in `docs/decisions/`:

```text
Context:  email notifications required
Options:  SES | third-party email API | no email
Decision: (expected) SES
Consequences: domain verification, sandbox exit request, bounce handling
```

Update the allowed-services list in `docs/architecture.md` only after the decision.

## Infrastructure

```text
SES domain identity with DKIM
SPF and DMARC DNS records (Route53)
Configuration set for bounce/complaint events
```

## Channel

Implement `EmailChannel` against the channel interface.

- Plain-text and simple HTML bodies.
- Unsubscribe link (deep link to settings).
- Sender address configurable via variable, no hardcoded addresses.

## Address Verification

- Address entered in settings is unverified.
- A verification email with a single-use token (expires 24h) must be confirmed before use.
- Unverified addresses never receive notifications.

## Bounces

On hard bounce or complaint, mark the address as unverified and stop sending.

---

# Security

- Verification tokens stored hashed.
- Email addresses never logged.
- SES permissions restricted to the identity ARN.

---

# Cost

```text
SES: 0.10 USD per 1,000 emails → negligible
```

---

# Testing Requirements

```text
Email Rendering
Verification Flow
Expired Token
Unverified Address Skipped
Bounce Handling
Channel Failure Isolation
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
ADR
SES Terraform resources
EmailChannel
Verification endpoints
Tests
Documentation
```

---

# Validation

```bash
terraform fmt -check

terraform validate

npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- ADR approved and documented
- SES identity verified with DKIM
- Email channel delivers notifications
- Address verification enforced
- Bounces disable sending
- No addresses in logs
- Tests passing

---

# Definition of Done

- Users can receive notifications by email
- Infrastructure deploys through GitHub Actions

---

# Out of Scope

- Rich HTML templates
- Inbound email processing
- Marketing emails
