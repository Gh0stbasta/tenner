# FOOD-014: Shopping List

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

The week's plan becomes a shopping list with one tap: quantities added up for the family, grouped by supermarket
section, ticked off in the shop, shared between both phones.

---

# Background

Owner: „Extrem wertvoll. Wochenplan → Einkaufsliste.“ Needs ingredients with quantities (FOOD-002), the reference
catalog (FOOD-021) and portion factors (FOOD-004).

---

# Dependencies

```text
FOOD-006
FOOD-021
FOOD-004
```

---

# Scope

## Generation (`backend/src/meals/services/shopping-list.service.ts`)

```text
for each planned slot in range (default: from today to week end; option: whole week)
  for each ingredient of the dish (optional ingredients excluded unless chosen)
    quantity × sum of the portion factors of the eaters present at that meal (FOOD-004 attendance)
group by ingredientId + unit → convert units where possible → round up to sensible steps (e.g. 50 g, 1 Stück)
sort by shopping section (Gemüse & Obst, Kühlregal, …), pantry items in a collapsed „Vorrat“ section
```

Each line shows which meals need it („für Mo Abend, Do Mittag“).

## Storage and API

```text
LIST#<weekStart>: { items[{ key, ingredientId|null, name, quantity, unit, section, checked, manual }], version }
GET   /meals/plans/{weekStart}/shopping-list            (generate if missing)
POST  /meals/plans/{weekStart}/shopping-list/refresh    (recalculate after plan changes; keeps checked state and manual items)
PATCH /meals/plans/{weekStart}/shopping-list            { check / uncheck / add manual item / remove } (If-Match)
```

## UI

- Page „Einkaufsliste“ (from the plan page and the navigation): big checkboxes, „Eigener Eintrag“, „Liste
  aktualisieren“ hint when the plan changed after generation.
- **Own order by drag and drop** (owner, 2026-10-07): items can be moved by drag and drop in the browser (mouse) and
  in the installed app (touch); the order is stored with the list and the same on both phones. A new list starts in
  section order.
- **Ticking off** (owner, 2026-10-07): a ticked item is struck through and moves to the end of the list
  automatically; unticking puts it back.
- „Teilen“: Web Share API / copy as text.
- Offline: list readable and checkable offline; check-offs are queued and synced (pattern of MOBILE-004 queue).
- Concurrent ticking on two phones: optimistic versioning with automatic retry (merge by item key).

---

# Testing Requirements

```text
Aggregation across dishes, unit conversion, rounding
Portion factors applied
Pantry items in their own section
Refresh keeps checked state and manual items
Parallel PATCH from two clients merges
Offline check-off syncs
Share text format
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Shopping list service, storage, endpoints
Shopping list page with offline support
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

- [ ] Weekly plan becomes a grouped shopping list with summed quantities
- [ ] Items can be ticked off on two phones at the same time
- [ ] Works offline in the shop
- [ ] Manual items and sharing possible
- [ ] Items can be reordered by drag and drop (mouse and touch); ticked items are struck through at the end
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

- No pantry stock tracking: „Vorrat“ items are shown collapsed, not subtracted.
- Quantities are estimates; rounding favours buying a little more.

---

# Out of Scope

- Online grocery ordering, price comparison, supermarket-specific aisle order.
- Syncing with the Alexa shopping list: Amazon switched off the List Management API on 2024-07-01; voice access to
  this list through the Tenner skill is FOOD-026.
