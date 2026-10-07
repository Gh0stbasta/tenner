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

- Attach `Authorization: Bearer <ID token>` to all API requests (ADR 0001: custom attributes are only in the ID token).
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

---

# Implementation Status

Implemented 2026-10-02.

- [x] Users must log in: `AuthGate` redirects to Cognito managed login (code flow + PKCE, `lang=de`)
- [x] API requests are authenticated: `Authorization: Bearer <ID token>` (ADR 0001)
- [x] Token refresh: automatic silent renew with the refresh token; on `401` one refresh + retry, then login
- [x] Logout: tokens removed, Cognito `/logout` endpoint, back to the app
- [x] Current user from `custom:userId`; header shows the name with "Abmelden"; missing attribute → "Konto nicht eingerichtet"
- [x] Tests: 25 new (session helpers, UserManager settings and token handling, AuthGate, callback page, API client
  401 handling, config). Frontend: lint, 196 tests (~98.6% coverage), build.
- [x] Browser check (Chromium, mocked Cognito and API): redirect to `/oauth2/authorize` with PKCE S256 and `lang=de`,
  callback → code exchange → back to `/tenners/t-1`, ID token on every API call, still logged in after reload.

Library choice: `oidc-client-ts` + `react-oidc-context` (standard OIDC, ~120 kB unpacked for the React binding);
AWS Amplify would add a much larger dependency for the same flow.

Token storage: `localStorage` for 30 days (owner decision 2026-10-02, ADR 0001). XSS trade-off: injected scripts could
read the tokens; mitigated by the CSP (`script-src 'self'`), no third-party scripts and 1-hour token lifetimes.

Deviations:

- FRONTEND-008 (settings) does not exist yet; the header selector ("Ich bin") was removed instead of a settings dropdown.
- The ID token is sent instead of the access token (ADR 0001).
- Deploy: `deploy.yml` passes `VITE_COGNITO_ISSUER_URL`, `VITE_COGNITO_CLIENT_ID` and `VITE_COGNITO_LOGIN_URL` from Terraform outputs.

