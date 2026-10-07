# NOTIFICATION-009: Implement Browser Push Channel

## Type

Full-Stack Feature

---

## Priority

High

---

## Phase

V2

---

## Goal

Members receive Tenner notifications as push messages on their phones (PWA) and browsers. This is the base for the
per-Tenner reminders (NOTIFICATION-010) and the notification actions (NOTIFICATION-011).

---

# Background

Owner ticket `docs/human/mobileReminder.md` (2026-10-07, its ID „FRONTEND-010“ was taken). Push was dropped on
2026-10-06 (BACKLOG-001: MOBILE-006, NOTIFICATION-007) and re-requested by the owner on 2026-10-07: „Push wieder
aufnehmen“.

---

# Dependencies

```text
NOTIFICATION-001 (notifier, channels), NOTIFICATION-002 (preferences)
MOBILE-002 (service worker)
SECURITY-006 (Parameter Store)
```

---

# Scope

- Web Push without a library (`backend/src/push/web-push.ts`): RFC 8291 payload encryption (aes128gcm) and RFC 8292
  VAPID (ES256), node:crypto only.
- Subscriptions per member on the household item (max 5 devices; oldest replaced): `PUT/DELETE
  /users/{userId}/push-subscription`, only for the member themselves. Gone subscriptions (404/410) are removed by the
  notifier.
- Channel `WEB_PUSH` (connected once the member has a device), `WebPushChannel` in the notifier.
- VAPID: public key as GitHub variable `WEB_PUSH_PUBLIC_KEY` (Terraform variable, notifier env, frontend build),
  private key only in Parameter Store (`/tenner/prod/push/vapid-private-key`). `scripts/generate-vapid-keys.mjs`.
- Frontend: „Push aufs Handy (dieses Gerät)“ in Einstellungen → Benachrichtigungen (enable/disable, iPhone install
  hint, blocked permission), channel „Push aufs Handy“, service worker extension `public/push-sw.js` (show, open on
  tap).

---

# Acceptance Criteria

- [x] Encryption reproduces the RFC 8291 test vector; VAPID JWT verifies with the public key
- [x] A member registers and removes devices; other members cannot touch them (403)
- [x] The notifier sends to all devices of a member and deletes gone subscriptions
- [x] Push is offered only with a configured key; iPhone without installation and blocked permission are explained
- [x] Endpoints and keys are never logged (only the push service host)
- [x] Tests passing: backend 896, frontend 400, Terraform 76; lint, typecheck, build clean
- [ ] Push received on a real phone — owner, after the setup steps (README → Browser push)

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated (README setup and secrets, security.md, API routes in Terraform)
- [x] Technical debt documented (none new)
- [x] Acceptance criteria verified
- [x] Git commit created

---

# Assumptions

- Own implementation instead of the `web-push` package (last release January 2024, five dependencies). Both RFCs are
  short and the test vector proves the encryption.
- Subscriptions live on the household item like the Alexa accounts: a few devices per member and no new table.
- The VAPID subject is the web app URL (RFC 8292 allows https), so no e-mail address is needed.
- Until NOTIFICATION-010 a push carries the digest/alert text as one notification.

---

# Out of Scope

- One notification per Tenner and the reminder times (NOTIFICATION-010), action buttons (NOTIFICATION-011).
- Native apps (the PWA covers Android; iOS via an installed PWA).

---

# Implementation Status

Done (2026-10-07). Owner setup: README → Notifications → Browser push.
