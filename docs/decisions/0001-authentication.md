# ADR 0001: Authentication with a Cognito User Pool and One Account per Household Member

- **Status:** Accepted (2026-10-02); sign-up, login UI and identity attributes amended by
  [ADR 0002](0002-google-sign-in.md) (Google sign-in, household groups)
- **Ticket:** SECURITY-001
- **Deciders:** repository owner (Stefan)

## Context

`architecture.md` deferred the authentication decision ("Single Shared Household Login or Basic Cognito
User Pool") so it would not delay the MVP. Since TICKET-017/018 and FRONTEND-001 – 009 the web app and the
API are deployed and publicly reachable. Anyone who knows the API URL can read, change or archive all
household data (TD-003). The current user is self-declared through an "Ich bin" selector (TD-018).

Requirements:

- Only household members (today Stefan and Julia) can use the app and the API.
- The backend must know who acts (`completedBy`, audit fields) without trusting the request body.
- Serverless, AWS-native, within the allowed services, near-zero cost.
- Low operational effort: no self-registration, accounts are created rarely.
- A path to MFA (SECURITY-011), social login (FUTURE-011) and more households (FUTURE-001).

## Considered Options

| Option | Description |
|---|---|
| A | Cognito User Pool, **one account per household member**, JWT authorizer on the HTTP API |
| B | Cognito User Pool, one shared household account |
| C | Shared secret / API key header, no user identity |
| D | CloudFront + Lambda@Edge basic auth |

### Evaluation

| Criterion | A | B | C | D |
|---|---|---|---|---|
| Identity per person | ✅ from the token | ❌ shared | ❌ none | ❌ shared |
| Revocation | ✅ per user (disable user, revoke tokens) | ⚠️ everyone at once | ❌ rotate secret everywhere | ⚠️ everyone at once |
| Brute-force protection | ✅ Cognito lockout, password policy | ✅ same | ❌ none | ❌ none |
| Secret in the browser | ✅ none (public client, PKCE) | ✅ none | ❌ key shipped to every client | ⚠️ password in browser |
| MVP effort | medium | medium | low | high (Lambda@Edge in us-east-1) |
| Cost | ✅ free tier (Essentials: 10,000 MAU) | ✅ free | ✅ free | ⚠️ Lambda@Edge requests |
| Allowed services | ✅ Cognito | ✅ Cognito | ✅ | ❌ Lambda@Edge not planned |
| Migration path (MFA, social, households) | ✅ direct | ❌ needs migration to A | ❌ rewrite | ❌ rewrite |
| Operations | create two users once (CLI) | create one user | distribute and rotate a secret | maintain edge function |

## Decision

**Option A.** One Cognito User Pool with one account per household member (decision by the owner on
2026-10-02, together with the session duration below).

| Topic | Decision |
|---|---|
| Pool tier | `ESSENTIALS` (free up to 10,000 MAU, includes managed login) |
| Sign-up | Disabled. Accounts are created by an administrator with the AWS CLI |
| Username | E-mail address; recovery via verified e-mail |
| Password policy | At least 12 characters, upper and lower case, numbers |
| Identity attributes | `custom:tenantId` (immutable, `default` for the existing household) and `custom:userId` (`STEFAN`, `JULIA`); writable only by administrators, not by the app client |
| Login UI | Cognito managed login (prefix domain, no custom domain needed), German via `lang=de` |
| App client | Public SPA client, no secret, Authorization Code flow with PKCE, scopes `openid email` |
| Token lifetimes | ID/access token 1 hour, refresh token 30 days, token revocation enabled |
| API protection | API Gateway JWT authorizer (issuer = user pool, audience = app client) on all routes except `GET /health` |
| Token sent to the API | The **ID token** (see below) |
| Session in the browser | Tokens in `localStorage` for 30 days (owner decision 2026-10-02): log in once per device |
| Frontend library | `oidc-client-ts` + `react-oidc-context` (small, standards-based; AWS Amplify would add a much larger dependency for the same flow) |
| Backend | Tenant and acting user come only from verified JWT claims (SECURITY-004); no fallback tenant in request paths |

### Why the ID token

Cognito puts custom attributes (`custom:tenantId`, `custom:userId`) into the ID token only. Adding them to
the access token needs a pre-token-generation Lambda trigger. The HTTP API JWT authorizer accepts the ID
token when its audience is the app client ID. Using the ID token keeps the MVP without an extra Lambda.
The trade-off: the ID token is an identity assertion for this one client; it is not shared with other APIs.
If more APIs or third-party clients appear, switch to access tokens with a pre-token-generation trigger.

## Consequences

- The API returns `401` without a valid token; only `/health` stays public.
- The app redirects to the Cognito login page; after login it works as before.
- `completedBy`, `revertedBy` and `restoredBy` default to the logged-in user; covering for someone else stays
  possible and is recorded as `recordedBy` (SECURITY-004).
- The "Ich bin" selector is removed; the current user is shown read-only (TD-018 resolved).
- Two accounts must be created once after the deployment (superseded by ADR 0002: Google sign-in plus a
  household group per member).
- `GithubActionsDeployRole` needs Cognito permissions (`cognito-idp:*` on the pool, or a scoped list).
- The CloudFront CSP must allow `connect-src` to the Cognito endpoints.

## Risks

| Risk | Mitigation |
|---|---|
| Tokens in `localStorage` can be read by injected scripts (XSS) | Strict CSP (`script-src 'self'`), no third-party scripts, React escaping; tokens expire after 1 hour, refresh token can be revoked per user |
| Lockout of the household after a broken deploy | `/health` stays public; rollback by reverting the merge; users can be reset with the CLI |
| Cognito pricing changes | Essentials free tier covers the household many times over; reviewed with OPERATIONS-001 budgets |
| Custom attribute schema changes force a new user pool | Schema is defined once here; pool has deletion protection |
| No threat protection (Plus tier) | Cognito's built-in lockout and the password policy apply; revisit with SECURITY-011 (MFA) |

## Follow-Up Tickets

- **SECURITY-002:** User pool, app client, managed login domain, JWT authorizer (as decided above).
- **SECURITY-003:** Login with `react-oidc-context`, ID token on API requests, `localStorage` session,
  logout, current user from the token. FRONTEND-008 (settings) is not done yet; the header selector is
  replaced by a read-only user display.
- **SECURITY-004:** Request context from claims, `recordedBy`, audit fields `createdBy`/`updatedBy`.
