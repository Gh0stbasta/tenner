# OPERATIONS-001: Implement Cost Monitoring and Budgets

## Type

Infrastructure / Operations

---

## Priority

High

---

## Phase

MVP

---

## Goal

Ensure Tenner stays within its near-zero cost target and that unexpected cost
increases are detected within a day.

---

# Background

The architecture requires that Tenner "comfortably run inside AWS free tier or
near-zero monthly cost". There is no mechanism to detect violations, e.g. a
runaway Lambda loop, abusive API traffic or an expensive misconfiguration.

---

# Dependencies

```text
TICKET-001A (tags for cost allocation)
```

---

# Scope

## AWS Budgets (Terraform)

```text
Monthly cost budget: 5 USD (variable)
Alerts: 50% actual, 80% actual, 100% forecasted
Filter: cost allocation tag Application = Tenner (if tag is activated)
```

Budgets are a billing feature; document required account-level activation of the
`Application` cost allocation tag (manual billing console step if not Terraform-manageable).

## Cost Anomaly Detection

Create a cost anomaly monitor and daily subscription (free service).

## Notification Target

Email (owner) as variable; no hardcoded address.

## Documentation

Expected monthly cost table per service in `docs/architecture.md`.

---

# Deliverables

```text
Budget Terraform resources
Anomaly monitor
Cost table documentation
```

---

# Validation

```bash
terraform fmt -check

terraform validate

terraform plan
```

---

# Acceptance Criteria

- [x] Budget with thresholds exists (Terraform; created on the next deploy)
- [x] Anomaly detection enabled (Terraform; created on the next deploy)
- [ ] Owner receives alerts — after the deploy: confirm the AWS subscription e-mail
- [x] Expected cost documented

---

# Definition of Done

- Cost overruns are detected early

---

# Out of Scope

- Automatic shutdown on budget breach

---

# Implementation Status

Implemented 2026-10-05.

- ADR 0003: AWS Budgets and Cost Anomaly Detection added to the allowed services (billing features, no runtime).
- `terraform/costs.tf`: `aws_budgets_budget.monthly` (5 USD default, 50 %/80 % actual, 100 % forecasted),
  `aws_ce_anomaly_monitor.services` (AWS services; skipped when `cost_anomaly_monitor_arn` reuses an existing
  monitor), `aws_ce_anomaly_subscription.daily` (≥ 1 USD impact).
- Variables: `budget_alert_email` (sensitive, required, from secret `BUDGET_ALERT_EMAIL`), `monthly_budget_usd`,
  `anomaly_alert_threshold_usd`, `budget_filter_by_application_tag` (default false: whole account),
  `cost_anomaly_monitor_arn` (from variable `COST_ANOMALY_MONITOR_ARN`).
- Workflows pass the secret and the optional ARN to `terraform plan`.
- Tests: `terraform/tests/costs.tftest.hcl` (6 runs: thresholds, recipient, default scope, tag filter, anomaly
  subscription, monitor reuse, required e-mail, invalid budget). 51 Terraform tests pass. The tag filter test
  found an escaping bug (`$${…}`) before it shipped.
- Docs: README "Cost Monitoring" (secret, deploy role permissions, existing monitor, tag activation),
  architecture (allowed services, expected monthly cost table).

Deviation: the budget covers the whole account by default. The tag filter only works after activating the cost
allocation tag in the billing console, and a filter on an inactive tag would silently report 0 USD.

Before the merge (owner): set `BUDGET_ALERT_EMAIL`, extend the deploy role, check for an existing anomaly monitor.
