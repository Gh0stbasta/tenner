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

- [ ] New dishes can be created with ingredients
- [ ] Dishes can be edited, archived and restored
- [ ] The editor shows which rules and eaters a dish affects
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

- Every member may edit dishes (no roles, as in release 1.0).

---

# Out of Scope

- Importing recipes from websites; cooking instructions.
