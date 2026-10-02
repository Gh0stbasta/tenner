# FRONTEND-010: Implement Household Activity History Page

## Type

Frontend Feature

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Provide a household-wide, filterable timeline of all completions.

Users must be able to review what was done in a given period and by whom.

---

# Background

The dashboard shows only the last 10 completions (FRONTEND-007).

`GET /history` (TICKET-020) supports date range, user filter and pagination.

---

# Dependencies

```text
TICKET-020
FRONTEND-007
```

---

# Scope

Implement route and navigation entry:

```text
/history
```

---

# Features

## Timeline

Group completions by day:

```text
Today
Yesterday
Mon, 28 Sep 2026
```

Each entry shows:

```text
Tenner title (link to /tenners/:tennerId)
Completed by
Time
Actual minutes
```

Daily footer:

```text
Total minutes that day
```

---

## Filters

```text
Date range (Last 7 days | Last 30 days | Custom)
User (All | Stefan | Julia)
```

Filters are reflected in the URL query string so views are shareable and bookmarkable.

---

## Pagination

Infinite scrolling or "Load more" using the API cursor.

---

## Undo

Undo is available only for the most recent completion of a Tenner, consistent with
TICKET-014 rules. Reuse the existing undo mutation.

---

# Components

```text
features/history/

├── HistoryPage
├── HistoryFilters
├── HistoryDayGroup
└── HistoryEntry
```

---

# Testing Requirements

```text
Grouping By Day
Filter By User
Filter By Date Range
URL State Synchronization
Pagination
Empty State
Error State
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
/history page
Navigation entry
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

- History page reachable from navigation
- Completions grouped by day
- User and date filters work
- Filters persisted in URL
- Pagination works
- Responsive and accessible
- Tests passing

---

# Definition of Done

- Household activity can be reviewed over time
- Feature deploys through GitHub Actions

---

# Out of Scope

Do not implement:

- Charts and aggregated metrics (ANALYTICS domain)
- Export (DATA-001)
- Editing history
