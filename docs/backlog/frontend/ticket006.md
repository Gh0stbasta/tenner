# FRONTEND-006: Implement Quick Add Tenner Experience

## Type

Frontend Feature

---

## Priority

High

---

## Goal

Implement a fast and frictionless Tenner creation experience.

The purpose of Quick Add is to enable users to create recurring Tenners in seconds without opening the full Create Dialog.

This feature is optimized for the primary Tenner use case:

```text
I just noticed something that should become a recurring responsibility.
```

Examples:

```text
Vacuum Office

Wash Car

Clean Front Door

Long Zwift Ride

Mobility Session

Clean Exterior Windows
```

The user should be able to capture the Tenner immediately and refine it later if necessary.

---

# Background

Current workflow:

```text
Open Tenners

New Tenner

Fill Form

Save
```

is correct but too slow for rapid entry.

The application should encourage users to capture ideas immediately before they are forgotten.

---

# Scope

Implement:

```text
Quick Add
```

from:

```text
Dashboard

Tenners Page
```

---

# User Experience

Example:

```text
+ Quick Add

[ Vacuum Office ]
```

User enters:

```text
Vacuum Office
```

Presses:

```text
Enter
```

Immediately creates:

```text
Title            = Vacuum Office
Category         = HOUSEHOLD
Assigned To      = STEFAN
EstimatedMinutes = 10
FrequencyDays    = 14
```

The Tenner is created immediately.

---

# Quick Add Widget

Display:

```text
What should become a Tenner?
```

Input field:

```text
Single Line Text
```

---

# Quick Add Button

Display:

```text
Add
```

Pressing Enter must do the same.

---

# Default Values

New Quick Add Tenners use:

```text
Category         = HOUSEHOLD

AssignedTo       = STEFAN

EstimatedMinutes = 10

FrequencyDays    = 14

Active           = true
```

These defaults should be configurable later.

---

# API Integration

Use:

```http
POST /tenners
```

Existing Create API.

No new backend endpoint required.

---

# Success Behaviour

After successful creation:

```text
Input Cleared

Dashboard Refreshed

Tenners Refreshed

Snackbar Displayed
```

---

# Success Message

Example:

```text
✅ Tenner created.
```

Keep notifications lightweight.

---

# Smart Suggestions

Implement heuristic suggestions based on title keywords.

Examples:

```text
ride
zwift
bike
cycling
```

suggest:

```text
FITNESS
```

---

```text
window

office

vacuum

clean
```

suggest:

```text
HOUSEHOLD
```

---

```text
date

family

kids

henry

hugo

harper
```

suggest:

```text
FAMILY
```

These suggestions only prefill.

Users can still edit later.

---

# Duplicate Detection

Before creation:

Check existing Tenners.

If a similar title exists:

Display warning.

Example:

```text
A similar Tenner already exists:

Vacuum Office
```

Options:

```text
Create Anyway

Cancel
```

---

# Mobile Experience

The Quick Add input must be visible without scrolling.

This is one of the most frequently used features.

Optimize for:

```text
Phone

Tablet
```

first.

---

# Dashboard Integration

Add Quick Add to:

```text
Dashboard Header
```

Location:

```text
Top of the page
```

Users should be able to create a Tenner immediately after noticing a gap.

---

# Tenners Page Integration

Add Quick Add to:

```text
Tenners Page Header
```

Position near:

```text
New Tenner Button
```

---

# Progressive Enhancement

A newly created Quick Add Tenner should immediately support:

```text
Edit

Complete

Archive

Restore
```

through existing workflows.

---

# Components

Create:

```text
features/tenners/

├── QuickAddTenner
├── QuickAddInput
├── DuplicateWarningDialog
└── useQuickAddTenner
```

---

# Hooks

Create:

```text
useQuickAddTenner()
```

Responsibilities:

```text
Input Handling

API Mutation

Duplicate Detection

Query Invalidation

Error Handling
```

---

# State Management

Use:

```text
TanStack Query
```

for:

```text
Mutation

Cache Refresh

Optimistic Updates
```

Optional:

```text
Optimistically display new Tenner
```

before API response.

---

# Accessibility

Requirements:

```text
Keyboard First

Enter To Submit

Screen Reader Labels

Mobile Friendly
```

---

# Error Handling

Examples:

```text
Unable to create Tenner.
```

```text
Title is required.
```

```text
Title must be at least 3 characters.
```

---

# Testing Requirements

Create tests for:

```text
Quick Add Rendering

Enter Creates Tenner

Button Creates Tenner

Default Values Used

Input Cleared After Save

Dashboard Refresh

Tenners Refresh

Validation Errors

Duplicate Detection

Suggested Categories

Mobile Rendering

API Failure
```

Coverage:

```text
80%
```

minimum for new code.

---

# Deliverables

Create:

```text
Quick Add Component

Quick Add Hook

Duplicate Detection

Category Suggestions
```

Update:

```text
Dashboard Page

Tenners Page

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

- Quick Add available on Dashboard
- Quick Add available on Tenners page
- Enter creates a Tenner
- Default values applied correctly
- API integration works
- Dashboard refreshes automatically
- Tenners page refreshes automatically
- Duplicate warning works
- Mobile layout works
- Tests passing

---

# Definition of Done

- Users can create Tenners in under 10 seconds
- Friction for adding recurring tasks is minimized
- Dashboard feels fast and actionable
- Existing workflows continue to work
- Feature deploys through GitHub Actions

---

# Out of Scope

Do not implement:

- Templates
- AI-generated Tenners
- Bulk Import
- Voice Input
- Analytics
- Notifications

These capabilities may be implemented in future tickets.

---

# Implementation Status

Done 2026-10-02.

- Quick Add card at the top of the dashboard (below the header, visible without scrolling on phones) and of the
  Tenners page: "Was soll ein Tenner werden?" + "Hinzufügen" (icon-only on phones); Enter submits.
- Defaults: Haushalt, current user (Stefan until FRONTEND-007/008), 10 minutes, every 14 days; new Tenners are
  active and can be edited, completed, archived and restored like any other.
- Smart suggestions (`quickAdd.ts`): German and English keywords per category (e.g. zwift/rad/laufen → Fitness,
  saugen/putzen/fenster → Haushalt, kinder/henry/hugo/harper → Familie). The hint below the input shows the
  category that will be used and that everything can be changed later.
- Duplicate detection: before creating, the active list (cached or fetched) is checked for equal titles or titles
  that contain each other (≥ 4 characters, case and spaces ignored). A dialog offers "Trotzdem anlegen" or "Abbrechen".
  If the list cannot be loaded, the Tenner is still created.
- Success: input cleared, dashboard and lists refreshed, snackbar. Errors: inline validation (required, 3–100
  characters) and "Tenner konnte nicht angelegt werden." with the input kept.
- Tests: 23 new (rules and widget). Frontend: lint, 117 tests (~98.6% coverage), build; Chromium check on a phone.
- Assumptions:
  - Assigned user = current user instead of a fixed STEFAN, so FRONTEND-008 can make it configurable; today both are Stefan.
  - Additional categories (Haus & Garten, Finanzen, Persönlich) got keywords too; the first matching category wins.
  - No optimistic insert (optional in the ticket); the lists refresh right after the response.

