# INTEGRATION-007: Implement Google Calendar Two-Way Integration

## Type

Backend Feature

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Go beyond the ICS feed: use Google Calendar availability to plan Tenners and
optionally detect vacations.

```text
Busy days → avoid scheduling heavy Tenner load (input for AI-005)
"Vacation" events → suggest vacation mode (SCHEDULING-005)
```

---

# Background

The ICS feed (INTEGRATION-006) is one-way. Reading calendar data requires OAuth with
sensitive scopes (Google verification process for production apps).

---

# Dependencies

```text
INTEGRATION-001
INTEGRATION-006
SCHEDULING-005
```

---

# Scope

## Pre-Check

Document Google OAuth app verification requirements for `calendar.freebusy` /
`calendar.events.readonly` and whether "testing" mode (≤ 100 users) suffices for a household.

## Features

- Connect Google account (minimal scope: `calendar.freebusy` preferred).
- Daily sync of busy time per day (aggregated minutes; no event titles stored).
- Optional keyword detection for vacation ("Urlaub", "Vacation") — requires events.readonly; opt-in.
- Suggest vacation mode; never enable it automatically.

## Privacy

Store only aggregated busy minutes per day; never event details.

---

# Deliverables

```text
Verification assessment
Google provider
Busy-day data model
Vacation suggestion
Tests
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

- Busy-day data available for scheduling features
- Vacation suggestions offered (opt-in)
- Only aggregated data stored
- Tests passing

---

# Definition of Done

- Tenner planning considers real calendar availability

---

# Out of Scope

- Writing events into Google Calendar (ICS covers display)
