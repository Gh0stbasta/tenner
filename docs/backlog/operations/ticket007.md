# OPERATIONS-007: Provide Maintenance Script Framework

## Type

Backend Tooling / Operations

---

## Priority

Low

---

## Phase

V2

---

## Goal

Provide a consistent, safe way to run one-off maintenance scripts
(seeds, backfills, data fixes) against an environment.

---

# Background

Several tickets require scripts: backfills (TICKET-020, SCHEDULING-001),
seeds (HOUSEHOLD-ADMIN-001, 002), migrations (DATA-006). Without a framework each
script reinvents argument parsing, dry-run behavior and safety checks.

---

# Dependencies

```text
TICKET-008
```

---

# Scope

## Framework

```text
backend/scripts/

├── run.ts             (entry: npm run script -- <name> --env dev [--apply])
├── lib/context.ts     (AWS clients, table names from env, logger)
└── <name>.ts          (individual scripts)
```

## Safety Rules

```text
Dry-run by default; --apply required for writes
--env required; prod requires --confirm-prod
Idempotent scripts only
Progress and summary output (items scanned/changed/skipped)
Throttle writes (configurable rate)
```

## Execution

Run locally with the operator's own AWS credentials (SSO), never with stored keys.
Optionally a manual GitHub Actions `workflow_dispatch` for dev.

---

# Testing Requirements

```text
Dry Run Makes No Writes
Prod Confirmation Required
Idempotency Of Example Script
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Script framework
Example script
Documentation
Tests
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

- Scripts share one safe framework
- Dry-run default enforced
- Production safeguards enforced
- Tests passing

---

# Definition of Done

- Data maintenance is repeatable and safe

---

# Out of Scope

- Admin web UI
