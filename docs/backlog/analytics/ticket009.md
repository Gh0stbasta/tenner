# ANALYTICS-009: Implement Analytics Page

## Type

Frontend Feature

---

## Priority

High

---

## Phase

V2

---

## Goal

Replace the `/analytics` placeholder created in FRONTEND-001 with a functional
analytics page visualizing the analytics endpoints.

---

# Background

FRONTEND-001 created the `/analytics` route and navigation entry as "Coming Soon".

ANALYTICS-001 to ANALYTICS-008 provide the data.

---

# Dependencies

```text
FRONTEND-001
ANALYTICS-001 to ANALYTICS-008
```

Sections may be delivered incrementally; a section whose endpoint is not yet available
must be hidden, not rendered broken.

---

# Scope

## Page Layout

```text
Period Selector (Week | Month | Quarter | Year | Custom)

Summary Cards
  Completions | Minutes | On-Time Rate | Overdue Now

Completion Trend (bar/line chart)

Category Overview (bar chart + health indicator)

Household Balance (stacked bar)

Neglected Tenners (table, top 10)

Habits (table: streak, consistency, trend)

Time Investment (projected weekly load, Tenners exceeding estimate)
```

---

## Charting Library

Prefer `@mui/x-charts` because Material UI is already used.

If a different library is chosen, document the reason in the ticket and
`docs/architecture.md`.

Charts must respect light/dark theme (FRONTEND-008).

---

## Interaction

- Selected period stored in URL query string.
- Clicking a Tenner navigates to `/tenners/:tennerId` (FRONTEND-009).
- Each section loads independently with its own loading and error state.

---

## Accessibility

- Every chart has a textual alternative (summary text or data table toggle).
- Colors must not be the only carrier of information.
- Keyboard accessible controls.

---

## Settings Integration

Respect the "Show Analytics" related settings if introduced later. No new settings in this ticket.

---

# Components

```text
features/analytics/

├── AnalyticsPage
├── PeriodSelector
├── SummaryCards
├── TrendChart
├── CategoryChart
├── BalanceChart
├── NeglectedTable
├── HabitsTable
└── TimeInvestmentCard
```

---

# Testing Requirements

```text
Period Selection
URL Synchronization
Section Loading States
Section Error States
Hidden Unavailable Sections
Chart Data Mapping
Accessible Data Table Alternative
Responsive Layout
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Analytics page
Chart components
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

Bundle size impact must be reported in the pull request.

---

# Acceptance Criteria

- Placeholder replaced with functional page
- All available analytics sections rendered
- Period selection works and is persisted in URL
- Charts are accessible and theme-aware
- Sections fail independently
- Tests passing

---

# Definition of Done

- Users can explore their consistency and workload visually
- Feature deploys through GitHub Actions

---

# Out of Scope

- AI-generated insights (AI-007)
- Export of charts
- Custom dashboards
