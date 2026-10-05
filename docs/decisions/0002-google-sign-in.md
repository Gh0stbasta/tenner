# ADR 0002: Google Sign-In and Household Membership through Cognito Groups

- **Status:** Accepted (2026-10-02); amended 2026-10-05 (self-assignment, HOTFIX-001, see the end)
- **Ticket:** FUTURE-011 (pulled forward)
- **Deciders:** repository owner (Stefan)
- **Amends:** [ADR 0001](0001-authentication.md) (sign-up, login UI and identity attributes)

## Context

ADR 0001 introduced Cognito with admin-created e-mail/password accounts and the identity attributes
`custom:tenantId` / `custom:userId`. The owner does not want to create accounts with the AWS CLI or manage
passwords, and wants to sign in with Google.

Constraints:

- Federated users are created by Cognito on their first sign-in. Their attributes come from the Google
  attribute mapping, which cannot provide a tenant or household member.
- `custom:tenantId` is immutable, so it cannot be set after a federated user exists.
- The backend (SECURITY-004) must still get tenant and acting user only from verified claims.

## Considered Options

| Option | Description | Assessment |
|---|---|---|
| A | Google IdP, membership through **Cognito groups** `household:<tenantId>:<userId>` (in the ID token as `cognito:groups`) | No Lambda, no personal data in the repository, one CLI command per new member, revocable |
| B | Google IdP plus a pre-sign-up / pre-token-generation Lambda with an e-mail allowlist | Automatic, but adds a Lambda, its IAM and tests, and the e-mail addresses must live in a secret |
| C | Google IdP linked to admin-created accounts (`AdminLinkProviderForUser`) | Keeps the custom attributes, but needs the Google subject in advance and both CLI steps |

## Decision

**Option A** (owner decisions 2026-10-02):

| Topic | Decision |
|---|---|
| Identity provider | Google only (`supported_identity_providers = ["Google"]`); password login and SRP auth flows are disabled |
| Who may sign in | Anyone with a Google account. Signing in alone grants nothing |
| Household membership | Exactly one Cognito group `household:<tenantId>:<userId>`, assigned by an administrator (README) |
| Login UI | The app sends `identity_provider=Google`, so the Cognito page is skipped and Google opens directly |
| Google client | ID as GitHub variable, secret as GitHub secret, passed as `TF_VAR_*` to `terraform plan` |
| Backend | `identityFromEvent` reads `cognito:groups`; no group, several groups or an invalid group → 403 |
| Custom attributes | Stay in the pool schema (removing them would replace the pool), but are no longer used |

## Consequences

- No passwords and no account creation by an administrator; one `admin-add-user-to-group` per member instead.
- Strangers can create Cognito users. They count as monthly active users (free up to 10,000 on Essentials) and
  see "Konto nicht eingerichtet". The owner reviews and deletes them with the CLI (TD-020).
- Membership changes take effect at the next token refresh (≤ 60 minutes) or immediately after a global sign-out.
- The Google client secret is stored in the Terraform state (encrypted S3 bucket) and in GitHub (TD-021).
- If Google sign-in fails, nobody can sign in; `/health` stays public. Recovery: fix the Google client or
  temporarily re-enable `COGNITO` in the app client.

## Risks

| Risk | Mitigation |
|---|---|
| A stranger is added to the wrong group by mistake | Group names are explicit; `list-users` shows the e-mail before assigning |
| Mass sign-ups by strangers raise Cognito cost | Essentials includes 10,000 MAU; the owner monitors the user count (TD-020); WAF or a pre-sign-up allowlist can follow |
| Leaked Google client secret | Rotate it in Google Cloud and GitHub; the secret alone does not grant access to household data |
| HTTP API passes `cognito:groups` as a string `"[a b]"` | The backend accepts both the string and the array form; group names contain no spaces |

## Amendment 2026-10-05: Self-Assignment on First Login (HOTFIX-001)

**Context:** Assigning groups with the CLI after the first login was too much friction. HOTFIX-001 asks that a
new Google user picks "who am I" (Stefan or Julia) in the app. Without a restriction, every Google account
could become Stefan or Julia, which would make the household data public.

**Considered:** (1) each member claimable once, (2) self-assignment pending the owner's approval,
(3) unrestricted as written in the ticket.

**Decision (owner, 2026-10-05):** option 1, **each household member can be claimed by exactly one account**,
and each account claims at most one member.

- `GET /onboarding` (signed in, no household needed) returns the account's member (live from Cognito) and which
  members are still free. `POST /onboarding/assignment { userId }` adds the caller to
  `household:<tenantId>:<userId>` if the account has no member yet and nobody else has that member
  (409 `ALREADY_ASSIGNED` / `MEMBER_TAKEN`). A re-count after adding resolves concurrent claims.
- The frontend refreshes the session after the assignment; the new ID token carries the group, so the rest of
  the authorization model (SECURITY-004, `cognito:groups`) is unchanged.
- The API Lambda gets `AdminAddUserToGroup`, `AdminRemoveUserFromGroup`, `AdminListGroupsForUser` and
  `ListUsersInGroup` on the user pool (TD-023).

**Consequences:** no CLI step for members any more. Once all members are claimed, strangers see
"Kein freier Platz". **Until then, a stranger who knows the URL can claim a free member** (TD-020); the owner
should sign in (and let Julia sign in) right after the deploy and can undo a wrong claim with the CLI (README).
