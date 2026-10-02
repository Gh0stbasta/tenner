# OBSERVABILITY-006: Define Logging Standards and Saved Queries

## Type

Documentation / Observability

---

## Priority

Low

---

## Phase

V2

---

## Goal

Make logs consistently useful for troubleshooting with documented standards
and ready-to-use CloudWatch Logs Insights queries.

---

# Background

A structured logger and correlation IDs exist (TICKET-008). Field names and
log levels are not documented, and there are no saved queries for common questions.

---

# Dependencies

```text
TICKET-008
```

---

# Scope

## Standards

Document in `docs/observability.md`:

```text
Required fields: timestamp, level, message, correlationId, route, tenantId
Event naming: PascalCase event names (e.g. TennerCompleted)
Levels: ERROR (actionable), WARN (degraded), INFO (business events), DEBUG (off in prod)
Forbidden content: tokens, credentials, email addresses, notes, full event payloads
```

## Saved Queries (Terraform `aws_cloudwatch_query_definition`)

```text
Errors in the last 24h by route
Trace a request by correlationId
Slowest requests
Concurrency conflicts
Completion activity per day
Audit events (SECURITY-012)
```

## Verification

Add a unit test that fails if the logger is called with known sensitive keys
(`authorization`, `password`, `token`, `email`).

---

# Deliverables

```text
docs/observability.md
Saved query definitions
Logger sensitive-key guard + test
```

---

# Validation

```bash
terraform fmt -check

terraform validate

npm run lint

npm run test
```

---

# Acceptance Criteria

- Logging standards documented
- Saved queries available in CloudWatch
- Sensitive keys are redacted or rejected by the logger
- Tests passing

---

# Definition of Done

- Troubleshooting follows documented, repeatable steps

---

# Out of Scope

- Log shipping to external systems
