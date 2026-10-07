# SCHEDULING-008: Implement Timezone-Aware Due Dates

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

Make "today", "due" and "overdue" correct for the household's local timezone.

---

# Background

TICKET-013 stores `nextDue` as a UTC calendar date and calculates it from the
UTC completion timestamp.

The household lives in `Europe/Berlin` (UTC+1/UTC+2). A Tenner completed at
`00:30` local time on 2 Oct is `22:30 UTC` on 1 Oct, so its next due date is
calculated one day too early. The dashboard's notion of "today" switches at
`01:00/02:00` local time instead of midnight.

FRONTEND-008 shows timezone as read-only `Europe/Berlin`.

---

# Dependencies

```text
TICKET-013
TICKET-014
TICKET-016
FRONTEND-008
```

---

# Scope

## Household Timezone

Introduce a household-level setting:

```text
timezone   IANA identifier, default "Europe/Berlin"
```

Stored server-side (HOUSEHOLD-ADMIN-003 if available, otherwise a single
configuration item / environment variable). Centralize access via one function:

```typescript
getHouseholdTimezone(tenantId): Promise<string>
```

## Calculation Rules

```text
completion local date = toLocalDate(completedAt, timezone)
nextDue               = calculateNextDue(completion local date, ...)
today                 = toLocalDate(now, timezone)
```

`nextDue` remains a calendar date (`YYYY-MM-DD`), now interpreted as a
household-local date. Document the semantic change in `docs/architecture.md`.

## Date Library

Use the platform `Intl` API or a small, well-maintained library
(e.g. `date-fns-tz`). Justify the choice. Do not hand-roll DST logic.

## Migration

Existing `nextDue` values remain valid; no migration required. Document that
values computed before the change may be off by one day in edge cases.

## Frontend

Make the timezone editable in Settings (household-level, affects all users).

---

# Testing Requirements

```text
Completion Just After Local Midnight
Completion Just Before Local Midnight
DST Start (last Sunday in March)
DST End (last Sunday in October)
Dashboard Today Boundary
Non-Default Timezone
Invalid Timezone Rejected
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Household timezone setting
Central date utilities
Updated Complete, Undo, Dashboard logic
Editable timezone in settings
Tests
docs/architecture.md (date semantics)
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

- Due dates computed in household local time
- Dashboard "today" follows local midnight
- DST transitions handled
- Timezone configurable
- Date semantics documented
- Tests passing

---

# Definition of Done

- No off-by-one-day errors around midnight
- Feature deploys through GitHub Actions

---

# Out of Scope

- Per-user timezones (notifications use user timezone, NOTIFICATION-002)
- Time-of-day due times

---

# Implementation Status

Implemented 2026-10-05.

- [x] Due dates computed in household local time: create (`nextDue` = local today), complete
  (`local date(completedAt) + frequencyDays`), undo (restored dates local), `GET /tenners?due|overdue`
- [x] Dashboard "today" follows local midnight of the household timezone
- [x] DST transitions handled: dates come from `Intl` (IANA rules), day arithmetic is calendar-only
- [x] Timezone configurable: `GET`/`PUT /household`, Settings → "Zeitzone des Haushalts" (Autocomplete of
  `Intl.supportedValuesOf("timeZone")`); unknown or malformed names → 400
- [x] Date semantics documented (`docs/architecture.md` → "Date semantics"); TD-005 resolved
- [x] Tests passing: backend 462 (incl. just after/before local midnight, DST start/end, dashboard today boundary,
  non-default timezone, invalid timezone rejected), frontend 229, Terraform 51; lint and build clean
- [ ] Deploys through GitHub Actions: requires the deploy role to manage the new table `tenner-households`
  (README → "CI Permissions"), verified after merge

Decisions and assumptions:

- Storage: new DynamoDB table `tenner-households` (PK `tenantId`), because HOUSEHOLD-ADMIN-003 does not exist
  and an environment variable could not be edited from Settings. Same protections as the other tables
  (SSE, PITR, deletion protection, `prevent_destroy`). Cost: on-demand, negligible.
- Central access: `TimeZoneSource = (tenantId) => Promise<string>` (`HouseholdService.timezoneOf`); without a stored
  value `APPLICATION_TIMEZONE` (default `Europe/Berlin`) applies. One extra GetItem per scheduling request.
- Date library: none. The platform `Intl` API carries the IANA database in Node.js 22 and browsers; the only
  operation needed is "calendar date of an instant in a zone", so a dependency adds no value.
- Any household member may change the timezone (no admin role exists yet); changes are logged as
  `HouseholdTimezoneChanged`. Stored `nextDue` values are not recomputed.
- Migration: none; pre-change values may be one day early (see architecture).

Technical debt: TD-026 (history date filters still use UTC days).
