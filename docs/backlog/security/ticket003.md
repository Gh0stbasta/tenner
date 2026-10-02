# SECURITY-003: Integrate Login in the Frontend

## Type

Frontend Feature / Security

---

## Priority

Critical

---

## Phase

MVP

---

## Goal

Allow household members to log in and use the protected API from the frontend.

---

# Background

After SECURITY-002 the API requires JWTs. The SPA must obtain tokens via the
Authorization Code flow with PKCE and attach them to API requests.

---

# Dependencies

```text
SECURITY-002
FRONTEND-001
FRONTEND-008
```

---

# Scope

## Library

Use a maintained OIDC client (e.g. `oidc-client-ts` / `react-oidc-context`)
or AWS Amplify Auth. Prefer the smaller dependency; justify the choice.

## Flow

```text
Unauthenticated user → redirect to Cognito managed login
→ callback route /auth/callback
→ tokens stored in memory; refresh token handling per library defaults
→ return to original route
```

Avoid storing tokens in Local Storage where the library allows in-memory/session storage.
Document the chosen storage and its XSS trade-off.

## API Client

- Attach `Authorization: Bearer <access token>` to all API requests.
- On `401`, attempt silent refresh once, then redirect to login.

## Current User

The current user is derived from the token (`custom:userId`).
The "Current User" dropdown in Settings (FRONTEND-008) is removed or becomes read-only.

## Logout

Logout clears tokens and calls the Cognito logout endpoint.

---

# Testing Requirements

```text
Redirect When Unauthenticated
Callback Handling
Token Attached To Requests
401 Refresh And Retry
Logout
Current User From Token
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Auth provider and routes
API client changes
Settings adjustment
Tests
README (login, user provisioning reference)
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

- Users must log in to use Tenner
- API requests are authenticated
- Token refresh works
- Logout works
- Current user derived from identity
- Tests passing

---

# Definition of Done

- The deployed application is only usable by household members
- Feature deploys through GitHub Actions

---

# Out of Scope

- Custom login UI
- MFA (SECURITY-011)
- Social login (FUTURE-011)
