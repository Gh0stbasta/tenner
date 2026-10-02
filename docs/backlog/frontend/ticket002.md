# FRONTEND-002: Implement Dashboard Page

## Type

Frontend Feature

---

## Priority

Critical

---

## Goal

Implement the primary Tenner user experience.

The Dashboard Page is the application's home screen and should answer one simple question:

> What should I do today?

The page must consume the existing Dashboard API and provide an actionable, mobile-friendly overview of all relevant Tenners.

After this ticket the application should already be usable for day-to-day household management.

---

# Background

The following capabilities already exist:

- Frontend Foundation
- Routing
- API Client
- Application Layout
- Dashboard API

This ticket creates the first real user-facing feature.

---

# Scope

Implement:

```text
/dashboard
```

and make it the default landing page.

---

# User Experience

The dashboard should immediately show:

```text
Today's Tenners

Overdue Tenners

Upcoming Tenners

Summary Metrics
```

without navigating elsewhere.

---

# API Integration

Consume:

```http
GET /dashboard
```

and use the response as the single source of truth.

Do not implement additional API calls.

---

# Dashboard Layout

Create the following sections.

---

## Dashboard Header

Display:

```text
Today's Tenners
```

and summary metrics.

Example:

```text
5 Tenners

55 Minutes

2 Overdue
```

---

# Summary Cards

Display:

```text
Due Today

Overdue

Upcoming

Actionable Minutes
```

Each value should be displayed prominently.

Example:

```text
Due Today
3
```

```text
Overdue
2
```

```text
Upcoming
4
```

```text
25 Minutes
```

---

# Due Today Section

Render all Tenners from:

```text
dueToday
```

This section should be the most prominent area.

Every Tenner card should display:

```text
Title

Category

Assigned User

Estimated Minutes
```

---

## Example

```text
□ Vacuum Office

10 min

HOUSEHOLD

STEFAN
```

---

# Complete Action

Each Due Today card must contain:

```text
Complete
```

button.

Action:

```text
POST /tenners/{id}/complete
```

Use:

```text
estimatedMinutes
```

as default completion effort.

On success:

```text
Refresh Dashboard
```

using TanStack Query invalidation.

---

# Overdue Section

Render Tenners from:

```text
overdue
```

Additional information:

```text
Overdue Days
```

Example:

```text
Clean Front Door

Overdue by 12 days
```

---

# Visual Treatment

Overdue items should be visually highlighted.

Acceptable approaches:

```text
Warning Color

Error Accent

Priority Badge
```

Implementation details left to engineer.

---

# Upcoming Section

Render Tenners from:

```text
upcoming
```

Display:

```text
Days Until Due
```

Example:

```text
Wash Car

Due in 3 days
```

---

# User Summary Widget

Display workload grouped by user.

Example:

```text
Stefan

3 Tenners

35 minutes
```

```text
Julia

2 Tenners

20 minutes
```

---

# Category Summary Widget

Display workload grouped by category.

Example:

```text
Household

4 Tenners
```

```text
Fitness

2 Tenners
```

---

# Empty Dashboard

If no actionable Tenners exist:

Display:

```text
🎉 Everything is done.

No Tenners due today.
```

Provide positive feedback.

Do not show empty tables.

---

# Loading State

Use Skeleton components.

Requirements:

```text
Header Loading

Summary Loading

List Loading
```

Avoid spinner-only loading.

---

# Error State

Display reusable error component.

Example:

```text
Unable to load dashboard.

Please try again.
```

Provide:

```text
Retry Button
```

---

# Responsive Design

Must support:

```text
Desktop

Tablet

Mobile
```

---

## Mobile Layout

Order:

```text
Header

Summary

Due Today

Overdue

Upcoming

User Summary

Category Summary
```

Cards should stack vertically.

---

## Desktop Layout

Allow:

```text
Multi-column cards

Responsive grid
```

Implementation details left to engineer.

---

# Components

Create reusable dashboard components.

Suggested structure:

```text
features/dashboard/

├── DashboardPage
├── SummaryCards
├── DueTodayList
├── OverdueList
├── UpcomingList
├── UserSummaryCard
└── CategorySummaryCard
```

---

# State Management

Use:

```text
TanStack Query
```

Requirements:

```text
Caching

Auto Refresh After Completion

Loading State

Error State
```

Avoid manual state synchronization.

---

# Navigation

Update application navigation.

Default route:

```text
/
```

must redirect to:

```text
/dashboard
```

---

# Accessibility

Requirements:

```text
Keyboard Navigation

Button Labels

Semantic Headings

Screen Reader Support
```

---

# Styling

The page should feel:

```text
Simple

Calm

Actionable
```

Avoid:

```text
Enterprise Dashboard Look

Dense Tables

Excessive Charts
```

The goal is:

```text
Today's Responsibilities
```

not:

```text
Corporate Reporting
```

---

# Testing Requirements

Create tests for:

```text
Dashboard Rendering

Due Today Display

Overdue Display

Upcoming Display

Empty Dashboard

Loading State

Error State

Complete Button

Dashboard Refresh After Completion

Navigation Redirect
```

Minimum coverage:

```text
80%
```

for new code.

---

# Deliverables

Create:

```text
Dashboard Page

Dashboard Components

Dashboard API Hook

Completion Action

Loading Components

Error Components
```

Update:

```text
Routing

Navigation

Tests

Documentation
```

---

# Validation

The following must succeed:

```bash
npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- Dashboard page implemented
- Dashboard API consumed
- Due Today section displayed
- Overdue section displayed
- Upcoming section displayed
- Summary metrics displayed
- Completion action works
- Dashboard refreshes after completion
- Loading states implemented
- Error states implemented
- Responsive design works
- Tests passing

---

# Definition of Done

- Users can see what needs to be done today
- Users can complete Tenners directly from the dashboard
- Dashboard feels usable on mobile and desktop
- The first end-to-end Tenner workflow is available
- Tests pass
- Feature deploys through GitHub Actions

---

# Out of Scope

Do not implement:

- Create Tenner Dialog
- Edit Tenner Dialog
- Tenner Management Page
- Analytics Dashboard
- Settings
- Authentication

These capabilities will be delivered in subsequent frontend tickets.

---

# Implementation Status

Done 2026-10-02.

- `/dashboard` (default route via `/` redirect): header with date and actionable totals, four summary cards,
  sections "Heute fällig", "Überfällig" (red accent, "seit N Tagen überfällig"), "Demnächst" ("fällig in N Tagen"),
  workload per person and per category. Desktop: two columns; mobile: stacked in the required order.
- One-click "Erledigt" on due-today and overdue cards: `POST /tenners/{id}/complete` with
  `actualMinutes = estimatedMinutes` and an `Idempotency-Key`; afterwards dashboard, lists and history are invalidated.
- Empty state "🎉 Alles erledigt." when nothing is actionable; skeleton loading; error with retry.
- Tests: rendering, all sections, empty, loading, error + retry, completion request body, refresh after completion,
  completion failure, redirect. 49 tests, ~98% coverage. Checked in Chromium with mocked API (desktop and phone).
- Assumptions:
  - `completedBy` is Stefan until FRONTEND-007/008 add the current user.
  - Upcoming Tenners have no complete button on the dashboard (the ticket asks for it on due-today cards);
    early completion is available on the Tenners page (FRONTEND-003).
  - The page title is "Heute" instead of "Dashboard" (navigation label stays "Dashboard").

