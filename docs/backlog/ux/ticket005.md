# UX-005: Implement Global Error Handling and Network Feedback

## Type

Frontend Quality

---

## Priority

High

---

## Phase

MVP

---

## Goal

Ensure users always understand what happened when something goes wrong and
never lose input because of a transient error.

---

# Background

Individual features handle their own loading and error states. There is no
global safety net for:

```text
Unexpected rendering errors
Expired or offline network
Server errors (5xx)
Conflicts (409) from concurrent edits
```

---

# Dependencies

```text
FRONTEND-001
```

---

# Scope

## Error Boundary

Top-level React error boundary with a friendly fallback and "Reload" action.
Errors are reported via the client logging endpoint once OBSERVABILITY-005 exists.

## API Error Mapping

Central mapping from API error codes to user messages:

```text
VALIDATION_ERROR         → field-level messages where possible
NOT_FOUND                → "This Tenner no longer exists."
CONCURRENT_MODIFICATION  → "Someone else changed this Tenner. Reload to see the latest version."
TENNER_INACTIVE          → "This Tenner is inactive."
5xx / network            → "Tenner is unreachable. Retrying…"
```

## Connectivity

- Offline banner using `navigator.onLine` and failed requests.
- TanStack Query retry policy: retry idempotent GETs (3×, backoff); never auto-retry
  non-idempotent mutations without an idempotency key.

## Input Preservation

Dialog forms keep their input when a save fails.

---

# Testing Requirements

```text
Error Boundary Fallback
Error Code Mapping
Offline Banner
Retry Policy For Queries
No Retry For Mutations Without Idempotency Key
Form Input Preserved On Failure
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Error boundary
Central error mapping
Offline banner
Query client retry configuration
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

- Unexpected errors show a fallback instead of a blank page
- API errors produce understandable messages
- Offline state visible
- Retries only where safe
- Failed saves keep user input
- Tests passing

---

# Definition of Done

- Errors are understandable and recoverable
- Feature deploys through GitHub Actions

---

# Out of Scope

- Offline mutations queue (MOBILE-004)
- Remote error reporting backend (OBSERVABILITY-005)
