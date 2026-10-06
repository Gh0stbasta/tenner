# INTEGRATION-002: Implement Interactive Telegram Bot

> **Note (2026-10-06, BACKLOG-001):** its dependency NOTIFICATION-006 (Telegram channel) was removed. The bot needs that account linking and outbound path; keep, rescope or drop this ticket by owner decision before starting it.

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

Let users see and complete their Tenners directly in Telegram.

```text
/today       → list today's and overdue Tenners with [✓ Done] buttons
/add <text>  → quick add with household defaults
Button tap   → completes the Tenner, message updated
```

---

# Background

NOTIFICATION-006 links Telegram accounts and sends outbound notifications.
This ticket adds inbound interaction via the same bot and webhook.

---

# Dependencies

```text
NOTIFICATION-006
INTEGRATION-001
TICKET-013
FRONTEND-006 (Quick Add rules)
```

---

# Scope

## Commands

```text
/today
/upcoming
/add <title>
/help
```

## Inline Buttons

- Daily digest messages include `[✓ <title>]` buttons.
- Callback data contains an opaque short token, not raw IDs (64-byte limit, no tenant data).
- Completion executes the standard completion service with `completedBy` = linked user and an
  idempotency key derived from the callback query ID.

## Security

- Only linked chats are served; unknown chats receive a generic message.
- Webhook secret verified (NOTIFICATION-006).
- Rate limiting per chat.

---

# Testing Requirements

```text
Each Command
Unknown Chat
Button Completion
Idempotent Double Tap
Callback Token Validation
Message Update After Completion
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Command handlers
Callback handling
Digest buttons
Tests
Documentation
```

---

# Validation

```bash
npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- Commands work for linked users
- Tenners can be completed via buttons
- Double taps do not create duplicates
- Tests passing

---

# Definition of Done

- Daily Tenner work can be done entirely from Telegram

---

# Out of Scope

- Natural language messages (AI-002)
- Group chats
