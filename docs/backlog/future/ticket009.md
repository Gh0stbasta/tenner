# FUTURE-009: Evaluate WhatsApp Notifications

> **Note (2026-10-06, BACKLOG-001):** NOTIFICATION-006 (Telegram), the comparison baseline, was removed; the evaluation compares against the existing channels (in-app log, Alexa).

## Type

Product Feature (Postponed)

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Evaluate WhatsApp as a notification channel, listed in the architecture's
future notification ideas.

---

# Background

WhatsApp Business Platform (Cloud API) requires a Meta business account, approved
message templates for proactive messages and has per-conversation pricing.
Telegram (NOTIFICATION-006) offers similar UX for free.

---

# Dependencies

```text
NOTIFICATION-001
NOTIFICATION-006
```

---

# Scope

```text
Account and verification requirements
Template approval process for digest/alert messages
Pricing for expected volume (~60 messages/user/month)
Privacy (Meta as processor)
Decision; if go: implement WhatsAppChannel against the channel interface
```

---

# Deliverables

```text
Evaluation and decision
Channel implementation (conditional)
```

---

# Acceptance Criteria

- Requirements and cost documented
- Decision made

---

# Definition of Done

- WhatsApp channel decision made

---

# Out of Scope

- Interactive WhatsApp bot
