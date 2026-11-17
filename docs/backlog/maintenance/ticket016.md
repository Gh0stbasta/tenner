# MAINT-016: Update zod for GHSA-mrhx-c7xc-m3w5

## Goal

The production dependency audit passes again: zod is updated to a version without the advisory.

## Context

The CI check `npm audit --omit=dev` (SECURITY-007, `scripts/check_npm_audit.py`) failed on 2026-11-17 for backend and
frontend: „GHSA-mrhx-c7xc-m3w5 (high) in zod: Zod can exhaust memory while validating oversized constrained
collections“, affected `< 4.6.6`. Both packages pinned `4.6.5`. The failure blocks every pull request (PR #54) and is
red on `main` as well; Dependabot's group pull requests (#50, #53) also carry the update, together with many others.

## Requirements

- zod `4.6.7` (pinned, exact) in `backend` and `frontend`; lockfiles updated with npm, not by hand.
- No other dependency changes.

## Acceptance Criteria

- [x] `check_npm_audit.py` reports no high/critical production vulnerabilities for backend and frontend
- [x] Backend and frontend tests, lint, typecheck and build pass

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-11-17). `npm install zod@4.6.7 --save-exact` in `backend` and `frontend` (package.json and lockfile, zod
only). The audit check failed locally before with the same message and passes after it for both packages. Validation:
backend 1,147 and frontend 512 tests, lint, typecheck, frontend build. No new technical debt.

## Assumptions

- A patch release (4.6.5 → 4.6.7) needs no code changes; the full test suites confirm it.

## Out of Scope

- The other updates in the Dependabot group pull requests.
- The moderate `fast-uri` advisory in the frontend tree (moderate does not fail the check).
