# SECURITY-011: Enable Multi-Factor Authentication

## Type

Security

---

## Priority

Low

---

## Phase

V2

---

## Goal

Allow household members to protect their accounts with MFA (TOTP authenticator app).

---

# Background

The architecture lists MFA as a future Cognito feature.

---

# Dependencies

```text
SECURITY-002
SECURITY-003
```

---

# Scope

- Cognito MFA configuration: `OPTIONAL`, TOTP only (no SMS: cost and SIM-swap risk).
- Enrollment via Cognito managed login.
- Settings shows MFA status with a link to enroll.
- Admin documentation: how to reset MFA for a member.
- Evaluate making MFA `REQUIRED` for ADMIN role (HOUSEHOLD-ADMIN-005).

---

# Deliverables

```text
Terraform MFA configuration
Settings MFA status
Documentation
```

---

# Validation

```bash
terraform fmt -check

terraform validate
```

Manual verification: enroll, log in with TOTP, reset.

---

# Acceptance Criteria

- TOTP MFA available
- SMS MFA disabled
- Enrollment and reset documented

---

# Definition of Done

- Accounts can be protected with a second factor

---

# Out of Scope

- WebAuthn / passkeys (evaluate when Cognito support fits)
