# OBSERVABILITY-004: Enable Distributed Tracing

## Type

Infrastructure / Observability

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Trace requests across API Gateway, Lambda and DynamoDB to diagnose latency.

---

# Background

As integrations and notification flows grow, it becomes harder to see where time is spent.
AWS X-Ray offers 100,000 free traces/month. X-Ray is not in the allowed-service list → short ADR.

---

# Dependencies

```text
OBSERVABILITY-003
```

---

# Scope

- ADR for X-Ray (or CloudWatch Application Signals; evaluate cost).
- Enable active tracing on Lambda and API Gateway stage.
- Instrument AWS SDK clients (DynamoDB, SSM) via X-Ray SDK or AWS Distro for OpenTelemetry
  (prefer the lighter option; measure cold-start impact).
- Propagate correlation ID as trace annotation.
- Sampling: default rule; document.

---

# Deliverables

```text
ADR
Tracing configuration (Terraform)
SDK instrumentation
Cold-start impact measurement in ticket
```

---

# Validation

```bash
terraform fmt -check

terraform validate

npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- Traces visible end to end
- Correlation ID searchable
- Cold-start overhead measured and acceptable (< 100 ms)

---

# Definition of Done

- Latency issues can be diagnosed per request

---

# Out of Scope

- Frontend tracing (RUM)
