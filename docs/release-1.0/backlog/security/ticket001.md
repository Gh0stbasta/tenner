# SECURITY-001: Decide Authentication Approach (ADR)

## Type

Architecture Decision

---

## Priority

Critical

---

## Phase

MVP

---

## Goal

Make and document the authentication decision that the architecture explicitly deferred:

```text
Single Shared Household Login
or
Basic Cognito User Pool
```

---

# Background

`docs/architecture.md` states:

```text
Authentication is intentionally simplified.
Final decision deferred.
Authentication must not delay MVP delivery.
```

Every implemented ticket lists Authentication as out of scope. As soon as the
frontend is publicly hosted (TICKET-017) the API is reachable from the internet
without any protection: anyone who knows the URL can read, modify or delete all data.

This is the highest-risk gap in the current backlog.

---

# Dependencies

```text
TICKET-005
TICKET-017
```

---

# Scope

## Options To Evaluate

```text
A. Cognito User Pool, one account per household member, JWT authorizer on HTTP API
B. Cognito User Pool, single shared household account
C. Shared secret / API key header (no user identity)
D. CloudFront + Lambda@Edge basic auth (rejected upfront: Lambda@Edge complexity)
```

## Evaluation Criteria

```text
Security (identity, revocation, brute-force protection)
MVP effort
Cost (Cognito free tier: 10,000 MAU on Lite tier — verify current pricing)
Fit with allowed services (Cognito is allowed)
Migration path to individual accounts, MFA, social login, multi-household
Operational effort (password reset, account creation)
```

## Expected Outcome

Option A is expected to be the best trade-off: it provides real user identity
(enabling `completedBy` from the token instead of the request body), stays within
allowed services and free tier, and avoids a later migration.

## ADR

Create:

```text
docs/decisions/0001-authentication.md
```

with Context, Considered Options, Decision, Consequences, Risks.

Update the Security section of `docs/architecture.md` accordingly.

---

# Deliverables

```text
ADR document
Updated architecture.md security section
Follow-up tickets confirmed or adjusted (SECURITY-002, 003, 004)
```

---

# Validation

Peer review of the ADR by the repository owner.

---

# Acceptance Criteria

- All options evaluated against the criteria
- Decision documented as ADR
- Architecture documentation updated
- Follow-up tickets aligned with the decision

---

# Definition of Done

- Authentication approach is decided and documented
- No implementation ambiguity remains for SECURITY-002 to 004

---

# Out of Scope

- Implementation (SECURITY-002, 003)
- MFA (SECURITY-011)
- Social login (FUTURE-011)

---

# Implementation Status

Done 2026-10-02.

- [x] All options evaluated against the criteria (`docs/decisions/0001-authentication.md`)
- [x] Decision documented as ADR: Option A, Cognito User Pool with one account per household member
- [x] Architecture documentation updated (`docs/architecture.md` → Security)
- [x] Follow-up tickets aligned: SECURITY-002 references the ADR; SECURITY-003 sends the ID token
  (custom attributes are not in Cognito access tokens without a pre-token-generation Lambda)

Owner decisions (2026-10-02): one account each for Stefan and Julia; tokens in `localStorage` for 30 days.
Validation: owner review of the ADR in the pull request.

