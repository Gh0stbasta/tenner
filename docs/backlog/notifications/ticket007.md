# NOTIFICATION-007: Implement Web Push Notification Channel

## Type

Backend Feature

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Deliver notifications as native browser/OS push notifications for users
who installed Tenner as a PWA.

---

# Background

The mobile domain provides PWA installation (MOBILE-001), service worker
(MOBILE-002) and the client-side push subscription flow (MOBILE-006).

This ticket implements the server side: storing subscriptions and sending pushes
using the Web Push protocol with VAPID keys. No AWS push service (SNS) is required.

---

# Dependencies

```text
NOTIFICATION-001
NOTIFICATION-002
MOBILE-006
SECURITY-006
```

---

# Scope

## Endpoints

```text
GET    /push/vapid-public-key
POST   /users/{userId}/push-subscriptions
DELETE /users/{userId}/push-subscriptions/{subscriptionId}
```

## Storage

Store subscriptions (endpoint, keys, userAgent label, createdAt) per user.
Maximum 10 subscriptions per user.

## Sending

Implement `WebPushChannel` using the `web-push` npm package
(document the dependency justification) or a minimal VAPID implementation.

Payload:

```json
{ "title": "3 Tenners today", "body": "~30 min", "url": "/dashboard" }
```

Payload must be small (< 2 KB) and contain no sensitive data.

## Cleanup

Responses `404` / `410` from the push service remove the subscription.

## Keys

VAPID private key stored per SECURITY-006. Public key exposed via endpoint.

---

# Testing Requirements

```text
Subscription Create
Subscription Limit
Subscription Delete
Payload Size
Expired Subscription Cleanup
Channel Failure Isolation
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Push subscription endpoints
WebPushChannel
VAPID key handling
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

- Subscriptions can be stored and removed
- Push notifications delivered to subscribed devices
- Expired subscriptions removed automatically
- VAPID private key stored securely
- Tests passing

---

# Definition of Done

- PWA users receive push notifications
- Feature deploys through GitHub Actions

---

# Out of Scope

- Native app push (APNs/FCM directly) — FUTURE-007
- Notification actions (complete from notification) — future enhancement
