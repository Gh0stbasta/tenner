# FUTURE-011: Add Social Login (Google)

## Type

Security Feature (Postponed)

---

## Priority

High (pulled forward by the owner on 2026-10-02)

---

## Phase

MVP (pulled forward; originally Long-Term)

---

## Goal

Household members sign in with their Google account. Nobody has to create accounts with the AWS CLI,
and there are no Tenner passwords.

---

# Background

Listed in the architecture as a future Cognito feature. Mainly valuable for public
sign-up (FUTURE-003); for a single household with admin-created accounts the benefit is small.

---

## Owner Decisions (2026-10-02)

- **Google only**: e-mail/password login is removed (no Tenner passwords, no admin-created accounts).
- **Anyone with a Google account may sign in.** The owner sees new accounts in Cognito and decides who
  belongs to the household. This replaces "no automatic account creation" from the original scope.
- Separate PR after SECURITY-001 – 004 (PR #4, merged).

---

# Dependencies

```text
SECURITY-002
SECURITY-003
FUTURE-003
```

---

# Scope

- Cognito identity provider `Google` (OIDC scopes `openid email profile`); the app client supports only Google.
- Google OAuth client ID as a GitHub variable, client secret as a GitHub secret, passed to Terraform as
  `TF_VAR_*`. Nothing is committed.
- Household membership through Cognito groups `household:<tenantId>:<userId>` (e.g. `household:default:STEFAN`),
  created by Terraform. The owner adds a Google user to a group with one CLI command. The group arrives in the
  ID token (`cognito:groups`).
- Backend: tenant and user from the household group (SECURITY-004 semantics unchanged: no group → 403).
- Frontend: login goes straight to Google (`identity_provider=Google`); a signed-in user without a group sees
  "Konto nicht eingerichtet".

# Requirements

- Strangers can sign in but never see or change household data.
- Exactly one household group per user; zero or several → 403.
- Group membership changes take effect at the next token refresh (at most 60 minutes) or immediately after a
  global sign-out.
- Terraform fails with a clear message if the Google client ID or secret is missing.

---

# Deliverables

```text
Identity provider configuration
Linking logic
Documentation
Tests
```

---

# Acceptance Criteria

- [ ] Members can sign in with Google (verified after deploy)
- [x] Password login is no longer offered by the app client
- [x] Users without a household group get 403 from the API and "Konto nicht eingerichtet" in the frontend
- [x] Tenant and user come only from the household group in the verified ID token
- [x] Google client secret is not committed (GitHub secret → `TF_VAR`, sensitive variable)
- [x] Terraform tests, backend and frontend tests pass
- [x] README explains the Google client setup and how to add someone to the household

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated (README, architecture, ADR)
- [x] Technical debt documented
- [ ] Acceptance criteria verified (Google sign-in after deploy)
- [x] Git commit created

---

# Assumptions

- Cognito creates federated users even with `allow_admin_create_user_only = true` (that setting only blocks
  self sign-up with a password). To be verified on the first Google login.
- The Google OAuth consent screen is set to "In production" so any Google account can sign in. With the basic
  scopes `openid email profile`, Google does not require app verification.

---

# Out of Scope

- Enterprise SSO (SAML)
- Sign in with Apple
- Own households for strangers (public sign-up, FUTURE-003)
- Automatic group assignment (e.g. by e-mail allowlist)

---

# Implementation Status

Implemented 2026-10-02 (separate PR after PR #4).

- Terraform (`terraform/auth.tf`, `locals.tf`, `variables.tf`, `outputs.tf`):
  - `aws_cognito_identity_provider.google` (scopes `openid email profile`, maps `email` and `username = sub`).
  - App client: `supported_identity_providers = ["Google"]`, `explicit_auth_flows = ["ALLOW_REFRESH_TOKEN_AUTH"]`
    (password and SRP login removed).
  - `aws_cognito_user_group.household`: `household:default:STEFAN`, `household:default:JULIA`.
  - Variables `google_client_id` (format validated) and `google_client_secret` (sensitive, non-empty).
  - Outputs `cognito_google_redirect_uri`, `cognito_household_groups`.
- Workflows: `deploy.yml` and `pr.yml` pass `vars.GOOGLE_CLIENT_ID` / `secrets.GOOGLE_CLIENT_SECRET` as `TF_VAR_*`
  to `terraform plan` only.
- Backend: `identityFromEvent` reads the household group from `cognito:groups` (string `"[a b]"` or array);
  none, several or invalid → 403. Custom attributes are no longer read.
- Frontend: authorize request with `identity_provider=Google` (Cognito page skipped); current user from the
  household group; "Konto nicht eingerichtet" explains how to get access.
- Docs: ADR 0002 (ADR 0001 amended), README ("Google Sign-In and User Accounts", deployment prerequisites,
  CI permissions), architecture (security section, authorization model), frontend and backend READMEs,
  TD-020 – TD-022.

Validation:

- Terraform: `fmt -check`, `validate`, `test` (42 passed; new runs `sign_in_is_google_only`,
  `household_groups_exist`, two variable-validation runs). `actionlint` on both workflows.
- Backend: lint, build, 407 tests (identity: household group, ignored groups, two groups, unknown user,
  malformed tenant, legacy custom attributes rejected, flattened claim parsing).
- Frontend: lint, `format:check`, build, 196 tests.
- Browser check (Chromium, mocked Cognito and API): the authorize request carries `identity_provider=Google`,
  `lang=de` and PKCE S256; a member lands in the app with ID-token API calls; a Google user without a group sees
  "Konto nicht eingerichtet" and makes no API calls.

Acceptance criteria:

- [ ] Members can sign in with Google — open until deploy (needs the Google client and GitHub variable/secret)
- [x] Password login is no longer offered by the app client
- [x] Users without a household group get 403 from the API and "Konto nicht eingerichtet" in the frontend
- [x] Tenant and user come only from the household group in the verified ID token
- [x] Google client secret is not committed (GitHub secret → `TF_VAR`, sensitive variable)
- [x] Terraform tests, backend and frontend tests pass
- [x] README explains the Google client setup and how to add someone to the household

Open after the deploy: first Google sign-in (also verifies the assumption that `allow_admin_create_user_only`
does not block federated users), add both members to their groups, check 403 for a stranger.
