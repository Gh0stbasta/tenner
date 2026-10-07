# FOOD-022: Choose, Swap and Lock Meals by Hand

## Type

Full-Stack Feature

---

## Priority

High

---

## Phase

2.0 Core

---

## Goal

The family stays in control: pick a dish for a meal, swap two meals (e.g. Tuesday and Thursday dinner), and lock
meals so regenerating the week keeps them.

---

# Background

Owner vision: „manually swap meals“. Added to the owner's breakdown by EPIC-FOOD-001; FOOD-008 needs the locks.

---

# Dependencies

```text
FOOD-005
FOOD-006
FOOD-009
```

---

# Scope

## API

```text
PUT  /meals/plans/{weekStart}/slots/{slotId}   { dishId?, locked? }          (If-Match version)
POST /meals/plans/{weekStart}/swap             { from: slotId, to: slotId }  (If-Match version)
```

- Choosing a dish sets `source: MANUAL`, `locked: true`.
- Hard-rule violations of a manual choice are **allowed but returned as warnings** („Hühnchen am Mittwoch –
  Regel R5“); allergy (R1) and suitability (R2) violations need an explicit `confirm: true`, because they can harm
  someone.
- Swap moves both dishes; warnings as above.

## UI

- „Selbst wählen“: searchable dish picker, sorted: fits all rules first, then dishes with warnings (reason shown);
  allergy conflicts with a red warning and a confirmation dialog.
- „Tauschen“: choose the other meal of the week.
- Lock icon on each card.

---

# Testing Requirements

```text
Choose sets manual + locked
Swap exchanges two slots
Warnings returned for rule violations
Allergy/suitability without confirm → 409, with confirm → saved with warning
Lock toggle
UI: picker sorting, warning dialog
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Slot update and swap endpoints
Picker, swap and lock UI
Tests
```

---

# Validation

```bash
cd backend && npm run lint && npm run typecheck && npm test
cd frontend && npm run lint && npm run build && npm test
```

---

# Acceptance Criteria

- [ ] Any dish can be chosen for any meal
- [ ] Two meals can be swapped
- [ ] Locked meals survive regeneration
- [ ] Rule conflicts are shown; allergy conflicts need confirmation
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

- People may deliberately break a rule (e.g. chicken on a birthday); Tenner warns but does not forbid, except that
  allergy conflicts need a confirmation.

---

# Out of Scope

- Free-text meals without a dish (e.g. „Restaurant“); a skip status covers that (FOOD-023).
