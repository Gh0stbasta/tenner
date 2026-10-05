# ADR 0003: Cost Monitoring with AWS Budgets and Cost Anomaly Detection

- **Status:** Accepted (2026-10-05)
- **Ticket:** OPERATIONS-001
- **Deciders:** repository owner (Stefan), by asking to complete all Phase 1 tickets on 2026-10-05

## Context

`architecture.md` requires near-zero monthly cost, but nothing detects a runaway Lambda loop, abusive traffic
that stays below the throttle, or an expensive misconfiguration. The allowed-services list does not contain
billing features; the roadmap marks AWS Budgets and Cost Anomaly Detection as needing an ADR.

## Considered Options

| Option | Cost | Assessment |
|---|---|---|
| A: AWS Budgets + Cost Anomaly Detection (Terraform) | Budgets: first two budgets free; anomaly detection free | Billing features, no runtime component, e-mail alerts without SNS |
| B: CloudWatch billing alarm (`EstimatedCharges`) | Free tier covers a few alarms | Needs us-east-1 and SNS for e-mail (SNS is not allowed yet) |
| C: Manual checks in the billing console | Free | Detects nothing automatically |

## Decision

**Option A.** Add "billing features (AWS Budgets, Cost Anomaly Detection)" to the allowed services. They do not
run code or store application data.

| Topic | Decision |
|---|---|
| Budget | 5 USD per month (`monthly_budget_usd`), alerts at 50 % and 80 % actual and 100 % forecasted spend |
| Scope | Whole account by default; optional filter on the `Application = Tenner` cost allocation tag after the tag is activated |
| Anomalies | AWS-services monitor (or an existing one, `cost_anomaly_monitor_arn`), daily e-mail summary for anomalies ≥ 1 USD |
| Recipient | `budget_alert_email` from the GitHub secret `BUDGET_ALERT_EMAIL`; sensitive variable, never committed |

## Consequences

- The deploy role needs `budgets:*` on the Tenner budget and Cost Explorer anomaly permissions (README).
- The e-mail address is stored in the Terraform state (encrypted bucket) and in GitHub secrets.
- Budget data refreshes a few times per day; together with the daily anomaly summary, a cost spike is reported
  within about a day. Throttling (SECURITY-014) caps the worst case at about 2–3 USD per day, so the 50 % alert
  fires within one to two days of sustained abuse.
- Only one AWS-services anomaly monitor is allowed per account; an account that already has one must reuse it.
