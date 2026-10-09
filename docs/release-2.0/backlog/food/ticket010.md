# FOOD-010: Dish Editor

## Type

Frontend Feature

---

## Priority

High

---

## Phase

2.0 Extended

---

## Goal

The family adds new dishes, edits existing ones and archives dishes nobody wants any more — without help.

---

# Background

Owner breakdown FOOD-010 („Neues Gericht anlegen“) and vision („create new meals, archive meals“). The API exists
(FOOD-002).

---

# Dependencies

```text
FOOD-002
FOOD-021
FOOD-005 (live rule hints)
```

---

# Scope

## Pages

- „Gerichte“ (from the plan page and Settings → Essen): searchable list with filters (Mittag/Abend, vegetarisch,
  Kategorie, archiviert), each with image, time, tags.
- Dialog „Gericht anlegen / bearbeiten“:
  - name, group (suggestions from existing groups), category, Mittag/Abend, leicht/sättigend, warm/kalt
  - ingredients: picker over the ingredient catalog with quantity and unit per adult portion, „optional“ switch,
    „Neue Zutat“ inline (FOOD-021)
  - active and total minutes, vegetarian variant text, family-friendly
  - derived info live: vegetarisch ja/nein, Proteinquelle, Grundzutat, allergen tags, and which eaters cannot eat
    it (by profile)
  - nutrition and cost preview (FOOD-012, FOOD-013, when available)
- Archive and restore with undo; archived dishes are no longer planned.

---

# Testing Requirements

```text
Create with validation errors shown per field
Edit and save with version conflict handling
Ingredient picker and inline new ingredient
Derived info and eater warnings
Archive, restore, filter
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Dish list page and editor dialog
Tests
```

---

# Validation

```bash
cd frontend && npm run lint && npm run typecheck && npm run build && npm test
```

---

# Acceptance Criteria

- [x] New dishes can be created with ingredients
- [x] Dishes can be edited, archived and restored
- [x] The editor shows which rules and eaters a dish affects
- [x] Tests passing

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

---

# Assumptions

- Every member may edit dishes (no roles, as in release 1.0).
- The list shows no image yet: dish photos come with FOOD-011. Nutrition and cost preview come with FOOD-012 and
  FOOD-013.
- The editor does not offer the backend's manual overrides (tags, protein, base). The derived values cover the
  catalog; overrides stay an API feature.
- Quantities are per adult portion. Weighed ingredients also allow EL and TL, counted ingredients only Stück.

---

# Out of Scope

- Importing recipes from websites; cooking instructions.

---

# Implementation Status

Done (2026-10-09). Frontend only; the API from FOOD-002 and FOOD-021 was sufficient.

- Page „Gerichte“ at `/essen/gerichte` (`frontend/src/features/meals/DishesPage.tsx`): search over name and group,
  filters Mittag/Abend, Kategorie, Vegetarisch, „Archivierte zeigen“. Each card shows category, group, time and tags.
  „Archivieren“ and „Wiederherstellen“ offer „Rückgängig“ for 10 seconds. A restore that clashes with an active name
  says so. Links: button „Gerichte“ on the plan page, „Gerichte verwalten“ in Settings → Essen.
- Dialog „Gericht anlegen / bearbeiten“ (`DishEditorDialog.tsx`) with all fields of the scope:
  - The ingredient picker searches the catalog. Its last option „Neue Zutat „…“ anlegen“ opens `NewIngredientDialog.tsx`
    (name, unit, grams per piece, shop section, tags), which posts to `POST /meals/ingredients`.
  - „Was das Gericht bedeutet“ shows live: vegetarian or not, protein source, base ingredient, tags and optional
    tags. It also lists hints per eater (allergy, vegetarian, dislikes) and per household rule (dislikes, cooking time,
    chicken, light weekday lunch, family-friendly).
  - Field errors appear before sending. Server errors are mapped: `DISH_NAME_TAKEN` and `VALIDATION_ERROR` details go
    to the fields. `CONCURRENT_MODIFICATION` asks to reopen the dialog.
- Logic: `dishes.ts` (hooks, `deriveDraft`, `ruleHints`, `validateDraft`, `filterDishes`). It mirrors the backend's
  `deriveDish` and rules R1 – R5, R9 and R13; the server stays the source of truth (TD-044).
- Tests: `dishes.test.ts`, `DishEditorDialog.test.tsx`, `DishesPage.test.tsx` (19 tests). Shared fixtures are in
  `frontend/src/tests/dishFixtures.ts`.
- Validation: `npm run lint`, `tsc -b`, `npm run build`, `vitest run` (60 files, 463 tests) passed.
