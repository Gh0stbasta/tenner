# FOOD-021: Ingredient Reference Catalog

## Type

Backend Feature / Data

---

## Priority

Critical

---

## Phase

2.0 Core

---

## Goal

One shared list of ingredients that every food feature uses: allergy and dislike checks, protein and base rules,
shopping list grouping, nutrition and cost.

---

# Background

Without a reference list, „Nüsse“ in one dish and „Haselnüsse“ in another could not be matched to an allergy, and
the shopping list could not add up „200 g Nudeln“ from two dishes. Added to the owner's breakdown by
EPIC-FOOD-001.

---

# Dependencies

```text
FOOD-001
```

---

# Scope

## Model

| Field | Notes |
|---|---|
| `ingredientId` | stable slug, e.g. `pasta`, `salmon`, `apple` |
| `name` | German display name |
| `tags` | allergens (EU 14 major allergens plus custom tags such as `APPLE`, `COCONUT`), `MEAT`, `POULTRY`, `FISH`, `PORK` … |
| `proteinTag` | optional, animal protein sources only (R7, decision 3): `POULTRY`, `FISH`; beef/pork by form: `MINCE`, `BURGER_PATTY`, `SAUSAGE`, `MEATBALL` |
| `baseTag` | optional (R8, decision 4): `PASTA` (incl. Spätzle), `GNOCCHI`, `SCHUPFNUDELN`, `RICE`, `POTATO`, `BREAD`, `GRAIN` |
| `shoppingSection` | `GEMUESE_OBST`, `KUEHLREGAL`, `FLEISCH_FISCH`, `TROCKENWAREN`, `TIEFKUEHL`, `BACKWAREN`, `GEWUERZE`, `SONSTIGES` |
| `defaultUnit` | `g`, `ml`, `Stück`, `EL`, `TL` (conversion to g/ml for nutrition) |
| `nutritionPer100` | kcal, protein, carbs, fat (rough values, FOOD-012) |
| `pricePerUnit` | EUR estimate per 100 g / 100 ml / piece (FOOD-013) |
| `pantry` | basic supply (salt, oil, spices): hidden on the shopping list by default |

## Catalog

- About 120 ingredients that cover the 57 seed dishes (`backend/src/meals/catalog/ingredients.ts`), versioned in
  code, imported together with the dishes (FOOD-003).
- Household-specific ingredients can be added (`POST /meals/ingredients`) and edited (name, section, price,
  nutrition, tags) in the dish editor (FOOD-010).
- `GET /meals/ingredients` for pickers.

---

# Testing Requirements

```text
Catalog schema validation (every seed ingredient complete, unique IDs)
Every seed dish references only catalog ingredients
Allergen and protein tags present where expected (nuts, apple; poultry, fish, minced meat, burger patty, sausage, meatball)
Unit conversion
Custom ingredient create and edit
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Ingredient model, seed catalog, repository, API
Tests
```

---

# Validation

```bash
cd backend && npm run lint && npm run typecheck && npm test
```

---

# Acceptance Criteria

- [ ] Every allergy and dislike from the owner input can be expressed as a tag
- [ ] Every seed dish's ingredients resolve
- [ ] Nutrition and price values present for every non-pantry ingredient
- [ ] Custom ingredients possible
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

- Nutrition and price values are rough, self-maintained estimates (no licensed food database, no live prices);
  they are labelled „ca.“ in the UI.
- Coconut is not treated as a nut (EPIC-FOOD-001, decision 2); it keeps an informational tag `COCONUT`.

---

# Out of Scope

- Barcode scanning, supermarket price APIs, brand products.
