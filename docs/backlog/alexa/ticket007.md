# ALEXA-007: Implement Echo Show Home Screen Widget (Flagship)

## Type

Visual Feature / Platform

---

## Priority

High

---

## Phase

V2

---

## Goal

Make Tenner's household status visible on the Echo Show **home screen without a voice command** — the flagship
Echo Show feature:

```text
🏠 TENNER
Heute: 3 Tenner
15 Minuten offen
1 überfällig
```

The ticket first establishes which persistence mechanisms Echo Show offers to third-party skills today, then
implements the strongest one (APL widgets) and documents fallbacks.

---

# Background

Mechanisms for persistent or ambient visibility, as researched on 2026-10-05 (verify at implementation start):

| Mechanism | Persistent without voice? | Third-party access | Fit |
|---|---|---|---|
| **APL widgets** (Widget Panel / home screen) | **Yes**, self-updating glanceable views | Yes: an APL package in the skill; data pushed with the **Data Store REST API** (targets: devices or all devices of a user), also outside a session | **Primary** |
| Skill session with APL (ALEXA-006) | Only while the session is open | Yes | Interactive view, not persistent |
| Notifications (Proactive Events, ALEXA-008) | Indicator + notification list until read | Yes, predefined schemas only | Alerts, not status |
| Home screen rotation / "home cards" content | Yes | No public API for third parties (verify) | Not available |
| Routines that open the skill (ALEXA-005) | At scheduled times | Users configure them | Supplement |

Widget device support (per Amazon, 2025): Echo Show 5, 8, 10, 11, 15 and 21. Availability of third-party widgets
for German-language devices could not be confirmed during research — **step 1 is a short spike** that verifies
widget support for de-DE skills in development stage on the household's devices.

---

# Dependencies

```text
ALEXA-001, ALEXA-002, ALEXA-006 (shared visual language)
SECURITY-006 (Parameter Store for the LWA client secret)
NOTIFICATION-001 (scheduled notifier Lambda, reused for pushes)
```

---

# Scope

## Step 1 — Spike (time-boxed: 1 day, go/no-go)

- Build a minimal APL widget package for the dev-stage skill, install it on a household Echo Show (de-DE), push a
  value with the Data Store API, and confirm it updates.
- Record results in this ticket: supported devices in the household, widget sizes offered, update latency,
  whether the widget survives reboots, behavior with Alexa+.
- **No-go** (widgets unavailable for de-DE): implement the fallback plan below and keep the widget work as a
  follow-up ticket.

## Step 2 — Widget (go)

### Package

- APL package in `alexa/widgets/tenner-status/` (manifest, APL document, initial data source) declared in the
  skill manifest; sizes per the widget reference (small/medium where supported).
- Content (small): „🏠 Tenner“, „Heute: 3“, „15 Min. offen“, „1 überfällig“ (icon + text). Medium adds the next
  2 Tenners and per-member counts.
- Tap: opens the skill on the dashboard (ALEXA-006) via the widget's launch action; a "Erledigt" button on the
  next Tenner is optional (only if widget events support it — verify).
- Uses the APL Data Store extension to bind to the pushed data (no request to the skill when rendering).

### Data Push

- Payload (per household): `{ date, dueToday, openMinutes, overdue, next: [{ title, minutes, member }],
  members: [{ name, count }], updatedAt }` — small, no IDs needed for display.
- Pushed with the Data Store REST API (target `USER`, i.e. all devices of the linked Amazon user):
  - after every write that changes the dashboard (complete, undo, create, update, delete, pause, snooze, skip,
    vacation) — from the API Lambda via an asynchronous event (EventBridge put → notifier Lambda), never blocking
    the API response;
  - at the start of each household day (date change in the household timezone) by the scheduled notifier job;
  - debounced: at most one push per household per minute.
- Auth: LWA client-credentials token for the skill (scope for the Data Store API, verify the scope name); client ID
  and secret in **SSM Parameter Store** (SECURITY-006); token cached until expiry.
- The mapping household → Alexa user ID is stored when the skill is used after linking (`context.System.user.userId`
  on the household item, `alexaUsers` list); unlinking (skill disabled event) removes it.

## Fallback Plan (no-go or devices without widgets)

- Morning routine opening the dashboard (ALEXA-005) on the Echo Show at fixed times.
- Proactive notification for overdue Tenners (ALEXA-008) to keep the indicator visible.
- Document clearly in the README which household device shows what.

---

# Architecture Considerations

- **Event-driven freshness:** writes publish a small "household changed" event; the notifier recomputes the
  summary (one `getDashboard` call internally) and pushes it. This keeps the API fast and the widget current
  within ~1 minute.
- **Security:** the Data Store API only accepts data for users who installed the widget/enabled the skill; the
  payload contains titles (household data) — acceptable for the household's own devices; no member e-mails or IDs.
- **Cost:** a few hundred pushes per day; Lambda/EventBridge within free tier.
- **Failure handling:** push failures are logged and retried once; the next change or day start repairs the state.

---

# Deliverables

```text
Spike results (this ticket)
Widget APL package + skill manifest changes
Summary builder (shared with ALEXA-006) and Data Store push client with tests
Event publication on household changes (API) and push handler (notifier)
Terraform: EventBridge rule/bus permissions, SSM parameters (names only), IAM for the notifier
README: install the widget on an Echo Show, troubleshooting
```

---

# Testing Requirements

```text
Summary Payload Mapping
Debounce (one push per minute)
Day Start Push In Household Timezone
LWA Token Caching And Refresh
Push Failure Logged And Retried Once
Unlinked User Removed From Push Targets
Widget Document Renders With Sample Data (authoring tool)
```

---

# Validation

```bash
terraform fmt -check && terraform test
npm run lint && npm run build && npm test   # alexa/, backend/
```

Manual: complete a Tenner in the web app → the Echo Show widget updates within a minute; next morning the counts
reset to the new day.

---

# Acceptance Criteria

- Spike documented with a go/no-go decision
- (Go) Tenner's status widget appears on the Echo Show home screen and updates without voice commands
- (No-go) Fallback plan implemented and documented
- Tests passing

---

# Definition of Done

- The household sees Tenner's status on the Echo Show home screen without asking Alexa
- Feature deploys through GitHub Actions

---

# Out of Scope

- Editing Tenners from the widget beyond an optional "Erledigt"
- Widgets on non-Echo devices (Fire TV, phones)
