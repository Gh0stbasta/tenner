# SCHEDULING-005: Implement Pause & Vacation Mode

## Type

Backend + Frontend Feature

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Allow pausing individual Tenners or the whole household (vacation) so that
Tenners do not pile up as overdue while nobody is home.

---

# Background

During a two-week vacation, every household Tenner would become overdue and
trigger alerts. After returning, the dashboard would be overwhelming.

Pausing is different from soft-deleting: the Tenner remains active in configuration.

---

# Dependencies

```text
TICKET-016
NOTIFICATION-001 (pause must suppress notifications)
```

---

# Scope

## Tenner Pause

```text
POST /tenners/{tennerId}/pause    { "until": "2026-10-20" }   (until optional)
POST /tenners/{tennerId}/resume
```

## Household Vacation Mode

```text
PUT /household/vacation   { "from": "2026-10-10", "until": "2026-10-24", "categories": ["HOUSEHOLD","HOME"] }
DELETE /household/vacation
```

`categories` optional; default all categories (fitness Tenners may continue while travelling).

## Resume Behavior

When a pause ends:

```text
if nextDue fell within the pause → nextDue = resumeDate + offset
```

Offsets are spread over the following days so that not all Tenners become due on the
same day: distribute resumed Tenners so that daily estimated minutes do not exceed
the household's average daily load + 50%.

## Effects

- Paused Tenners are excluded from Due/Overdue/Upcoming and shown in a "Paused" section.
- Notifications are suppressed for paused Tenners.
- Analytics exclude paused periods from expected completions.

---

# Testing Requirements

```text
Pause And Resume Tenner
Automatic Resume On Date
Vacation Mode By Category
Resume Distribution Load Cap
Dashboard Exclusion
Notification Suppression
Analytics Exclusion
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Pause/resume endpoints
Vacation mode endpoints
Resume distribution logic
Dashboard changes
Frontend controls (Tenner menu + settings)
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

- Individual Tenners can be paused and resumed
- Household vacation mode works per category
- Resumed Tenners are spread out
- Paused Tenners produce no overdue noise or notifications
- Tests passing

---

# Definition of Done

- Absences don't produce a wall of overdue Tenners
- Feature deploys through GitHub Actions

---

# Out of Scope

- Calendar-based automatic vacation detection (INTEGRATION-006)

---

# Implementation Status

Implemented 2026-10-05.

- [x] Individual Tenners can be paused and resumed: `POST /tenners/{tennerId}/pause` (`until` optional, last paused
  day) and `/resume`; "Pausieren"/"Fortsetzen" on Tenner cards and the detail header with a pause dialog
- [x] Automatic resume on date: pauses are evaluated at read time (`pausedUntil` ≥ today), so no scheduler is
  needed (decision in `docs/architecture.md`)
- [x] Household vacation mode works per category: `PUT`/`DELETE /household/vacation`, Settings → App → "Urlaub"
  (dates, categories, end vacation)
- [x] Resumed Tenners are spread out: vacation moves affected Tenners behind it with `distributeResume`
  (daily load ≤ average daily load + 50 %, at least one Tenner per day)
- [x] Paused Tenners produce no overdue noise: dashboard excludes them from all sections and summaries and shows a
  "Pausiert" section; completion and skip move new due dates out of the vacation
- [x] Notifications and analytics: neither exists yet; NOTIFICATION-001 and ANALYTICS-006/008 now require excluding
  paused Tenners and periods (rules shared in `backend/src/utils/pause.ts`)
- [x] Tests passing: backend 575 (rules, pause/resume, automatic resume, vacation by category, load cap, conflicts,
  dashboard exclusion, completion/skip during vacation, repository, handlers, routes), frontend 271 (status, dialog,
  resume, paused section, vacation settings), Terraform 51 (4 new routes); lint, build, `terraform fmt`/`validate`
- [ ] Deploys through GitHub Actions: new API routes only (no new IAM permissions; the Lambda already has `Query`
  and `UpdateItem` on both tables); verified after merge

Decisions and assumptions:

- Due dates move when a pause or vacation is set (and on manual resume), not when it ends; this avoids a background
  job and new infrastructure.
- A vacation also moves Tenners that are already overdue once it has started; Tenners due before a future vacation
  stay (they can be done before leaving).
- Completing a paused Tenner ends its pause. Resume is only possible for individual pauses; a vacation is ended in
  the settings.
- Any household member may set or end the vacation (no roles yet).
- The dashboard now needs two Queries (window + active Tenners for the paused section).

Technical debt: TD-029.
