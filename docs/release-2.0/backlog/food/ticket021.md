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

- [x] Every allergy and dislike from the owner input can be expressed as a tag
- [x] Every seed dish's ingredients resolve (verified with FOOD-003, `backend/tests/meals-catalog.test.ts`)
- [x] Nutrition and price values present for every non-pantry ingredient
- [x] Custom ingredients possible
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

- Nutrition and price values are rough, self-maintained estimates (no licensed food database, no live prices);
  they are labelled „ca.“ in the UI.
- Coconut is not treated as a nut (EPIC-FOOD-001, decision 2); it keeps an informational tag `COCONUT`.
- **Built before FOOD-002:** dishes validate their ingredient references and derive vegetarian, allergens, protein and
  base from them, so the catalog comes first.
- **Catalog in code, not imported:** catalog ingredients are always read from `catalog/ingredients.ts`; the table only
  holds household ingredients (`kind: CUSTOM`) and household changes to catalog values (`kind: OVERRIDE`). A new
  catalog version reaches every household without an import step.
- **105 ingredients** cover the 57 seed dishes (checked by FOOD-003's coverage test) plus common extras; tofu, quinoa
  and blue cheese are tags only, so they stay excluded.
- **Ham** (Toast Hawaii, Flammkuchen) is its own beef/pork form `HAM` (decision 3: by form).
- **Units:** `g`, `ml`, `Stück` as base units; dishes may also use `EL` (15 g/ml) and `TL` (5 g/ml); ml counts as g
  for nutrition. The unit of an ingredient cannot change once it exists.
- **Versioning:** the service reads the stored item and writes with its version (409 `CONCURRENT_MODIFICATION`),
  like categories; clients send no version.
- The editing UI comes with the dish editor (FOOD-010).

---

# Out of Scope

- Barcode scanning, supermarket price APIs, brand products.

---

# Implementation Status

Done (2026-10-07); the seed-dish coverage criterion was verified with FOOD-003.

- Model and units: `backend/src/meals/models/ingredient.ts`; catalog: `backend/src/meals/catalog/ingredients.ts`.
- Service: `backend/src/meals/services/ingredient.service.ts`; schemas: `backend/src/meals/validators.ts`;
  handlers: `backend/src/meals/handlers/ingredients.ts`.
- Routes `GET/POST /meals/ingredients`, `PUT /meals/ingredients/{ingredientId}` (`terraform/locals.tf`,
  `backend/src/index.ts`); API documented in `backend/README.md`.
- Tests: `backend/tests/meals-ingredients.test.ts`, route tests in `backend/tests/index.test.ts`, in-memory meals
  table `backend/tests/mocks/meals.ts`; Terraform route test.
