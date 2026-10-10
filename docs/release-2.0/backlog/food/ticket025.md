# FOOD-025: Release Tenner 2.0

## Type

Release / Documentation

---

## Priority

High

---

## Phase

2.0 Release

---

## Goal

Ship meal planning as release 2.0.0 with the same care as release 1.0: version, changelog, release notes for
people, updated architecture and operations documentation.

---

# Background

Release 1.0 was closed by RELEASE-001 (`docs/release-1.0/hotfix/release001.md`). Release 2.0 contains the FOOD
tickets of `docs/release-2.0/backlog/food/`.

---

# Dependencies

```text
All FOOD tickets of phases 2.0 Core and 2.0 Extended that the owner wants in 2.0
```

---

# Scope

- Version 2.0.0 in backend, frontend and alexa; `CHANGELOG.md` entry 2.0.0.
- Release notes `docs/release-2.0/README.md` updated from planning index to release overview (slogan, highlights,
  features, architecture diagram with the meals table and image bucket, figures, known limitations, upgrade steps:
  catalog import, family profile, calendar subscription, widget).
- `docs/architecture.md`, `docs/security.md` (public ICS route, image bucket, health data), `docs/analytics.md`,
  runbooks, README (setup) checked.
- Tickets not built in 2.0 are moved to a follow-up list or removed with the owner's decision.
- Dashboard refreshed.
- After the merge: tag `v2.0.0` and GitHub release.

---

# Testing Requirements

```text
All test suites green
Mermaid diagrams parse, no broken Markdown links
Smoke test after deploy includes GET /meals/today
```

---

# Deliverables

```text
Version bump, changelog, release notes
Documentation review
Tag and GitHub release (after merge)
```

---

# Validation

```bash
cd backend && npm test
cd frontend && npm test
cd alexa && npm test
cd terraform && terraform test
python3 -m unittest discover -s scripts/tests
```

---

# Acceptance Criteria

- [x] Version 2.0.0 everywhere, changelog entry complete
- [x] Release notes for people published in the repository
- [x] Documentation reflects the implementation
- [ ] Tag `v2.0.0` and GitHub release exist
- [x] Tests passing

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [ ] Acceptance criteria verified
- [ ] Git commit created

---

# Assumptions

- Release 2.0 may ship without the Long-Term evaluations (FOOD-020, FOOD-024).
- FOOD-020 and FOOD-024 stay open as follow-up work with proposed ADRs (0009, 0008) instead of being removed; the
  release notes list them with their next step. Removing them needs the owner's decision.
- The release date in the changelog is the date the release was prepared (2026-10-10); the tag follows the merge.
- The smoke test checks `GET /meals/today` without a login (401, the route exists and is protected) and the public
  calendar feed with an unknown token (404); signed-in calls stay untested (TD-024).

---

# Out of Scope

- New features.

---

# Implementation Status

Prepared (2026-10-10). **Remaining after the merge:** tag `v2.0.0` and the GitHub release (owner, or Claude when
asked); then the last acceptance criterion and „Acceptance criteria verified“ / „Git commit created“ are checked.

- Version 2.0.0 in `backend`, `frontend` and `alexa` (`package.json`, `package-lock.json`).
- `CHANGELOG.md` entry 2.0.0 (Added, Changed, Security, Known Limitations).
- Release notes: `docs/release-2.0/README.md` turned from planning index into the release overview (highlights, a day
  with the app, architecture diagram with the meals table and image bucket, figures, security, limitations, getting
  started, follow-up work); the ticket index stays below.
- Documentation check: `README.md` (status, current state), `docs/roadmap.md`, `docs/architecture.md`,
  `docs/security.md` (public ICS route, image bucket, allergies), `docs/analytics.md` (food), `alexa/README.md`;
  relative Markdown links of the changed documents checked (all resolve).
- Smoke test: `scripts/smoke-test.sh` checks `GET /meals/today` (401) and the calendar feed (404).
- Validation: backend 1,145, frontend 498, alexa 160, Terraform 82, scripts 48 tests passed; lint, typecheck and build
  as in the feature tickets.
- Dashboard: refreshed in its own commit before the pull request.

