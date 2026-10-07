# FRONTEND-009: Implement Tenner Detail & History View

## Type

Frontend Feature

---

## Priority

High

---

## Phase

MVP

---

## Goal

Provide a detail view for a single Tenner that shows its configuration,
schedule state and completion history.

Users must be able to answer:

```text
When was this last done?
Who did it?
How long did it take?
How regularly is it being done?
```

---

# Background

The Tenner Management Page (FRONTEND-003) lists Tenners and the Edit dialog
(FRONTEND-005) changes them, but there is no place to see a Tenner's history.

The backend provides:

```text
GET /tenners/{tennerId}           (TICKET-019)
GET /tenners/{tennerId}/history   (TICKET-020)
```

---

# Dependencies

```text
FRONTEND-003
FRONTEND-005
FRONTEND-007
TICKET-019
TICKET-020
```

---

# Scope

Implement route:

```text
/tenners/:tennerId
```

Navigation entry points:

```text
Click on Tenner title in Tenner Management Page
Click on Tenner in Dashboard
```

---

# Page Sections

## Header

```text
Title
Category chip
Assigned user
Status (Due Today / Overdue / Upcoming / Inactive)
```

Actions:

```text
Complete
Edit (opens existing Edit dialog)
Delete (existing confirmation flow)
```

---

## Schedule Summary

```text
Frequency (e.g. "Every 14 days")
Last completed (absolute + relative)
Next due (absolute + relative)
Estimated minutes
```

---

## Completion History

List of completions, newest first:

```text
Completed at
Completed by
Actual minutes
```

Load more via cursor-based pagination ("Show more").

Empty state:

```text
Not completed yet.
```

---

## Simple Consistency Indicator

Show, computed client-side from loaded history:

```text
Completions in the last 90 days
Average interval between completions vs. configured frequency
```

This is a lightweight indicator only. Full analytics belong to the ANALYTICS domain.

---

# Data Fetching

Use TanStack Query:

```text
useTenner(tennerId)
useTennerHistory(tennerId)   (infinite query)
```

Completing or undoing a completion must invalidate both queries.

---

# Error Handling

```text
404 → "Tenner not found" page with link back to /tenners
Network error → retry option
```

---

# Responsive Design & Accessibility

```text
Desktop / Tablet / Mobile layouts
Keyboard navigation
Screen reader labels for status and actions
```

---

# Components

```text
features/tenner-detail/

├── TennerDetailPage
├── TennerDetailHeader
├── ScheduleSummary
├── CompletionHistoryList
└── ConsistencyIndicator
```

---

# Testing Requirements

```text
Detail Rendering
Not Found State
History Rendering
History Pagination
Empty History
Complete Action Refreshes History
Undo Refreshes History
Consistency Indicator Calculation
Responsive Layout
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Tenner detail route and page
History list with pagination
Navigation links from list and dashboard
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

- Detail page reachable from list and dashboard
- Tenner configuration and schedule shown
- Completion history shown newest first
- History pagination works
- Actions (complete, edit, delete) available
- Not-found state handled
- Responsive and accessible
- Tests passing

---

# Definition of Done

- Users can inspect a Tenner's history
- Feature deploys through GitHub Actions

---

# Out of Scope

Do not implement:

- Editing history entries
- Charts (ANALYTICS-009)
- Household-wide history page (FRONTEND-010)

---

# Implementation Status

Done 2026-10-02.

- Route `/tenners/:tennerId`; titles on the Tenners page and on the dashboard link to it; "Alle Tenner" leads back.
- Header: title, category, assigned user, status badge; actions Erledigt, Bearbeiten (existing dialog),
  Archivieren (existing confirmation, then back to the list). Archived Tenners show "Wiederherstellen" instead.
- Zeitplan: frequency, last completed (date + "gestern"/"vor N Tagen"), next due (date + relative), estimated minutes.
- Verlauf: `GET /tenners/{id}/history?limit=20`, newest first, "Mehr anzeigen" loads the next page with the cursor
  (`useInfiniteQuery`); empty state "Noch nicht erledigt.".
- Regelmäßigkeit (client-side from the loaded history): completions in the last 90 days and the average interval
  vs. the configured frequency (green when within 10%).
- Errors: 404 → "Tenner nicht gefunden" with a link to `/tenners`; other failures → retry, separately for Tenner and history.
- Completing or undoing invalidates the Tenner and its history (`tenners` and `history` query keys).
- Tests: 15 new (page, consistency, links). Frontend: lint, 158 tests (~98.7% coverage), build; Chromium check (desktop, phone).
- Assumptions:
  - The Tenner is loaded with `includeDeleted=true`, so archived Tenners can be inspected and restored from the detail page.
  - "Delete" is the existing archive (soft delete) flow; permanent deletion does not exist.
  - The consistency indicator only uses the loaded history pages (20 entries at first), as the ticket describes.

