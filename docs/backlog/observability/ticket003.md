# OBSERVABILITY-003: Publish Business and Performance Metrics

## Type

Backend / Observability

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Turn the structured log events prepared by earlier tickets into CloudWatch metrics.

---

# Background

TICKET-013 and TICKET-014 required structured log events "that can later support metrics":

```text
Successful completions
Failed completions
Completion duration
Concurrency conflicts
```

These are not yet available as metrics.

---

# Dependencies

```text
TICKET-013
TICKET-014
OBSERVABILITY-001
```

---

# Scope

## Approach

Use CloudWatch Embedded Metric Format (EMF) via the existing structured logger,
or metric filters on existing log events. Prefer EMF (no extra API calls, no extra
infrastructure). Justify if metric filters are used.

## Metrics

Namespace:

```text
Tenner/<environment>
```

```text
CompletionSucceeded        count
CompletionFailed           count (dimension: errorCode)
UndoSucceeded              count
ConcurrencyConflict        count (dimension: operation)
IdempotentReplay           count
HandlerDuration            ms (dimension: route)
NotificationSent           count (dimension: channel, type)
NotificationFailed         count (dimension: channel)
```

Keep dimensions low-cardinality: never use tennerId or userId as dimensions.

## Cost

Each custom metric costs ~0.30 USD/month after the free 10. Keep total ≤ 10 metrics,
or document the cost. Remove dimensions if necessary.

## Dashboard

Add business widgets to OBSERVABILITY-001 dashboard.

---

# Testing Requirements

```text
EMF Output Format
Metric Emitted On Success
Metric Emitted On Failure
No High-Cardinality Dimensions
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Metrics helper
Instrumentation in services
Dashboard widgets
Documentation (metric catalog)
```

---

# Validation

```bash
npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- Listed metrics published
- Dimensions low-cardinality
- Cost documented
- Dashboard shows business metrics
- Tests passing

---

# Definition of Done

- Product and performance behavior is measurable

---

# Out of Scope

- Product analytics / user tracking
