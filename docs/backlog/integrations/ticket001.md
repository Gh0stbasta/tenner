# INTEGRATION-001: Establish Integration Foundation

> **Note (2026-10-06, BACKLOG-002):** Telegram was dropped (NOTIFICATION-006, INTEGRATION-002 removed); `TELEGRAM` is no longer a planned provider.

## Type

Backend Architecture

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Provide shared building blocks for third-party integrations so that each integration
ticket only implements provider-specific logic.

---

# Background

Planned integrations (Telegram, Strava, Garmin, Google Calendar, Outlook) share needs:

```text
OAuth 2.0 authorization code flow
Secure token storage and refresh
Inbound webhooks with signature verification
Per-user connection state
Mapping external events to Tenner actions
```

---

# Dependencies

```text
SECURITY-002
SECURITY-004
SECURITY-006
```

---

# Scope

## Connections Model

Table or items (`tenner-integrations`):

```text
tenantId, connectionId
provider          TELEGRAM | STRAVA | GARMIN | GOOGLE_CALENDAR | OUTLOOK
userId
status            CONNECTED | ERROR | REVOKED
externalAccountId
scopes
tokenRef          reference to encrypted token storage (never raw token in plain attribute)
createdAt, lastSyncAt, lastError
```

Tokens encrypted with KMS (envelope encryption) or stored in SSM per SECURITY-006 decision.

## OAuth Helper

```text
GET  /integrations/{provider}/connect    → redirect with state + PKCE
GET  /integrations/{provider}/callback   → exchange code, store tokens
DELETE /integrations/{provider}          → revoke at provider + delete tokens
```

`state` is signed, single-use, bound to the user, expires in 10 minutes.

## Webhook Helper

```text
POST /integrations/{provider}/webhook
```

- Excluded from JWT authorizer; provider signature verification mandatory.
- Constant-time comparisons, replay protection (timestamp/nonce where provider supports).
- Fast acknowledgement; heavy processing asynchronous (EventBridge or async Lambda invoke).

## Event Mapping

Generic rule model used by activity integrations:

```text
IntegrationRule { provider, matchType, matchValue, tennerId, minDurationMinutes? }
```

## Frontend

Settings → Integrations: list providers, connect/disconnect, status, last sync.

---

# Testing Requirements

```text
OAuth State Validation
Expired State Rejected
Token Encryption Round Trip
Revocation
Webhook Signature Verification
Replay Rejected
Rule Matching
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Integration data model
OAuth helper
Webhook helper
Rule model
Integrations settings page
docs/architecture.md (integration architecture)
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

- Shared OAuth, token and webhook handling exists
- Tokens encrypted and never logged
- Webhooks verified
- Settings page lists integrations
- Tests passing

---

# Definition of Done

- Provider integrations can be added with minimal code

---

# Out of Scope

- Any concrete provider (INTEGRATION-002 onward)
