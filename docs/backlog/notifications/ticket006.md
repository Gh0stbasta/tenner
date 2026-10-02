# NOTIFICATION-006: Implement Telegram Notification Channel

## Type

Backend Feature

---

## Priority

High

---

## Phase

V2

---

## Goal

Deliver notifications via a Telegram bot.

Telegram is listed first among the notification ideas in the architecture
and requires no additional AWS service.

---

# Background

The Telegram Bot API is free and accessed via outbound HTTPS from Lambda.

The bot token is a secret and requires secure storage (SECURITY-006).

Interactive features (completing Tenners from Telegram) are handled separately
in INTEGRATION-002.

---

# Dependencies

```text
NOTIFICATION-001
NOTIFICATION-002
SECURITY-006
```

---

# Scope

## Bot Setup

Manual, documented steps (outside AWS):

```text
Create bot via @BotFather
Store token in the secret store defined by SECURITY-006
```

No token may ever appear in the repository, Terraform state outputs, or logs.

## Account Linking

1. User clicks "Connect Telegram" in settings.
2. Backend creates a single-use link code (expires 15 minutes, stored hashed).
3. UI shows deep link: `https://t.me/<bot>?start=<code>`.
4. Bot receives `/start <code>` via webhook, resolves user, stores `chatId`.
5. Settings show "Telegram connected".

Webhook endpoint:

```text
POST /integrations/telegram/webhook
```

Protected by Telegram's `secret_token` header (verified with constant-time comparison).

## Channel

Implement `TelegramChannel`:

- `sendMessage` with Markdown escaping
- Handle `403 bot was blocked` → mark channel unlinked
- Respect Telegram rate limits (max 1 msg/s per chat)

## Unlinking

```text
DELETE /users/{userId}/channels/telegram
```

and `/stop` command in the bot.

---

# Testing Requirements

```text
Link Code Generation
Expired Link Code
Webhook Secret Verification
Invalid Secret Rejected
Message Formatting And Escaping
Blocked Bot Handling
Unlinking
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
TelegramChannel
Webhook route
Linking flow (backend + settings UI)
Setup documentation (README)
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

- Users can link and unlink Telegram
- Notifications delivered via Telegram
- Webhook protected by secret token
- Bot token stored securely, never logged
- Blocked bots handled
- Tests passing

---

# Definition of Done

- Telegram notifications work end to end
- Feature deploys through GitHub Actions

---

# Out of Scope

- Interactive commands and buttons (INTEGRATION-002)
- Group chats
- WhatsApp (FUTURE-009)
