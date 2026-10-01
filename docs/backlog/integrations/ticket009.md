# INTEGRATION-009: Provide Personal Access Tokens for Automations

## Type

Backend + Frontend Feature

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Allow users to complete Tenners from automations such as Apple Shortcuts,
Android Tasker, NFC tags or Home Assistant.

Examples:

```text
Tap NFC tag on the washing machine → complete "Clean washing machine filter"
Siri: "Tenner done vacuum office"
Home Assistant: robot vacuum finished → complete "Vacuum office"
```

---

# Background

Cognito access tokens are short-lived and unsuitable for automations.
Scoped, revocable personal access tokens (PATs) solve this safely.

---

# Dependencies

```text
SECURITY-004
TICKET-013
```

---

# Scope

## Tokens

- Created in Settings; shown once; stored hashed (SHA-256 with server-side pepper).
- Scopes: `tenners:complete`, `tenners:read` (no write/delete scopes).
- Optional expiry; last-used timestamp; revocation.
- Max 10 tokens per user.

## API

- Lambda authorizer (or middleware) accepting `Authorization: Bearer tnr_<token>` for a
  dedicated route set:

```text
GET  /automation/tenners
POST /automation/tenners/{tennerId}/complete
```

- Same completion rules and idempotency as the main API.

## Documentation

Example Apple Shortcut and Home Assistant `rest_command` configuration with placeholders.

---

# Testing Requirements

```text
Token Creation Shown Once
Hash Storage
Scope Enforcement
Revocation
Expiry
Rate Limiting
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
PAT management (API + UI)
Automation routes and authorizer
Examples documentation
Tests
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

- Users can create, use and revoke scoped tokens
- Tokens never stored in plain text
- Automation endpoints limited to read and complete
- Tests passing

---

# Definition of Done

- Tenners can be completed from the physical world and smart home

---

# Out of Scope

- OAuth for third-party apps
- Outgoing webhooks
