# FRONTEND-003: Implement Tenner Management Page

## Type

Frontend Feature

---

## Priority

Critical

---

## Goal

Implement the Tenner Management Page.

This page serves as the primary management interface for all Tenners and allows users to:

- View all Tenners
- Filter Tenners
- Search Tenners
- Create new Tenners
- Navigate to editing workflows
- Manage active and archived Tenners

This page becomes the operational hub of the application.

---

# Background

The following functionality already exists:

- Frontend Foundation
- Dashboard Page
- Dashboard API
- Tenner CRUD APIs
- Completion Workflow
- Restore Workflow

Users can already see what is due today.

They now need a place to manage their recurring responsibilities.

---

# Scope

Implement:

```text
/tenners
```

---

# API Integration

Consume:

```http
GET /tenners
```

Use existing backend filtering capabilities where possible.

Refresh data using TanStack Query.

---

# Page Layout

Create:

```text
Page Header

Search Area

Filter Area

Tenner List

Actions
```

---

# Page Header

Display:

```text
Tenners
```

and summary information.

Example:

```text
34 Active Tenners

4 Overdue

367 Estimated Minutes
```

---

# Create Button

Display:

```text
+ New Tenner
```

Prominently in the page header.

Action:

```text
Open Create Tenner Dialog
```

Implementation of the dialog is handled in FRONTEND-004.

Only trigger wiring is required in this ticket.

---

# Search

Implement free-text search.

Search:

```text
Title
```

Search should update results live.

Debounce:

```text
300ms
```

---

# Filters

Create filter controls.

---

## Status Filter

Options:

```text
Active

Archived

All
```

Default:

```text
Active
```

---

## User Filter

Options:

```text
All

Stefan

Julia
```

---

## Category Filter

Options:

```text
All

Household

Fitness

Family

Home

Personal

Finance
```

---

# Sorting

Support:

```text
Due Date

Title

Created Date

Updated Date
```

---

## Sort Direction

```text
Ascending

Descending
```

---

# Tenner List

Display Tenners as cards.

Avoid tables for MVP.

The application should feel mobile friendly.

---

# Tenner Card

Display:

```text
Title

Category

Assigned User

Estimated Minutes

Frequency

Next Due Date

Status
```

---

## Example

```text
Vacuum Office

HOUSEHOLD

Stefan

10 Minutes

Every 14 Days

Due: 2026-10-15
```

---

# Status Badges

Display visually:

```text
Due Today

Overdue

Upcoming

Archived
```

---

## Overdue Example

```text
Overdue by 17 Days
```

---

# Row Actions

For every Tenner display:

```text
Edit

Complete

Archive
```

---

## Edit

Action:

```text
Open Edit Dialog
```

Implementation handled in future ticket.

---

## Complete

Action:

```text
POST /tenners/{id}/complete
```

After success:

```text
Refresh List

Refresh Dashboard Cache
```

---

## Archive

Action:

```text
DELETE /tenners/{id}
```

Use existing soft delete API.

Before execution display confirmation dialog.

---

# Archived View

When:

```text
Status = Archived
```

Display:

```text
Restore
```

instead of:

```text
Archive
```

---

## Restore

Action:

```text
POST /tenners/{id}/restore
```

After success:

```text
Refresh Data
```

---

# Empty State

Example:

```text
No Tenners Found
```

Display:

```text
Try adjusting filters or create your first Tenner.
```

---

# Loading State

Requirements:

```text
Skeleton Cards

Filter Loading

Page Loading
```

Avoid spinner-only interfaces.

---

# Error State

Display reusable error component.

Example:

```text
Unable to load Tenners.

Please try again.
```

Provide retry functionality.

---

# Responsive Design

Support:

```text
Desktop

Tablet

Mobile
```

---

## Mobile

Cards stack vertically.

Actions collapse into:

```text
More Menu
```

if necessary.

---

## Desktop

Responsive grid layout.

Suggested:

```text
2-4 cards per row
```

depending on screen width.

---

# Components

Create:

```text
features/tenners/

├── TennersPage
├── TennerCard
├── TennerFilters
├── TennerSearch
├── TennerStatusBadge
├── EmptyState
└── ConfirmArchiveDialog
```

---

# State Management

Use:

```text
TanStack Query
```

Requirements:

```text
Query Caching

Automatic Refresh

Mutation Handling

Optimistic Updates Optional
```

---

# Accessibility

Requirements:

```text
Keyboard Navigation

Aria Labels

Semantic HTML

Accessible Dialogs
```

---

# Logging

Frontend telemetry should log:

```text
Tenner Completed

Tenner Archived

Tenner Restored

Filter Changed
```

Implementation may use console logging initially.

Formal telemetry will be added later.

---

# Testing Requirements

Create tests for:

```text
Page Rendering

Search

User Filter

Category Filter

Status Filter

Sorting

Empty State

Loading State

Error State

Complete Action

Archive Action

Restore Action
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
Tenners Page

Tenner Card Components

Search Components

Filter Components

Archive Workflow

Restore Workflow
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

- Tenners page implemented
- Search works
- Filters work
- Sorting works
- Complete action works
- Archive action works
- Restore action works
- Responsive layout works
- Loading states implemented
- Error states implemented
- Tests passing

---

# Definition of Done

- Users can manage all Tenners from a single page
- Active and archived Tenners are supported
- Existing backend APIs are fully consumable
- Dashboard and Management pages work together
- Feature deploys through GitHub Actions

---

# Out of Scope

Do not implement:

- Create Tenner Dialog
- Edit Tenner Dialog
- Analytics
- Settings
- Authentication
- Notifications

These capabilities will be implemented in future frontend tickets.
