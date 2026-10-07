# FOOD-008: Regenerate the Week

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

The whole week can be planned again in one action, while meals chosen or locked by hand and meals already eaten
stay as they are.

---

# Background

Owner breakdown FOOD-008. Typical reasons: new dishes added, profile changed, the proposal does not fit the week.

---

# Dependencies

```text
FOOD-006
FOOD-022 (locks)
FOOD-009 (UI)
```

---

# Scope

## API

```text
POST /meals/plans/{weekStart}/regenerate   (If-Match version)
```

- Keeps: locked slots, slots with `source: MANUAL`, slots in the past and slots with status `COOKED`.
- Replans all other slots with a new seed; returns the plan with a summary (`changed`, `kept`).
- Only the current and the next week.

## UI

- „Woche neu planen“ on the plan page with a confirmation that names how many meals change and which stay; undo via
  snackbar restores the previous plan version.

---

# Testing Requirements

```text
Kept slots unchanged (locked, manual, past, cooked)
Other slots replanned; hard rules hold across kept + new slots
New seed stored
Undo restores the previous plan
Version conflict → 409
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Regenerate endpoint
Plan page action with confirmation and undo
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

- [ ] Whole week regenerated in one action
- [ ] Locked, manual, past and cooked meals kept
- [ ] Rules hold across kept and new meals
- [ ] Undo possible
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

- Undo keeps the previous plan version in the client for the snackbar's duration (no server-side history of plan
  versions).

---

# Out of Scope

- Regenerating past weeks.
