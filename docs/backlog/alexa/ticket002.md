# ALEXA-002: Implement Account Linking and Household Authorization

## Type

Security / Platform

---

## Priority

High

---

## Phase

V2

---

## Goal

Link the household's Alexa account to Tenner so that the skill acts as a household member with exactly the rights
that member has in the web app, and recognize which household member is speaking.

After this ticket the skill can call the Tenner API on behalf of a member, and every request knows the household
and the acting member.

---

# Background

Tenner signs users in with Google through Cognito (FUTURE-011, ADR 0002); household membership is the Cognito
group `household:<tenantId>:<userId>`. The API's JWT authorizer currently accepts only the web client's **ID token**
(`terraform/auth.tf`, audience = web client).

Alexa account linking (OAuth 2.0 authorization code grant, recommended by Amazon because it yields refresh tokens)
stores the tokens of the linked account. Alexa sends the **access token** in every request
(`context.System.user.accessToken`). Cognito access tokens contain `cognito:groups` and `client_id`, but `username`
instead of `cognito:username`, and no `aud`.

With voice profiles, Alexa identifies the speaker: requests include `context.System.person.personId` when the skill
has the permission `alexa::person_id:read` and the speaker enabled "Personalize skills". A voice profile can also
have its own linked account (`context.System.person.accessToken`).

---

# Dependencies

```text
ALEXA-001
SECURITY-002, SECURITY-004 (Cognito, identity from claims)
FUTURE-011 (Google sign-in)
HOUSEHOLD-ADMIN-001 (members)
```

---

# Scope

## Cognito (Terraform)

- New app client `tenner-alexa`: authorization code grant, **with client secret** (Alexa keeps it server-side),
  scopes `openid` and a custom scope (e.g. `tenner/household`) via a resource server, identity provider Google,
  callback URLs = the three Alexa redirect URLs from the developer console (variable list, no hardcoding).
- Token lifetimes for this client: access token 1 h, refresh token up to 10 years (Cognito maximum: 3,650 days),
  so the household does not have to relink.
- JWT authorizer: add the Alexa client ID to `audience` (HTTP API JWT authorizers accept `client_id` when `aud` is
  absent — verify on implementation).
- The client secret is configured once in the Alexa developer console (Account Linking page); it is read from the
  Terraform output by the owner, never committed. Prefer SSM Parameter Store (SECURITY-006) as the hand-over place.

## Backend

- `identityFromEvent` accepts access tokens: the household group comes from `cognito:groups` exactly as today;
  `principalFromEvent` reads `cognito:username` **or** `username`. Add tests for both token types.
- No new endpoint is needed: the skill uses the existing API with `Authorization: Bearer <access token>`.
- Audit: write requests from Alexa log `client: "alexa"` (derived from `client_id`), so history shows the channel.

## Skill (alexa/)

- Account linking configured in the skill manifest/console: authorization URL and token URL of the Cognito managed
  login domain, client ID/secret, scopes, "Auth Code Grant", credentials in the HTTP Basic header.
- A request interceptor resolves the linked token: `person.accessToken` (voice profile linked) first, else
  `user.accessToken`. Without a token: speak „Bitte verknüpfe Tenner in der Alexa-App.“ and send a
  `LinkAccount` card.
- The API client maps responses: 401 → ask to relink; 403 (no household group) → „Dieses Konto gehört zu keinem
  Tenner-Haushalt.“; 5xx/timeouts → a friendly retry message within 7 s.

## Speaker → Member Mapping

- Permission `alexa::person_id:read` in the manifest.
- When the speaker is recognized but the token belongs to the account (not the person), ask once
  „Wer spricht gerade?“ with the active members as choices, and store `personId → userId` per tenant
  (new attribute `alexaSpeakers` on the household item, optimistic locking like `members`).
- The acting member is used for `completedBy` (ALEXA-004) and for "my" Tenners (ALEXA-003). `recordedBy` stays
  the linked account's member (SECURITY-004 semantics).
- Unrecognized speaker: household-wide answers; actions ask „Für wen?“.

## Settings (web app)

- Settings → "Alexa": shows linked speakers (member names) and a "Zuordnung entfernen" action per speaker
  (`DELETE /household/alexa-speakers/{personId}`, new route). No Alexa tokens are shown or stored by Tenner.

---

# Architecture Considerations

- **One identity model:** the skill gets no special backend access; it is just another OAuth client of the same
  user pool, limited to the same household group.
- **Least privilege:** the custom scope can later restrict which routes the Alexa client may call (e.g. no member
  administration) — evaluate in this ticket, implement if the HTTP API supports scope checks per route
  (authorization scopes on routes).
- **Privacy:** `personId` contains no personal data; it is stored only as a mapping key and deleted with the
  mapping.
- **Failure modes:** expired refresh token (user unlinked or 10 years passed) → relink prompt; removed household
  member → 403 → message above.

---

# Deliverables

```text
Terraform: Cognito app client + resource server, authorizer audience, outputs, tests
Backend: access-token support in identity, speaker mapping storage and route, tests
Skill: account-linking interceptor, API client with error mapping, speaker identification flow, tests
Web: Settings → Alexa (speaker mappings)
Docs: README (linking steps), security.md (new client, token lifetimes), architecture.md
```

---

# Testing Requirements

```text
Access Token Accepted By Identity (groups claim)
Access Token Without Household Group → 403
Missing Token → Link Account Prompt
Person Token Preferred Over Account Token
Speaker Mapping Create / Use / Delete
401 → Relink Prompt
API Timeout → Friendly Message Within 7 s
Terraform: Alexa Client Settings, Authorizer Audience
```

---

# Validation

```bash
terraform fmt -check && terraform test
npm run lint && npm run build && npm test   # backend/, alexa/, frontend/
```

Manual: link in the Alexa app (Google sign-in), then „Alexa, öffne Tenner“ greets the recognized member by name.

---

# Acceptance Criteria

- The household's Alexa account can be linked with Google sign-in through Cognito
- The skill calls the API as a household member; non-members are rejected
- Recognized speakers are mapped to members; mappings can be removed in the settings
- No Alexa or Cognito tokens are stored by Tenner or logged
- Tests passing

---

# Definition of Done

- Every later Alexa ticket can rely on "who is the household, who is speaking"
- Feature deploys through GitHub Actions

---

# Out of Scope

- Multiple households per Alexa account
- Voice PIN / voice-code confirmation for actions
- Linking for other voice assistants
