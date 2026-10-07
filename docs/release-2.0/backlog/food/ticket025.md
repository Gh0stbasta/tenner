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

- [ ] Version 2.0.0 everywhere, changelog entry complete
- [ ] Release notes for people published in the repository
- [ ] Documentation reflects the implementation
- [ ] Tag `v2.0.0` and GitHub release exist
- [ ] Tests passing

---

# Definition of Done

- [ ] Implementation completed
- [ ] Tests completed
- [ ] Documentation updated
- [ ] Technical debt documented
- [ ] Acceptance criteria verified
- [ ] Git commit created

---

# Assumptions

- Release 2.0 may ship without the Long-Term evaluations (FOOD-020, FOOD-024).

---

# Out of Scope

- New features.
