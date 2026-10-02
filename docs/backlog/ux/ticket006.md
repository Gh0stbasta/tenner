# UX-006: Implement Week Calendar View

## Type

Frontend Feature

---

## Priority

Low

---

## Phase

V2

---

## Goal

Show upcoming Tenners on a week calendar so users can see how load is distributed
over the next days.

---

# Background

The dashboard shows Today, Overdue and Upcoming as lists. A calendar view makes
heavy days visible and supports planning (e.g. moving Tenners to the weekend).

---

# Dependencies

```text
TICKET-010 (list with nextDue sort)
SCHEDULING-003 (snooze, for drag-to-move)
```

---

# Scope

## Route

```text
/calendar
```

## View

- 7-day view (current week), navigation to next/previous weeks (up to 4 weeks ahead).
- Each day shows Tenners and total estimated minutes.
- Days exceeding a configurable threshold (default 60 min) are highlighted.
- Filter by user and category.

## Interaction

- Click opens Tenner detail.
- Drag-and-drop to another day uses the snooze endpoint (future days only).
  Keyboard alternative: "Move to…" menu.

## Data

Projected occurrences are computed client-side from `nextDue` and frequency
for the visible range. Only the next occurrence is real; later projected
occurrences are visually distinguished.

---

# Testing Requirements

```text
Week Rendering
Daily Totals
Heavy Day Highlight
Projected Occurrences
Move Via Menu
Drag And Drop
Filters
Mobile Layout (agenda list)
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Calendar page
Projection utility
Move interaction
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

- Week view shows Tenners and daily load
- Projected occurrences distinguishable
- Tenners can be moved via snooze
- Keyboard alternative available
- Tests passing

---

# Definition of Done

- Upcoming workload is plannable visually
- Feature deploys through GitHub Actions

---

# Out of Scope

- Month view
- External calendar sync (INTEGRATION-006 to 008)
