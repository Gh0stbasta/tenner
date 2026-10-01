# FUTURE-011: Add Social Login

## Type

Security Feature (Postponed)

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Allow signing in with Google or Apple accounts via Cognito federation.

---

# Background

Listed in the architecture as a future Cognito feature. Mainly valuable for public
sign-up (FUTURE-003); for a single household with admin-created accounts the benefit is small.

---

# Dependencies

```text
SECURITY-002
SECURITY-003
FUTURE-003
```

---

# Scope

- Cognito identity providers (Google, Sign in with Apple); client secrets per SECURITY-006.
- Account linking: federated identity must map to an existing invited member
  (no automatic account creation unless public sign-up exists).
- Custom attributes (`tenantId`, `userId`) assigned via pre-token-generation or
  post-confirmation trigger from the invitation.

---

# Deliverables

```text
Identity provider configuration
Linking logic
Documentation
Tests
```

---

# Acceptance Criteria

- Members can sign in with Google/Apple
- No unauthorized account creation
- Secrets stored securely

---

# Definition of Done

- Login is convenient without weakening access control

---

# Out of Scope

- Enterprise SSO (SAML)
