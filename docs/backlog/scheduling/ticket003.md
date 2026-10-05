# SCHEDULING-003: Implement Snooze / Postpone Tenner

## Type

Backend + Frontend Feature

---

## Priority

High

---

## Phase

V2

---

## Goal

Allow users to consciously postpone a Tenner without completing it.

Example:

```text
"Wash car" is due today but it's raining → snooze 3 days.
```

---

# Background

"Manual Next-Due Override" was excluded from TICKET-013 and TICKET-014.

Without snoozing, users either ignore overdue items (creating noise) or record
false completions (corrupting history). Both undermine consistency tracking.

---

# Dependencies

```text
TICKET-013
FRONTEND-007
```

---

# Scope

## Endpoint

```text
POST /tenners/{tennerId}/snooze
```

Request:

```json
{ "until": "2026-10-04" }
```

or

```json
{ "days": 3 }
```

## Rules

```text
until must be after today
maximum snooze: one frequency interval (or 30 days, whichever is greater)
inactive Tenners cannot be snoozed (409)
snoozing sets nextDue = until and snoozedUntil = until
completing a snoozed Tenner clears snoozedUntil
```

Snoozes are recorded as audit events (not completions) so that analytics can
distinguish postponements. Store them in `tenner-history` with
`eventType = SNOOZE`, or in a separate attribute — document the choice.
Existing history readers must ignore non-completion events.

Use optimistic locking consistent with TICKET-013.

## Frontend

Add "Snooze" action on dashboard items and the detail page:

```text
Tomorrow | 3 days | Next weekend | Pick date
```

Show "Snoozed until <date>" badge.

---

# Testing Requirements

```text
Snooze By Days
Snooze Until Date
Past Date Rejected
Maximum Snooze Enforced
Inactive Tenner Rejected
Completion Clears Snooze
Concurrent Modification
History Readers Ignore Snooze Events
UI Snooze Menu
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Snooze endpoint
Domain and repository changes
Frontend snooze action
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

- Tenners can be snoozed
- Limits enforced
- Snoozes are auditable but do not count as completions
- UI supports quick snooze options
- Tests passing

---

# Definition of Done

- Users can postpone without faking completions
- Feature deploys through GitHub Actions

---

# Out of Scope

- Skip occurrence (SCHEDULING-004)
- Bulk snooze (PRODUCTIVITY-005)

---

# Implementation Status

Implemented 2026-10-05.

- [x] Tenners can be snoozed: `POST /tenners/{tennerId}/snooze` with `until` or `days`; `nextDue` and
  `snoozedUntil` set atomically with optimistic locking (`updatedAt`, active, not deleted)
- [x] Limits enforced: after today (household timezone) and after the current `nextDue`; at most one frequency
  interval or 30 days, whichever is later; inactive/archived → 409 `TENNER_INACTIVE`
- [x] Snoozes are auditable but do not count as completions: `tenner-history` items with `eventType = SNOOZE` and
  no `completedAt`, so the completion GSIs (history, undo, analytics) never contain them (storage decision in
  `docs/architecture.md`); completion clears `snoozedUntil`
- [x] UI quick options: "Verschieben" on due/overdue dashboard items (icon) and the detail header (button) with
  Morgen, In 3 Tagen, Nächstes Wochenende, Datum wählen; "Verschoben bis …" badge
- [x] Tests passing: backend 506 (by days, until date, past/today rejected, maximum, inactive/archived, completion
  clears snooze, concurrent modification, transaction shape without completion index keys), frontend 255 (menu,
  date picker, error, badge, detail header), Terraform 51 (new route); lint, build, `terraform fmt`/`validate` clean
- [ ] Deploys through GitHub Actions: new API route only (no new IAM permissions); verified after merge

Decisions and assumptions:

- A snooze must move the date **later** than the current `nextDue` (never pulls a Tenner forward); the UI offers
  it only for due and overdue Tenners.
- The maximum is measured from today, using `calculateNextDue` for one interval (calendar-correct for months/years).
- No idempotency key: a retried snooze sets the same date again and adds a second audit event; harmless.
- Undoing a completion does not restore a snooze that the completion cleared (TD-028).

Technical debt: TD-028 (snooze events not readable through the API; undo does not restore a cleared snooze).
