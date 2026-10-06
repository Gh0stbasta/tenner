# Tenner Roadmap

This roadmap was produced by the backlog gap analysis in [META-001](meta-ticket.md).
The full ticket index is in [`backlog/README.md`](backlog/README.md).

> **Status (2026-10-05):** Phase 1 is implemented. Deployed since 2026-10-02: CI/CD, Terraform, backend API
> (TICKET-001 – 020, 023, 024), API throttling (SECURITY-014), the German web app (FRONTEND-001 – 007, 009, UX-005)
> and authentication (SECURITY-001 – 004; Google sign-in FUTURE-011 pulled forward; first-login self-assignment
> HOTFIX-001). Completed on 2026-10-05: SECURITY-005, SECURITY-007, OPERATIONS-001, OPERATIONS-006, FRONTEND-008.
> Manual follow-ups: the throttling burst test and the account-level S3 check (`docs/security.md`), confirming the
> AWS cost alert e-mail. Each ticket file has an "Implementation Status" section. Next: Phase 2.

---

## 1. Gap Analysis

### What existing tickets already define

| Area | Tickets |
|---|---|
| CI/CD, governance, Terraform foundation, remote state | TICKET-001, 001A, 002, 003 |
| API foundation, DynamoDB, Lambda integration | TICKET-005, 006, 007 |
| Backend domain, CRUD, complete, undo, restore, dashboard API | TICKET-008 – 016 |
| Frontend foundation, dashboard, management, create/edit, quick add, completion UX, settings | FRONTEND-001 – 008 |

### Missing MVP items

The MVP definition in `architecture.md` cannot be met without these tickets:

| Gap | Why it matters | Ticket |
|---|---|---|
| Frontend hosting (S3 + CloudFront) | No ticket deploys the frontend. The MVP says all infrastructure is deployed with Terraform | TICKET-017, 018 |
| `GET /tenners/{id}` | It is listed in the architecture but no ticket implements it | TICKET-019 |
| Reading completion history | History is write-only, so Recent Activity and the detail views have no data source | TICKET-020, FRONTEND-009 |
| Authentication | Once hosted publicly, the API can be read and written by anyone | SECURITY-001 – 004 |
| Baseline hardening, dependency scanning, cost budget, smoke tests | Needed to run safely in production at near-zero cost | SECURITY-005, 007, OPERATIONS-001, 006 |
| Global error handling | Users would see blank screens or silent failures | UX-005 |

### Capabilities still missing (V2 and later)

Analytics (the `/analytics` placeholder and endpoint), notifications, calendar-based
recurrence, snooze/skip/pause, timezone-correct dates, household member and category
management, PWA/mobile, integrations, observability, operations, data portability, and AI.

### Domains added

`analytics`, `notifications`, `scheduling`, `productivity`, `household`,
`household-admin`, `ux`, `security`, `observability`, `operations`,
`data-management`, `mobile`, `integrations`, `ai`, `future`.

---

## 2. Phases

### Phase 1 — MVP Completion

Recommended order:

```text
TICKET-017  Frontend hosting
TICKET-018  Frontend deployment
SECURITY-014  API cost cap (before first deploy)
SECURITY-001  Authentication ADR
SECURITY-002  Cognito + JWT authorizer
SECURITY-003  Frontend login
SECURITY-004  Identity-based authorization
TICKET-019  Get Tenner API
TICKET-020  Completion history API
FRONTEND-009  Tenner detail & history
UX-005  Global error handling
SECURITY-005  AWS hardening
SECURITY-007  Dependency scanning
OPERATIONS-001  Cost budgets
OPERATIONS-006  Smoke tests
```

**Exit criteria:** the MVP definition in `architecture.md` is met, and the deployed app
can be used only by authenticated household members.

### Phase 2 — V2 (Daily Usefulness)

Grouped by theme. The order inside each group matters; the groups can be done in parallel.

```text
Correct scheduling:   SCHEDULING-008 → 001 → 003 → 002 → 004 → 005
Household setup:      HOUSEHOLD-ADMIN-001 → 002 → 003 → 004; HOUSEHOLD-002 → 001 → 004
Reminders:            SECURITY-006 → NOTIFICATION-001 → 002 → 003 → 006 → 004 → (005, 007, 008)
Mobile:               MOBILE-001 → 002 → 005 → 006 → 003
Analytics:            ANALYTICS-001 → 002 → 003 → 004 → 006 → 007 → 008 → 005 → 009
Productivity:         PRODUCTIVITY-001 → 002 → 004 → 003 → 005
Running it safely:    OBSERVABILITY-001 → 002 → 003 → 006 → 005; OPERATIONS-002 → 003 → 004 → 005 → 007
Data:                 DATA-006 → 001 → 002 → 003 → 004 → 007
Platform:             TICKET-021, TICKET-022, SECURITY-008 – 013
Experience:           UX-001, UX-003, UX-004, UX-007, UX-002, UX-006, FRONTEND-010
Integrations:         INTEGRATION-001 → 006 → 002 → 003
AI (opt-in):          AI-001 → 002 → 003
Alexa & Echo Show:    ALEXA-001 → 002 → 003 → 004 → 006 → 005; SECURITY-006 + NOTIFICATION-001 → ALEXA-007 → 008; ALEXA-009 alongside
```

### Phase 3 — Long-Term

```text
SCHEDULING-006, 007
HOUSEHOLD-003, HOUSEHOLD-ADMIN-005
ANALYTICS-010 (only if measurements require it)
OBSERVABILITY-004
MOBILE-004
DATA-005
INTEGRATION-004, 005, 007, 008, 009
AI-004 – 009
FUTURE-001 – 011 (mostly evaluations that end in a go/no-go decision)
```

---

## 3. Cross-Cutting Decisions Required

Several tickets need AWS services that are **not** on the allowed-services list in
`architecture.md`. Each needs an ADR in `docs/decisions/` before it is implemented:

| Service | Needed by |
|---|---|
| SSM Parameter Store / Secrets Manager | SECURITY-006 (accepted: [ADR 0004](decisions/0004-secrets-management.md), Parameter Store) |
| SES | NOTIFICATION-005 |
| SNS (alarm actions) | OBSERVABILITY-002 (accepted: [ADR 0006](decisions/0006-alarm-notifications.md)) |
| Route53 / ACM | TICKET-022 |
| X-Ray | OBSERVABILITY-004 |
| CloudTrail trail | SECURITY-012 |
| Bedrock or an external LLM API | AI-001 |
| Alexa Skills Kit (custom skill, APL, Reminders, Proactive Events, Data Store), skill Lambda in eu-west-1 | ALEXA-001 (accepted: [ADR 0005](decisions/0005-alexa-platform.md)) |
| AWS Budgets / Cost Anomaly Detection | OPERATIONS-001 (billing features, no runtime cost) |
