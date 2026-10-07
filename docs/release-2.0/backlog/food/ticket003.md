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
- **Protein and base** follow decisions 3 and 4: protein tag only for poultry, beef, pork (incl. sausages) and fish;
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

- [ ] All 57 dishes from the owner's lists available after one import („Salat mit Protein“ as its variants)
- [ ] Each dish classified for every planning rule
- [ ] Import idempotent with dry run
- [ ] Owner reviewed the classification (review sheet)
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

- „Gnocchi mit Soße“ from the dish list is the same as the favorites' tomato and spinach sauce variants.
- Quantities are typical recipe amounts per adult portion; the owner may adjust them in the editor.

---

# Out of Scope

- Recipes with cooking steps; dish photos (FOOD-011).
