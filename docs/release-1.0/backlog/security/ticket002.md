# SECURITY-002: Implement Cognito User Pool and API Authorizer

## Type

Infrastructure / Security

---

## Priority

Critical

---

## Phase

MVP

---

## Goal

Protect every API endpoint (except `/health`) with authentication using an
Amazon Cognito User Pool and an API Gateway JWT authorizer.

---

# Background

Implements the decision from SECURITY-001 ([ADR 0001](../../../decisions/0001-authentication.md): Option A, one account per member).

Version 1 requires no self-service registration: accounts are created by an
administrator.

---

# Dependencies

```text
SECURITY-001
TICKET-005
```

---

# Scope

## Cognito (Terraform)

```text
User Pool
  self sign-up disabled
  email as username
  password policy: min 12 chars
  advanced security / threat protection: evaluate cost, enable if within budget
  account recovery via verified email
  deletion protection enabled

App Client (public SPA client)
  no client secret
  Authorization Code flow with PKCE
  callback/logout URLs: CloudFront domain (+ custom domain if configured)
  access token validity: 1 hour
  refresh token validity: 30 days

Hosted UI / Managed login domain (prefix based, no custom domain required)
```

## Custom Attributes

```text
custom:tenantId   (immutable, "default" for the existing household)
custom:userId     (maps to household member, e.g. STEFAN)
```

Attributes must be writable only by administrators, not by the app client.

## API Gateway

- JWT authorizer using the user pool issuer and app client audience.
- Attach to all routes except `GET /health`.
- Webhook routes for integrations (e.g. Telegram) use their own verification and are
  explicitly excluded; document each exclusion.

## User Provisioning

Document admin commands (AWS CLI) to create users and set attributes.
No credentials in the repository.

---

# Security Considerations

- Tokens never logged.
- CORS still restricted to known origins.
- Unauthenticated requests return `401` without details.

---

# Testing Requirements

```text
Terraform validate
Request Without Token → 401
Request With Expired Token → 401
Request With Valid Token → 200
Health Endpoint Public
Attribute Write Protection (app client cannot set custom attributes)
```

---

# Deliverables

```text
Cognito Terraform resources
JWT authorizer on routes
Admin provisioning documentation
docs/architecture.md security section
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

- User pool and app client exist
- Self sign-up disabled
- All non-public routes require a valid JWT
- Custom attributes protected from client writes
- Provisioning documented without secrets
- Tests/verification passed

---

# Definition of Done

- The API is no longer publicly writable
- Infrastructure deploys through GitHub Actions

---

# Out of Scope

- Frontend login (SECURITY-003)
- Using identity in business logic (SECURITY-004)
- MFA (SECURITY-011)

---

# Implementation Status

Implemented 2026-10-02 (`terraform/auth.tf`).

- [x] User pool `tenner-users-prod` (Essentials) and public app client `tenner-web-prod` (code + PKCE)
- [x] Self sign-up disabled; e-mail username; password ≥ 12; recovery via verified e-mail; deletion protection
- [x] Custom attributes `custom:tenantId` (immutable) and `custom:userId`; the app client can only write `email`
- [x] Managed login domain (prefix from a hash of the account ID) with default branding
- [x] JWT authorizer on all routes except `GET /health` (no webhook routes exist yet)
- [x] Provisioning documented without secrets (README → "User Accounts"); deploy role permissions listed
- [x] Tests: 5 new offline Terraform runs (pool, client, domain, routes/authorizer, CSP); `fmt`, `validate`,
  `test` (38 passed); mutation checks (custom attribute writable, extra public route) make the tests fail
- [ ] Live verification after deployment: request without token → 401, expired token → 401, valid token → 200,
  `/health` public, app client cannot update `custom:userId` (`aws cognito-idp update-user-attributes` with a user
  token must fail). Done after the merge; results go into this section.

Deviations and assumptions:

- Threat protection (Plus tier) is not enabled: Essentials includes managed login and stays free;
  Cognito's built-in lockout and the password policy apply. Revisit with SECURITY-011.
- E-mails are sent by Cognito's default sender (limited daily volume, enough for two invitations).
- No custom domain for the login page (TICKET-022).

