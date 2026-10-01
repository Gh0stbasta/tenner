# UX-003: Conduct Accessibility Audit (WCAG 2.1 AA)

## Type

Frontend Quality

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Verify and fix accessibility across the whole application against WCAG 2.1 AA,
and prevent regressions with automated checks.

---

# Background

Each frontend ticket lists accessibility requirements, but there is no
cross-cutting verification.

---

# Dependencies

```text
FRONTEND-001 to FRONTEND-010
```

---

# Scope

## Automated Checks

- Add `jest-axe` / `vitest-axe` assertions to page-level tests.
- Add an axe check in CI for key routes (via Playwright if E2E tests exist,
  otherwise component-level only).

## Manual Audit

Audit pages:

```text
/dashboard
/tenners
/tenners/:id
/history
/analytics
/settings
Dialogs (Create, Edit, Quick Add, Confirmations)
```

Check:

```text
Keyboard-only operation
Focus order and visible focus
Screen reader announcements (NVDA or VoiceOver)
Color contrast (light and dark theme)
Touch target size ≥ 44×44 px
Reduced motion preference
Form error association
```

## Results

Document findings in `docs/accessibility.md` with status per finding.

Fix all findings rated "blocking" in this ticket; record others as technical debt
or separate tickets.

---

# Testing Requirements

```text
Automated axe checks for each page
Regression tests for fixed issues
```

---

# Deliverables

```text
Automated accessibility tests
docs/accessibility.md audit report
Fixes for blocking findings
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

- Automated accessibility checks run in CI
- All pages audited
- Blocking findings fixed
- Remaining findings documented
- Tests passing

---

# Definition of Done

- Tenner is usable with keyboard and screen readers
- Accessibility regressions are caught automatically

---

# Out of Scope

- WCAG AAA conformance
- Formal certification
