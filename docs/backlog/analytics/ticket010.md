# ANALYTICS-010: Introduce Analytics Pre-Aggregation

## Type

Backend / Infrastructure

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Introduce pre-aggregated daily statistics **only if** on-the-fly aggregation
(ANALYTICS-001) no longer meets performance or cost targets.

---

# Background

ANALYTICS-001 aggregates directly from `tenner-history`. This is the simplest
solution for a single household.

Pre-aggregation becomes necessary when:

```text
p95 latency of analytics endpoints > 1s
or
history items per tenant > 50,000
or
multi-household support (FUTURE-001) multiplies data volume
```

---

# Dependencies

```text
ANALYTICS-001
OBSERVABILITY-003 (latency metrics required to justify this ticket)
```

---

# Scope

## Trigger Evaluation

Before implementation, document measured latency and item counts in the ticket.
If thresholds are not met, close the ticket as "not required".

## Design

```text
DynamoDB Streams on tenner-history
        ↓
Aggregation Lambda
        ↓
tenner-stats table (tenantId, statKey = DAY#2026-10-01#USER#STEFAN ...)
```

Alternative: nightly EventBridge-scheduled rollup. Choose the simpler option that
meets the requirement and record an architecture decision.

## Correctness

- Undo of a completion must decrement aggregates.
- Aggregation must be idempotent (stream retries).
- Provide a rebuild script that recomputes all aggregates from history.

---

# Deliverables

```text
Architecture decision record
Stats table (Terraform)
Aggregation Lambda
Rebuild script
Analytics service switched to aggregates
Tests
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

Results of aggregated and on-the-fly analytics must be identical for a test dataset.

---

# Acceptance Criteria

- Need is justified by measurements
- Aggregates are idempotent
- Undo is reflected correctly
- Rebuild script exists
- Analytics results unchanged
- Tests passing

---

# Definition of Done

- Analytics scale beyond single-household volume
- Feature deploys through GitHub Actions

---

# Out of Scope

- Data warehouse or Athena integration
- Real-time streaming dashboards
