# FRONTEND-004: Implement Create Tenner Dialog

## Type

Frontend Feature

---

## Priority

Critical

---

## Goal

Implement the Create Tenner workflow.

This feature enables users to create new Tenners directly from the application and represents the first complete content creation workflow in the frontend.

After completion of this ticket, users must be able to:

- Open a creation dialog
- Enter Tenner details
- Validate data before submission
- Submit the Tenner
- Automatically refresh the dashboard and Tenner list

This completes the first full end-to-end flow from frontend to backend.

---

# Background

The following functionality already exists:

- Frontend Foundation
- Dashboard Page
- Tenners Page
- Create Tenner API
- Dashboard API

The "New Tenner" button already exists but has no functionality attached.

This ticket implements the creation experience.

---

# Scope

Implement:

```text
Create Tenner Dialog
```

Triggered from:

```text
Tenners Page

+ New Tenner
```

---

# User Flow

```text
User clicks

+ New Tenner

↓

Dialog opens

↓

User enters values

↓

Client Validation

↓

POST /tenners

↓

Success

↓

Dialog closes

↓

Dashboard refreshes

↓

Tenner List refreshes
```

---

# API Integration

Consume:

```http
POST /tenners
```

using the existing API client.

---

# Dialog Design

Use:

```text
Material UI Dialog
```

Requirements:

```text
Responsive

Accessible

Mobile Friendly
```

---

# Dialog Title

Display:

```text
Create Tenner
```

---

# Form Layout

Provide the following fields.

---

## Title

Type:

```text
Text
```

Required:

```text
Yes
```

Validation:

```text
3 - 100 Characters
```

Placeholder:

```text
Vacuum Office
```

---

## Category

Type:

```text
Dropdown
```

Required:

```text
Yes
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

## Assigned To

Type:

```text
Dropdown
```

Required:

```text
Yes
```

Options:

```text
STEFAN

JULIA
```

---

## Estimated Minutes

Type:

```text
Number
```

Required:

```text
Yes
```

Validation:

```text
1 - 480
```

Suggested helper text:

```text
Typical duration in minutes.
```

---

## Frequency Days

Type:

```text
Number
```

Required:

```text
Yes
```

Validation:

```text
1 - 3650
```

---

# Frequency Presets

Provide quick-select chips.

Examples:

```text
Daily (1)

Weekly (7)

Every 2 Weeks (14)

Monthly (30)

Quarterly (90)

Yearly (365)
```

Selecting a preset updates:

```text
Frequency Days
```

Users may still enter custom values manually.

---

# Form Validation

Use:

```text
React Hook Form

Zod
```

Validation must mirror backend rules.

---

## Validation Display

Show errors inline.

Examples:

```text
Title is required.

Frequency must be at least 1 day.

Estimated minutes must be between 1 and 480.
```

Do not wait for backend validation.

---

# Submit Button

Display:

```text
Create Tenner
```

Button remains disabled when:

```text
Form Invalid

Submission Active
```

---

# Implementation Status

Done 2026-10-02.

- "Neuer Tenner" on `/tenners` opens "Tenner anlegen" (MUI dialog, full screen on phones).
- Fields: Titel, Kategorie, Zuständig, Geschätzte Minuten, Häufigkeit in Tagen; presets Täglich (1), Wöchentlich (7),
  Alle 2 Wochen (14), Monatlich (30), Vierteljährlich (90), Jährlich (365).
- Validation with React Hook Form + Zod (`tennerForm.schema.ts`, same limits as the backend): inline messages while
  typing; the submit button stays disabled while the form is invalid or a request runs.
- `POST /tenners`; on success the dialog closes, dashboard and lists are invalidated and a snackbar confirms.
  On failure the input is kept and an error is shown; backend `VALIDATION_ERROR` details appear on the field.
- New shared pieces: `TennerForm` (reused by FRONTEND-005), `NotificationProvider`/`useNotify`, `applyServerErrors`.
- Tests: 12 new (dialog and notifications). Frontend: lint, 84 tests (~98% coverage), build; Chromium check.
- Assumptions:
  - This ticket file ends after "Submit Button" (truncated). Success and error behaviour follow FRONTEND-005
    (close, refresh, snackbar; keep input on failure).
  - Defaults: Haushalt, current user, 10 minutes, every 14 days (same as Quick Add, FRONTEND-006).

