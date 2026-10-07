# ALEXA-009: Implement Alexa Operations and Monitoring

## Type

Operations

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Run the Alexa platform like the rest of Tenner: visible errors, alarms on failures, an automated health check
after every deploy, usage analytics and runbooks for the typical problems (relinking, expired beta, broken widget).

---

# Background

The skill Lambda runs in eu-west-1 (ALEXA-001), the API in eu-central-1, pushes and notifications in the notifier
(ALEXA-007, ALEXA-008). Tenner already has smoke tests after deploy (OPERATIONS-006), cost budgets
(OPERATIONS-001) and planned alarms (OBSERVABILITY-002). Alexa provides its own skill metrics in the developer
console (sessions, intents, errors) and a simulation API for automated dialog tests (verify current SMAPI name).

---

# Dependencies

```text
ALEXA-001 – ALEXA-008
OBSERVABILITY-001, OBSERVABILITY-002 (dashboard, alarms), OPERATIONS-006 (smoke tests)
```

---

# Scope

## Logging

- Structured JSON logs in the skill Lambda (same logger conventions as `backend/`): `requestId`, intent, locale,
  device class (APL viewport profile), duration, API status, outcome (`ANSWERED`, `ASKED`, `COMPLETED`,
  `LINK_REQUIRED`, `ERROR`). Never log tokens, `personId`, Amazon user IDs or titles beyond IDs.
- Correlation: forward `x-correlation-id = Alexa requestId` to the Tenner API so one voice request is traceable.

## Metrics and Alarms

- CloudWatch metrics (embedded metric format): requests per intent, errors, p95 duration, API latency, Data Store
  push failures, notification failures.
- Alarms (via OBSERVABILITY-002 routing): skill Lambda errors > 5 % in 15 min; p95 duration > 5 s (8 s Alexa
  limit); Data Store push failures; Proactive Events/Reminders errors.
- Add an "Alexa" section to the CloudWatch dashboard (OBSERVABILITY-001).

## Health Check (after deploy)

- CI step after skill deployment: run a simulated dialog against the development stage (SMAPI skill simulation /
  `ask dialog --replay`): „öffne tenner“ → expects the welcome text; „was ist heute fällig“ with a test account →
  expects a well-formed answer. Fail the pipeline on errors.
- Interaction model validation and utterance conflict check in PRs.

## Analytics

- Weekly usage from the developer console (sessions, top intents, unhandled utterances) plus own metrics; review
  unhandled utterances monthly and add samples (documented routine).
- Optional: count voice completions in Tenner analytics by channel (from `client: "alexa"` in the audit, ALEXA-002).

## Runbooks (`docs/runbooks/alexa.md`)

```text
Account linking broken / "Bitte verknüpfe Tenner"
Speaker not recognized / wrong member
Beta test expired (90 days) for an invited account → start a new beta or use the development account
Widget not updating (Data Store push failures, token, widget reinstall)
Notifications not arriving (permissions in the Alexa app, schema rejections)
Skill Lambda errors / timeouts
Alexa+ behaves differently than classic Alexa
Rollback: redeploy previous skill package version, previous Lambda version
```

## Cost

- Add the eu-west-1 Lambda and logs to the cost overview; budgets already cover the account.

---

# Architecture Considerations

- **Privacy:** Alexa data minimization — logs and metrics carry no personal identifiers.
- **Two regions:** dashboards and alarms span eu-west-1 (skill) and eu-central-1 (API, notifier).
- **Automation over console:** health check and model validation run in CI; console analytics are a manual
  review.

---

# Deliverables

```text
Skill logging + metrics, correlation ID forwarding
Alarms and dashboard section (Terraform)
CI health check (simulated dialog) and model validation
docs/runbooks/alexa.md
Cost and operations documentation updates
```

---

# Testing Requirements

```text
Log Fields Present, No Tokens Or Person IDs
Metric Emission Per Outcome
Correlation ID Forwarded
Terraform: Alarms And Dashboard
CI Health Check Fails On Wrong Response
```

---

# Validation

```bash
terraform fmt -check && terraform test
npm run lint && npm run build && npm test   # alexa/
```

Manual: break the API URL in a test deploy → alarm fires and the health check fails.

---

# Acceptance Criteria

- Errors, latency and push/notification failures are visible and alarmed
- Every deploy runs an automated Alexa health check
- Runbooks cover linking, recognition, beta expiry, widget, notifications and rollback
- Tests passing

---

# Definition of Done

- Alexa problems are noticed before the household reports them
- Feature deploys through GitHub Actions

---

# Out of Scope

- Third-party APM tools
- Publishing metrics to the public skill store

---

# Implementation Status

Implemented 2026-10-06 (alarms and health check active once the owner enables monitoring and the skill).

- [x] Structured skill logs (`alexa/src/requestLog.ts`): one `skill_request` line per request with request type,
  intent, locale, device class (viewport profile or VOICE), duration, API calls/latency/status and outcome
  (`ANSWERED`, `ASKED`, `COMPLETED`, `LINK_REQUIRED`, `ERROR`); no tokens, person/account IDs or titles (tested)
- [x] Correlation: `x-correlation-id` = Alexa request ID on every Tenner API call (since ALEXA-002)
- [x] Metrics (namespace `Tenner/Alexa`) from log lines with metric filters: skill requests and errors, widget push
  failures, Alexa notification failures; p95 duration from the Lambda metric
- [x] Alarms: skill error rate > 5 % in 15 minutes and p95 duration > 5 s (eu-west-1, own SNS topic, e-mail),
  widget/notification failures (eu-central-1, existing topic); dashboard "Alexa" section incl. requests per intent
  and outcome (Logs Insights)
- [x] Health check after every skill deploy: `scripts/alexa-health-check.sh` (SMAPI simulation „öffne tenner“,
  answer must name Tenner) with the tested checker `scripts/check_alexa_simulation.py`; fails the deployment
- [x] PR checks: interaction model JSON, unique samples and utterance conflicts after slot normalization, declared
  slot types (alexa tests)
- [x] Runbook `docs/runbooks/alexa.md`: linking, speaker recognition, beta expiry, widget, notifications, Lambda
  errors/timeouts, Alexa+, rollback; cost in architecture and README
- [x] Tests passing: alexa 146 (+9), Terraform 74 (+2), scripts 40 (+4); lint and builds clean
- [ ] Manual: break the API URL in a test deploy → alarm fires and the health check fails (owner, after activation)

Decisions and assumptions:

- Metric filters on event names instead of the embedded metric format: the Lambdas use the JSON log format, and
  plain term filters work regardless of how the runtime wraps the message.
- The second-scenario health check („was ist heute fällig“ with a test account) is not included: the simulation
  runs as the developer account, whose link state is not controlled by CI; the welcome/link answer proves the
  skill, endpoint and Lambda work.
- Optional analytics by channel (`client: "alexa"`) stays a Logs Insights query on the API logs.
- `ask smapi simulate-skill` usage is unverified like the deploy script (TD-034).
