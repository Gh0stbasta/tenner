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

- Budget with thresholds exists
- Anomaly detection enabled
- Owner receives alerts
- Expected cost documented

---

# Definition of Done

- Cost overruns are detected early

---

# Out of Scope

- Automatic shutdown on budget breach
