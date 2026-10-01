# FRONTEND-005: Implement Edit Tenner Dialog

## Type

Frontend Feature

---

## Priority

High

---

## Goal

Implement the Edit Tenner workflow.

This feature enables users to modify existing Tenners directly from the application.

The implementation should reuse as much functionality as possible from the Create Tenner Dialog to avoid duplicated code and simplify future maintenance.

After completion of this ticket, users must be able to:

- Open an existing Tenner
- Modify its properties
- Validate changes
- Save updates
- Immediately see changes reflected throughout the application

---

# Background

The following capabilities already exist:

- Frontend Foundation
- Dashboard Page
- Tenners Page
- Create Tenner Dialog
- Update Tenner API

The Edit button exists on Tenner cards but currently has no functionality.

This ticket completes the update workflow.

---

# Scope

Implement:

```text
Edit Tenner Dialog
```

Triggered from:

```text
Tenners Page

Edit Action
```

---

# User Flow

```text
User selects Edit

↓

Dialog opens

↓

Current values loaded

↓

User modifies values

↓

Client Validation

↓

PUT /tenners/{id}

↓

Success

↓

Dialog closes

↓

Dashboard refreshes

↓

Tenners refresh
```

---

# API Integration

Consume:

```http
PUT /tenners/{tennerId}
```

using the existing API client.

---

# Dialog Design

Reuse:

```text
CreateTennerDialog
```

wherever possible.

Recommended structure:

```text
TennerForm
    ↑
CreateTennerDialog

EditTennerDialog
```

The form should be shared between Create and Edit workflows.

---

# Dialog Title

Display:

```text
Edit Tenner
```

---

# Data Loading

The dialog must preload all editable values.

Example:

```text
Title

Category

Assigned User

Estimated Minutes

Frequency Days

Active Status
```

---

# Editable Fields

## Title

Type:

```text
Text Input
```

Validation:

```text
3 - 100 Characters
```

---

## Category

Type:

```text
Dropdown
```

Options:

```text
HOUSEHOLD

FITNESS

FAMILY

HOME

PERSONAL

FINANCE
```

---

## Assigned User

Options:

```text
STEFAN

JULIA
```

---

## Estimated Minutes

Validation:

```text
1 - 480
```

---

## Frequency Days

Validation:

```text
1 - 3650
```

---

## Active

Allow editing.

Type:

```text
Toggle Switch
```

Labels:

```text
Active

Inactive
```

---

# Read-Only Fields

Display if available.

Do not allow editing.

```text
Tenner ID

Created At

Last Completed

Next Due
```

These values help users understand the Tenner's state.

---

# Validation

Use:

```text
React Hook Form

Zod
```

Validation rules must mirror backend validation.

---

# Frequency Presets

Reuse:

```text
Daily

Weekly

Every 2 Weeks

Monthly

Quarterly

Yearly
```

Selecting a preset updates:

```text
Frequency Days
```

---

# Unsaved Changes Protection

Detect form changes.

If user attempts to close dialog:

```text
Show Confirmation
```

Example:

```text
Discard Unsaved Changes?
```

Options:

```text
Discard

Continue Editing
```

---

# Submit Button

Display:

```text
Save Changes
```

Disabled when:

```text
Form Invalid

No Changes Made

Request In Progress
```

---

# Cancel Button

Display:

```text
Cancel
```

---

# Success Behaviour

On success:

```text
Close Dialog

Refresh Tenners Query

Refresh Dashboard Query

Show Success Snackbar
```

---

# Success Notification

Example:

```text
✅ Tenner updated successfully.
```

---

# Error Behaviour

Display user-friendly errors.

Example:

```text
Unable to save changes.

Please try again.
```

---

# Archived Tenners

Support editing archived Tenners.

Users should still be able to:

```text
Change Metadata

Reactivate Through Active Toggle
```

if desired.

---

# Responsive Design

Must support:

```text
Mobile

Tablet

Desktop
```

---

## Mobile

Use:

```text
Full Screen Dialog
```

---

# Accessibility

Requirements:

```text
Keyboard Navigation

Focus Management

Proper Labels

Screen Reader Support
```

---

# Components

Create:

```text
features/tenners/

├── EditTennerDialog
├── EditTennerButton
├── DiscardChangesDialog
└── TennerForm
```

Refactor Create Dialog if needed.

Avoid duplicate form implementations.

---

# Hooks

Create:

```text
useUpdateTenner()
```

Responsibilities:

```text
Mutation Handling

Error Handling

Query Invalidation
```

Use:

```text
TanStack Query Mutation
```

---

# State Management

Use:

```text
React Hook Form

TanStack Query
```

Avoid unnecessary local state duplication.

---

# Testing Requirements

Create tests for:

```text
Dialog Opens

Existing Data Loaded

Field Updates

Validation

Successful Save

Failed Save

No Changes State

Unsaved Changes Warning

Snackbar Display

Dashboard Refresh

Tenners Refresh

Active Toggle

Archived Tenner Editing
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
Edit Tenner Dialog

Shared Tenner Form

Update Mutation Hook

Unsaved Changes Protection
```

Update:

```text
Tenners Page

Create Dialog Integration

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

- Edit dialog opens correctly
- Existing values loaded
- Validation works
- PUT endpoint called successfully
- Unsaved changes detected
- Dashboard refreshes after save
- Tenners page refreshes after save
- Snackbar notification displayed
- Mobile layout works
- Tests passing

---

# Definition of Done

- Users can edit existing Tenners
- Create and Edit workflows share components
- Validation prevents invalid updates
- Data refreshes automatically
- User experience is consistent with Create workflow
- Feature deploys through GitHub Actions

---

# Out of Scope

Do not implement:

- Bulk Editing
- Import / Export
- Analytics
- Notifications
- Authentication
- Advanced Scheduling

These capabilities will be implemented in future tickets.
