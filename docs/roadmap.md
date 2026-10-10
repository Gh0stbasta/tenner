# Tenner Roadmap

> **Release 2.0.0 — Family Meal Planning (2026-10-10):** 25 of 28 FOOD tickets done; overview, follow-up work
> (FOOD-020 AI evaluation, recheck 2026-12-07; FOOD-024 image decision) and the ticket index in
> [`release-2.0/README.md`](release-2.0/README.md). The rest of this file is the record of release 1.0.

This roadmap was produced by the backlog gap analysis in [META-001](release-1.0/meta-ticket.md).
The full ticket index is in [`release-1.0/backlog/README.md`](release-1.0/backlog/README.md).

> **Status (2026-10-07): closed with release 1.0.** Phase 1 (MVP) and the Phase 2 groups the owner wanted are
> implemented and live. On 2026-10-07 the owner removed every remaining open ticket (BACKLOG-003) and moved the
> project to maintenance and user recommendations. Nothing below is planned any more; the phases are kept as the
> record of how release 1.0 was built. Release overview: [`release-1.0/README.md`](release-1.0/README.md).
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

### Phase 2 — V2 (Daily Usefulness), as delivered

Built in this order inside each group:

```text
Correct scheduling:   SCHEDULING-008 → 001 → 003 → 002 → 004 → 005
Household setup:      HOUSEHOLD-ADMIN-001 → 002 → 003 → 004 → 006; HOUSEHOLD-002 → 001 → 004
Reminders:            SECURITY-006 → NOTIFICATION-001 → 002 → 003 → 004 → 009 → 010 → 011
Mobile:               MOBILE-001 → 002 → 005 → 003 → 004
Analytics:            ANALYTICS-001 → 002 → 003 → 004 → 006 → 007 → 008 → 005 → 009
Running it safely:    OBSERVABILITY-001 → 002
Data:                 DATA-008 (household task catalog)
Alexa & Echo Show:    ALEXA-001 → 002 → 003 → 004 → 006 → 005 → 007 → 008 → 009 → 010
```

Removed on 2026-10-06 by the owner (BACKLOG-001, BACKLOG-002): e-mail and Telegram reminders, the Telegram bot and
"I have X minutes" suggestions. Push was dropped and re-added on 2026-10-07 (NOTIFICATION-009 – 011).

Removed on 2026-10-07 by the owner (BACKLOG-003): all remaining Phase 2 groups (weekly summary, productivity,
operations and observability extensions, data export/import, environments and custom domain, security scanning,
UX extensions, integrations, AI) and all of Phase 3. See
[`release-1.0/backlog/README.md`](release-1.0/backlog/README.md#removed-tickets).

### Phase 3 — Long-Term

Not pursued; every Phase 3 ticket was removed by BACKLOG-003.

---

## 3. Cross-Cutting Decisions Required

Several tickets needed AWS services that are **not** on the allowed-services list in
`architecture.md`. Each needed an ADR in `docs/decisions/` before it was implemented. Rows whose tickets were
removed (BACKLOG-003) are kept for reference; a maintenance ticket that needs one of these services still needs
the ADR first:

| Service | Needed by |
|---|---|
| SSM Parameter Store / Secrets Manager | SECURITY-006 (accepted: [ADR 0004](decisions/0004-secrets-management.md), Parameter Store) |
| SNS (alarm actions) | OBSERVABILITY-002 (accepted: [ADR 0006](decisions/0006-alarm-notifications.md)) |
| Route53 / ACM | TICKET-022 (removed) |
| X-Ray | OBSERVABILITY-004 (removed) |
| CloudTrail trail | SECURITY-012 (removed) |
| Bedrock or an external LLM API | AI-001 (removed) |
| Alexa Skills Kit (custom skill, APL, Reminders, Proactive Events, Data Store), skill Lambda in eu-west-1 | ALEXA-001 (accepted: [ADR 0005](decisions/0005-alexa-platform.md)) |
| AWS Budgets / Cost Anomaly Detection | OPERATIONS-001 (billing features, no runtime cost) |
