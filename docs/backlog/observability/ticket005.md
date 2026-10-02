# OBSERVABILITY-005: Implement Frontend Error Reporting

## Type

Full-Stack / Observability

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Capture JavaScript errors from users' browsers so frontend failures are visible
to the maintainer.

---

# Background

Frontend errors are invisible today: if the app breaks on a specific phone, nobody
knows until someone complains. UX-005 introduces an error boundary with a reporting hook.

A third-party service (e.g. Sentry) would add cost, a data processor and a dependency.
A minimal self-hosted endpoint is sufficient for a household app.

---

# Dependencies

```text
UX-005
SECURITY-002
```

---

# Scope

## Endpoint

```text
POST /client-errors
```

Payload:

```json
{
  "message": "TypeError: x is undefined",
  "stack": "...",
  "route": "/dashboard",
  "appVersion": "2026.10.01-abc123",
  "userAgent": "..."
}
```

Rules:

```text
authenticated only
max payload 8 KB, stack truncated
rate limit: 20 reports / user / hour (in-memory + throttling)
logged as structured CLIENT_ERROR event (no tokens, no form contents)
```

## Frontend

- Error boundary and global `window.onerror` / `unhandledrejection` report errors.
- Deduplicate identical errors within a session.
- App version injected at build time.

## Alarm

Metric filter + alarm on CLIENT_ERROR rate (OBSERVABILITY-002).

---

# Testing Requirements

```text
Payload Validation
Truncation
Rate Limiting
Deduplication In Client
No Sensitive Data In Report
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Client error endpoint
Frontend reporter
Metric filter and alarm
Tests
Documentation
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

- Frontend errors are reported and visible in logs
- Abuse limited by size and rate
- No sensitive data reported
- Tests passing

---

# Definition of Done

- Frontend failures are detected without user reports

---

# Out of Scope

- Session replay
- Third-party error monitoring
