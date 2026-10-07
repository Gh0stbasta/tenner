# FOOD-003: Seed the Family Dish Catalog

## Type

Full-Stack Feature / Data

---

## Priority

High

---

## Phase

2.0 Core

---

## Goal

All of the family's current dishes are in Tenner with one click, fully classified, so the first plan can be
generated right away.

---

# Background

The owner gave two lists (dish list and favorites); merged they are 57 dishes (EPIC-FOOD-001, „Owner Input: Dish
Catalog“). The import follows the pattern of DATA-008 (household task catalog): versioned seed in code, dry run,
idempotent.

---

# Dependencies

```text
FOOD-002
FOOD-021
```

---

# Scope

## Seed (`backend/src/meals/catalog/dishes.ts`)

For each of the 57 dishes: name, group, category, slots, lightness, temperature, ingredients with quantities per
adult portion, active and total minutes, vegetarian variant where needed, family-friendly.

Classification rules:

- **Variants:** „Bratkartoffeln mit Ei / mit Würstl“, „Spätzle mit Hackbraten / mit Soße“, „Gnocchi in Tomatensoße /
  in Spinatsoße / mit Spinat & Feta“ share a group.
- **„Salat mit Protein“** becomes variants in group „Salat mit Protein“: mit Halloumi, mit Ei, mit Feta, mit Lachs,
  mit Hähnchen (the protein makes R5 and R7 apply).
- **Vegetarian variants** for meat dishes the vegetarian adult does not eat: e.g. Burger → „mit Veggie-Patty“, Chicken
  Dinos → „mit Veggie-Nuggets“, Köttbullar → „mit Gemüsebällchen“, Lachs → „mit Halloumi“. Minced meat and sausage
  dishes need none (allowed exceptions).
- **Lunch candidates** (light): salads, Onigiri, Ramen, Mikrowellenrisotto, Eierreis, Ofengemüse, Gemüse-Toasts,
  Sandwiches, Mozzarella-Tomaten-Baguettes, Kartoffeln mit Butter, Linseneintopf, Gemüsecurry … — the seed marks
  `LIGHT`; filling dishes are for dinner and weekend lunch (weekday lunch is for the two adults only, decision 5).
- **Time:** `activeMinutes` is the hands-on time (EPIC-FOOD-001, decision 1); oven and simmering time go into
  `totalMinutes` only. Lasagne, Ofenrigatoni or Linseneintopf stay plannable when their active time is ≤ 20 minutes.
- **Protein and base** follow decisions 3 and 4: protein tag only for poultry, fish and beef/pork by form (minced meat, burger patty, sausage, meatball);
  Spätzle are pasta, gnocchi and Schupfnudeln have their own base groups.
- **Coconut** is not an allergen for the family (decision 2): Curryreis mit Kokosmilch is a normal dish.

## Import

- `POST /meals/catalog` with `{ "dryRun": true }` → preview (new dishes, already present, ingredients added).
- Import adds missing ingredients and dishes by name; existing dishes (also edited ones) are never overwritten.
- Settings → „Essen“ → „Gerichtekatalog“: „Katalog prüfen“ → „Jetzt importieren“.

## Review Sheet

`docs/release-2.0/food-catalog-review.md`: a generated table of all seed dishes with their classification, so the
owner can check slot, lightness, protein, base and time at a glance before the import.

---

# Testing Requirements

```text
Seed schema: every dish valid against the FOOD-002 model
Every owner dish present exactly once (name list test)
Variant groups as specified
No seed dish contains NUTS; dishes with APPLE are tagged
Import idempotent: second run adds nothing
Dry run writes nothing
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Dish seed, import service and endpoint
Settings section „Gerichtekatalog“
Review sheet
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

- [x] All 57 dishes from the owner's lists available after one import („Salat mit Protein“ as its variants)
- [x] Each dish classified for every planning rule
- [x] Import idempotent with dry run
- [ ] Owner reviewed the classification (review sheet `docs/release-2.0/food-catalog-review.md`) — owner action; active times confirmed on 2026-10-07
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

- „Gnocchi mit Soße“ from the dish list is the same as the favorites' tomato and spinach sauce variants.
- Quantities are typical recipe amounts per adult portion; the owner may adjust them in the editor.
- **61 dishes:** the 57 owner dishes with „Salat mit Protein“ as five variants (Halloumi, Ei, Feta, Lachs, Hähnchen).
- **Classification choices to review:** Burgerwraps use minced meat (protein `MINCE`) but count as a burger (R6);
  Frikadellen and Hackbraten are `MEATBALL` (shaped minced meat) and carry a vegetarian variant; Flammkuchen and
  Schupfnudeln are vegetarian with optional ham; „Spätzle“ is Spätzle with butter and peas; Grießbrei, Kaiserschmarrn
  and Onigiri are lunch only; Apfelmus is an optional side (Kartoffelpuffer, Kaiserschmarrn).
- **Active time (owner, 2026-10-07):** every dish on the owner's lists is optimized to at most 20 active minutes; the
  first estimate of 25 minutes for Lasagne, Frikadellen mit Kartoffelbrei, Gemüsefrikadellen and Spätzle mit
  Hackbraten was corrected to 20. Only new dishes are held to the time rule; a test keeps the catalog within it.
- **Review sheet in sync:** a test compares the sheet with the catalog; `UPDATE_REVIEW_SHEET=1` regenerates it.
- **Ingredients are not imported:** they are read from the code catalog (FOOD-021).

---

# Out of Scope

- Recipes with cooking steps; dish photos (FOOD-011).

---

# Implementation Status

Done (2026-10-07), except the owner's review of the classification.

- Seed: `backend/src/meals/catalog/dishes.ts`; import: `backend/src/meals/services/meal-catalog-import.service.ts`,
  `handlers/catalog.ts`; route `POST /meals/catalog`.
- Settings → „Essen: Gerichtekatalog“ (`frontend/src/features/meals/MealCatalogSettings.tsx`).
- Review sheet: `docs/release-2.0/food-catalog-review.md` (generated, checked by `backend/tests/meals-catalog.test.ts`).
- Owner actions after deploy: Settings → „Essen: Gerichtekatalog“ → „Katalog prüfen“ → „Jetzt importieren“; check the
  review sheet and adjust dishes in the editor (FOOD-010) or tell Claude.
