# UX-007: Establish Frontend Performance Budget

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

Keep Tenner fast on mobile devices by defining and enforcing a performance budget.

---

# Background

Charts (ANALYTICS-009), i18n (UX-004) and additional features increase bundle size.
Tenner is mostly used on phones for quick actions; load time directly affects usage.

---

# Dependencies

```text
FRONTEND-001
TICKET-018
```

---

# Scope

## Budget

```text
Initial JS (gzipped)            ≤ 200 KB
Largest Contentful Paint (4G)   ≤ 2.5 s
Interaction to Next Paint       ≤ 200 ms
```

## Measures

- Route-based code splitting (`React.lazy`) for analytics, settings, calendar.
- Bundle analysis report (`rollup-plugin-visualizer`) generated in CI as artifact.
- CI step fails if initial JS exceeds the budget.
- Lighthouse CI run against the production build (local preview server) with
  thresholds for Performance ≥ 90 and Accessibility ≥ 95.

---

# Testing Requirements

```text
Budget check fails when exceeded (verified with a deliberate test)
Lazy routes load correctly
```

---

# Deliverables

```text
Code splitting
Bundle size check in CI
Lighthouse CI configuration
docs: performance budget
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

- Budget documented
- Budget enforced in CI
- Code splitting implemented
- Lighthouse thresholds met

---

# Definition of Done

- Performance regressions are caught before deployment

---

# Out of Scope

- Server-side rendering
- Real user monitoring (OBSERVABILITY-005 covers errors only)
