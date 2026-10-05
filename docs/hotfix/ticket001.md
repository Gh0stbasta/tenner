# FRONTEND-009: First Login & Household Assignment Flow

## Type

Frontend Feature

---

## Priority

High

---

## Goal

Allow any authenticated Google user to enter Tenner for the first time and self-assign to a household member profile.

The application should not block users immediately after a successful Google login.

Instead, users should be guided through a lightweight onboarding process.

---

# Background

Current behavior:

```text
Google Login
↓
Cognito Authentication Successful
↓
User Not Assigned To Household
↓
Access Blocked
```

Current screen:

```text
"Konto nicht eingerichtet"
```

This creates unnecessary friction.

---

# Desired Behavior

New users should be able to access Tenner after successful authentication.

If no household mapping exists:

```text
Google Login
↓
First Login Detected
↓
Household Assignment Screen
↓
Select Household Member
↓
Continue To Dashboard
```

---

# Scope

Replace:

```text
Account Not Configured
```

with:

```text
Household Assignment Flow
```

---

# Household Assignment Screen

Display:

```text
Welcome to Tenner
```

Explain:

```text
Your Google account is not yet linked to a household member.

Please choose who you are.
```

---

# Available Choices

Initially:

```text
Stefan

Julia
```

Display as cards or buttons.

Example:

```text
👤 Stefan

👤 Julia
```

---

# Assignment Workflow

User selects:

```text
Stefan
```

or

```text
Julia
```

↓

API call

↓

Mapping stored

↓

Redirect to dashboard

---

# Mapping Model

Store:

```text
Google Subject ID

Google Email

Household User
```

Example:

```json
{
  "provider": "google",
  "email": "stefan@gmail.com",
  "householdUser": "STEFAN"
}
```

---

# Restrictions

One Google account may only be assigned once.

If an assignment already exists:

```text
Skip onboarding
```

and go directly to:

```text
Dashboard
```

---

# Future Support

Design must allow future household members.

Example:

```text
Henry

Hugo

Harper
```

without redesign.

---

# Admin Override

Not required.

Do not implement household administration.

This ticket only establishes the initial user mapping.

---

# Error Handling

If assignment fails:

```text
Unable to assign account.

Please try again.
```

---

# Components

Create:

```text
Assignment Page

Assignment Card

Assignment Hook
```

---

# Testing Requirements

Create tests for:

```text
First Login

Existing Assignment

Stefan Assignment

Julia Assignment

Assignment Failure

Redirect To Dashboard
```

---

# Acceptance Criteria

- Any Google account can log in
- User is no longer blocked after login
- First login shows assignment screen
- User can select Stefan or Julia
- Assignment is persisted
- Returning users bypass onboarding
- User reaches dashboard successfully

---

# Definition of Done

- Google authentication works end-to-end
- First-time users can onboard themselves
- Household mapping established
- No manual Cognito user creation required
- Dashboard becomes reachable after login

---

# Out of Scope

Do not implement:

- Multi-household support
- Invitations
- Role management
- Household administration
- User deletion

These capabilities will be implemented in future tickets.
