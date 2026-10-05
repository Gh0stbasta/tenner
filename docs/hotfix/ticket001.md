# HOTFIX-001: First Login & Household Assignment Flow

> Filed as "FRONTEND-009"; that ID already belongs to `docs/backlog/frontend/ticket009.md` (Tenner detail view),
> so this ticket is referenced as **HOTFIX-001**.

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

---

# Owner Decision (2026-10-05)

Self-assignment without a restriction would let every Google account become Stefan or Julia and read all
household data. Decision: **each household member can be claimed by exactly one account** (in addition to
"one account, one member"). Once both are claimed, other accounts see "Kein freier Platz".
Recorded as an amendment to ADR 0002.

---

# Implementation Status

Implemented 2026-10-05.

- Mapping model: the Cognito group `household:<tenantId>:<userId>` of the Cognito user (username
  `google_<Google subject>`, e-mail attribute from Google). No new table: the backend already authorizes by this
  group (SECURITY-004/FUTURE-011), so household routes are unchanged.
- Backend:
  - `GET /onboarding` and `POST /onboarding/assignment` (JWT required, no household required; principal =
    `cognito:username`).
  - `HouseholdAssignmentService`: 409 `ALREADY_ASSIGNED` / `MEMBER_TAKEN`; re-count after adding resolves
    concurrent claims.
  - `CognitoHouseholdMembershipRepository` (new pinned dependency `@aws-sdk/client-cognito-identity-provider`
    3.1145.0, same version as the DynamoDB client); config `COGNITO_USER_POOL_ID`, `HOUSEHOLD_TENANT_ID`.
- Terraform: two routes, Lambda environment, inline policy `tenner-api-role-cognito` (four group actions on the
  user pool only).
- Frontend: `AssignmentPage`, `AssignmentCard`, `useOnboarding` / `useAssignHouseholdMember` replace
  "Konto nicht eingerichtet"; after the choice `signinSilent` fetches a token with the group, then the dashboard
  opens. Existing assignments skip the page; "Kein freier Platz" when all members are taken.
- Docs: ADR 0002 amendment, architecture (authorization model), README (household membership, wrong claims),
  backend and frontend READMEs, TD-020 updated, TD-023 new.

Validation:

- Backend: lint, build, 435 tests (first login, existing assignment, Stefan and Julia assignment, already
  assigned, member taken, concurrent claim, tenant in group name, handlers, routing, 401 without claims,
  Cognito repository and wiring).
- Frontend: lint, `format:check`, build, 208 tests (first login, existing assignment, Stefan, Julia, failure,
  member taken, already assigned in another tab, no free member, refresh failure, redirect to dashboard).
- Terraform: `fmt -check`, `validate`, `test` (44 passed; Cognito policy scope, Lambda environment, routes).
- Browser check (Chromium, phone width, mocked Cognito and API): first login shows the choice with Julia taken;
  choosing Stefan → refresh-token grant → dashboard as Stefan.

Acceptance criteria:

- [x] Any Google account can log in
- [x] User is no longer blocked after login (as long as a member is free; otherwise "Kein freier Platz")
- [x] First login shows assignment screen
- [x] User can select Stefan or Julia
- [x] Assignment is persisted (Cognito group)
- [x] Returning users bypass onboarding
- [x] User reaches dashboard successfully (mocked end-to-end; live check after deploy)

Open after the deploy: sign in as Stefan and Julia right away (until then a stranger could claim a free member,
TD-020), and confirm the live flow.
