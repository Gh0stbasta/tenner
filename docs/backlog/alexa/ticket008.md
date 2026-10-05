# ALEXA-008: Implement Alexa Notifications and Reminders

## Type

Notification Channel

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Bring Tenner's reminders to Alexa: a notification indicator on Echo devices for overdue Tenners and household
changes, and spoken Alexa reminders at a chosen time for due Tenners and the daily briefing.

---

# Background

NOTIFICATION-001 creates a channel-independent notifier (scheduled Lambda, recipients, deduplication, delivery
log) with pluggable channels; NOTIFICATION-002 adds reminder preferences, NOTIFICATION-003 the daily digest,
NOTIFICATION-004 overdue alerts. Alexa becomes one more channel.

Alexa mechanisms (researched 2026-10-05; verify before implementing):

- **Proactive Events API:** sends events that Alexa delivers as **notifications** (yellow ring / indicator; Echo
  Show shows them in the notification list). Only **predefined schemas** are allowed, e.g.
  `AMAZON.MessageAlert.Activated`, `AMAZON.TrashCollectionAlert.Activated`, `AMAZON.Occasion.Updated`; free text is
  not possible. Users must grant the notification permission. Development-stage skills use the development
  endpoint.
- **Reminders API:** a skill can create Alexa reminders (spoken at the set time on the user's devices) with the
  permission `alexa::alerts:reminders:skill:readwrite`; outside a session it needs an out-of-session token
  (skill messaging, LWA client credentials). The API is active (only the old recurrence fields are deprecated).
- There is no third-party "announcement" API that speaks arbitrary text on all speakers without a reminder.

---

# Dependencies

```text
ALEXA-002 (linked users), ALEXA-005 (briefing content)
NOTIFICATION-001, NOTIFICATION-002, NOTIFICATION-003, NOTIFICATION-004
SECURITY-006 (LWA client secret in Parameter Store)
```

---

# Scope

## Channel Adapter

- `AlexaChannel` implementing the notifier's channel interface (NOTIFICATION-001): `send(recipient, message)`
  maps a Tenner notification type to Proactive Events or Reminders; delivery is logged with the notifier's
  deduplication key.
- Recipient: the household's linked Alexa user IDs (`alexaUsers`, ALEXA-007); per-member preferences from
  NOTIFICATION-002 decide which types go to Alexa.

## Notification Types

| Tenner event | Alexa mechanism | Content |
|---|---|---|
| Overdue alert (NOTIFICATION-004) | Proactive Event `AMAZON.MessageAlert.Activated` (verify fit) | "Tenner: 2 überfällige Aufgaben" (sender "Tenner", count) |
| Daily briefing (NOTIFICATION-003) | Reminder at the member's chosen time (e.g. 07:30) | „Tenner: Heute 4 Tenner, 40 Minuten. Sag ‚Alexa, starte meinen Tag mit Tenner‘ für Details.“ |
| Due-today reminder for a specific Tenner (opt-in) | One-time reminder at the chosen time | „Zeit für: Pflanzen gießen (10 Minuten).“ |
| Household status change (e.g. handover started, member covers) | Proactive Event (message alert) | count-only text allowed by the schema |

- Reminders are created idempotently (store the reminder ID per type/day; update instead of duplicate; delete
  when the Tenner is completed before the time).
- Quiet hours from NOTIFICATION-002 apply.

## Permissions UX

- When a member enables Alexa notifications in Tenner's settings and the permission is missing, the skill sends an
  `AskFor` permission request (voice consent) on the next launch or a permissions card in the Alexa app.
- Tenner's settings show the per-type Alexa toggles next to the other channels.

## Credentials

- LWA client ID/secret (skill messaging, Proactive Events, Data Store) in Parameter Store (SECURITY-006); tokens
  cached in the notifier Lambda until expiry.

---

# Architecture Considerations

- **Schema limits:** notifications cannot carry Tenner titles freely; keep them as counts and point to the skill or
  briefing for details. Reminders can carry text.
- **No spam:** deduplication by (household, type, day); max one overdue alert per day per household.
- **Region:** Proactive Events and Reminders endpoints are regional (EU endpoint for de-DE) — configure, don't
  hardcode.
- **Cost:** free APIs; notifier runs in the free tier.

---

# Deliverables

```text
AlexaChannel (Proactive Events + Reminders clients) with tests
Reminder bookkeeping (create/update/delete) and dedup integration
Permission request flow in the skill
Settings: Alexa toggles per notification type
Terraform: SSM parameter names, IAM for the notifier
README/runbook: enabling notifications in the Alexa app
```

---

# Testing Requirements

```text
Overdue Alert Mapped To Allowed Schema
Briefing Reminder Created / Updated / Deleted
Due Reminder Deleted After Completion
Dedup: One Overdue Alert Per Day
Quiet Hours Respected
Missing Permission → Request Flow
LWA Token Cache
API Errors Logged With Delivery Status
```

---

# Validation

```bash
terraform fmt -check && terraform test
npm run lint && npm run build && npm test
```

Manual: an overdue Tenner produces an Alexa notification; the briefing reminder speaks at the set time.

---

# Acceptance Criteria

- Alexa is a selectable channel for reminders, briefing and overdue alerts
- Notifications use only allowed schemas; reminders are idempotent
- Users control Alexa notifications per type
- Tests passing

---

# Definition of Done

- Reminders reach the household through Echo devices without opening an app
- Feature deploys through GitHub Actions

---

# Out of Scope

- Free-text announcements on speakers (no public API)
- Push notifications on phones (MOBILE-006)
