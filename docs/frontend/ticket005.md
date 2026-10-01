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

The form should be shared between Create and
