# OBSERVABILITY-002: Implement Alarms and Alert Routing

## Type

Infrastructure / Observability

---

## Priority

High

---

## Phase

V2

---

## Goal

Be notified automatically when Tenner is broken, before a household member notices.

---

# Background

No alarms exist. Errors in Lambda or DynamoDB are only discovered by users.

CloudWatch alarm actions require a target. Amazon SNS is the standard target but
is not in the architecture's allowed-service list.

---

# Dependencies

```text
OBSERVABILITY-001
```

---

# Scope

## Architecture Decision

ADR: alarm notification target.

```text
SNS email subscription (simplest, free tier: 1,000 emails/month)
SNS → Lambda → Telegram (reuses NOTIFICATION-006)
EventBridge rule on alarm state change → Lambda
```

## Alarms (Terraform)

```text
API 5xx rate > 5% over 5 minutes
Lambda errors > 0 for 2 of 3 periods (per function)
Lambda throttles > 0
DynamoDB system errors > 0
DynamoDB throttled requests > 0
Notifier job failed (no successful run in 2 hours)
Monthly cost anomaly → see OPERATIONS-001
```

Thresholds centralized as Terraform variables.

`treat_missing_data = notBreaching` for low-traffic metrics to avoid false alarms.

## Noise Control

- Alarm on sustained conditions only.
- Each alarm description links to its runbook (OPERATIONS-002).

## Cost

10 standard alarms free; document expected cost.

---

# Deliverables

```text
ADR
Alarm Terraform resources
Notification target
Runbook links
```

---

# Validation

```bash
terraform fmt -check

terraform validate

terraform plan
```

Manually trigger one alarm (e.g. test Lambda error) and confirm delivery.

---

# Acceptance Criteria

- Alarms exist for listed conditions
- Alerts reach the owner
- Each alarm references a runbook
- False positive rate acceptable (verified after one week)

---

# Definition of Done

- Failures are detected proactively
- Infrastructure deploys through GitHub Actions

---

# Out of Scope

- On-call rotation
- Paging services

---

# Implementation Status

Implemented 2026-10-06 (deployed with `OBSERVABILITY_ENABLED`; the owner confirms the SNS e-mail once).

- [x] ADR `docs/decisions/0006-alarm-notifications.md`: SNS topic with e-mail subscription (allowed services and
  roadmap updated)
- [x] Alarms (`terraform/alarms.tf`): API 5xx rate > 5 % over 5 minutes (metric math, missing = not breaching);
  Lambda errors > 0 in 2 of 3 periods and throttles > 0 per function (API, notifier when enabled); DynamoDB system
  errors and throttles across all tables (one alarm each, metric math); notifier without a successful run for
  2 hours (missing = breaching); cost anomalies stay with OPERATIONS-001
- [x] Thresholds centralized in `var.alarm_thresholds`; notifications through SNS `tenner-alarms` to the
  `BUDGET_ALERT_EMAIL` address (OK notifications for the main alarms)
- [x] Each alarm description links to `docs/runbooks/alarms.md#<section>` (new runbook)
- [x] Cost: at most 8 alarms here (free tier: 10)
- [x] Tests passing: Terraform 70 (+2: topic and subscription, 2-of-3, thresholds, runbook links, ≤ 10 alarms,
  notifier alarm only with the notifier)
- [ ] Alerts reach the owner — after deploy and subscription confirmation (manual: trigger one alarm)
- [ ] False-positive rate acceptable — after one week in operation

Decisions and assumptions:

- DynamoDB alarms are aggregated over all tables to stay within the free tier; the dashboard shows per-table detail.
- The SNS topic is not KMS-encrypted (CloudWatch cannot publish to topics with the AWS managed SNS key; messages
  carry no personal data) — ADR 0006.
- OPERATIONS-002 runbooks do not exist yet; `docs/runbooks/alarms.md` covers the alarms and can be merged into
  them later.
