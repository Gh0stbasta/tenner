# OBSERVABILITY-001: Create CloudWatch Operational Dashboard

## Type

Infrastructure / Observability

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Provide one CloudWatch dashboard showing the health of Tenner at a glance.

---

# Background

Several tickets (TICKET-013, 014, 016) explicitly deferred dashboards and alarms.
Logs and metrics exist but are not visualized.

---

# Dependencies

```text
TICKET-005
TICKET-006
TICKET-017
```

---

# Scope

## Dashboard (Terraform)

Name:

```text
tenner-<environment>
```

Widgets:

```text
API Gateway:  requests, 4xx, 5xx, latency p50/p95
Lambda:       invocations, errors, duration p95, throttles, concurrent executions (per function)
DynamoDB:     consumed RCU/WCU, throttled requests, system errors (per table)
CloudFront:   requests, 4xx/5xx error rate (us-east-1 metrics)
Notifier:     invocations, errors (when NOTIFICATION-001 exists)
Business:     completions per day (when OBSERVABILITY-003 exists)
```

Widgets for not-yet-existing components are added by their tickets.

## Cost

CloudWatch: 3 dashboards free → cost 0 USD. Document.

---

# Deliverables

```text
Dashboard Terraform resource
README link to dashboard
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

- Dashboard exists and is Terraform-managed
- All listed AWS metrics shown
- Documented in README

---

# Definition of Done

- System health is visible in one place
- Infrastructure deploys through GitHub Actions

---

# Out of Scope

- Alarms (OBSERVABILITY-002)
- Custom metrics (OBSERVABILITY-003)
