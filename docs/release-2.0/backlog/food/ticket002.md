# FOOD-002: Dish Data Model and Dish API

## Type

Backend Feature

---

## Priority

Critical

---

## Phase

2.0 Core

---

## Goal

Store dishes with everything the planner, shopping list, nutrition and cost features need, and expose them through
a validated, tenant-scoped API with archive and restore.

---

# Background

The owner's breakdown names: name, category, ingredients, protein source, preparation time, image, nutrition, cost,
household suitability. The planning rules (EPIC-FOOD-001, R1 – R13) add: meal slot, lightness, warm or cold,
base ingredient, dish group for variants („Bratkartoffeln mit Ei / mit Würstl“), and a vegetarian variant.

---

# Dependencies

```text
FOOD-001
FOOD-021 (ingredient IDs; the dish stores references, FOOD-021 can follow directly after)
```

---

# Scope

## Model (`backend/src/meals/models/dish.ts`)

| Field | Type | Notes |
|---|---|---|
| `dishId` | string | generated |
| `name` | string, 2 – 80 | unique per household (case-insensitive, among active dishes) |
| `group` | string, optional | variants share a group; the planner uses at most one dish per group per week |
| `category` | enum | `PASTA`, `POTATO`, `RICE`, `BURGER_WRAP`, `MEAT_FISH`, `VEGETARIAN`, `SALAD`, `SOUP`, `SWEET`, `SNACK` |
| `slots` | `LUNCH` / `DINNER` set | at least one |
| `lightness` | `LIGHT` / `FILLING` | R9, R10 |
| `temperature` | `WARM` / `COLD` | R10 |
| `ingredients` | list of `{ ingredientId, quantity, unit, optional }` | per adult portion (FOOD-021 units) |
| `proteinSource` | ingredient protein tag or `NONE` | derived from ingredients, overridable |
| `baseIngredient` | base tag or `NONE` | derived from ingredients, overridable (R8) |
| `activeMinutes` | 1 – 240 | hands-on time (R4) |
| `totalMinutes` | ≥ activeMinutes | shown only |
| `vegetarianVariant` | string, optional | e.g. „mit Veggie-Patty“; makes a meat dish suitable for vegetarians (R2) |
| `familyFriendly` | boolean | default true (R13) |
| `imageKey` | string, optional | FOOD-011 |
| `nutritionOverride`, `costOverride` | optional | FOOD-012, FOOD-013 |
| `favorite` | boolean | FOOD-023 |
| `archived`, `createdAt`, `updatedAt`, `version` | | soft delete, optimistic locking |

Derived values (computed in the service, returned by the API, not stored): `isVegetarian`, `allergenTags`,
`dislikeTags`, `containsChicken`, `isBurger`.

## API

```text
GET    /meals/dishes?archived=false&slot=LUNCH
GET    /meals/dishes/{dishId}
POST   /meals/dishes
PUT    /meals/dishes/{dishId}            (If-Match version)
DELETE /meals/dishes/{dishId}            archive (plans keep the reference)
POST   /meals/dishes/{dishId}/restore
```

Validation with the existing Zod schemas pattern (`backend/src/validators/`); unknown ingredient IDs → 400 with
field errors; name conflict → 409 `DISH_NAME_TAKEN`.

---

# Testing Requirements

```text
Create, read, update, archive, restore
Validation: required fields, ranges, unknown ingredient, empty slots
Derived values: vegetarian, allergens, protein and base derivation, override wins
Name uniqueness (case-insensitive, archived dishes ignored)
Optimistic locking conflict → 409
Tenant isolation
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Dish model, repository, service, handlers, validators
API documentation in backend/README.md
Tests
```

---

# Validation

```bash
cd backend && npm run lint && npm run typecheck && npm test
cd terraform && terraform test
```

---

# Acceptance Criteria

- [x] All fields of the owner's list and the planning rules are stored or derived
- [x] Variants share a group
- [x] Archive keeps references in old plans; restore works
- [x] API validated and tenant-scoped
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

- Quantities are stored per adult portion; the family portion factor (FOOD-004) scales them.
- „Household suitability“ is not stored: it depends on the profile and is computed (FOOD-005).
- **Arrays instead of single values:** `proteinSources` and `baseTags` are lists (a dish can have several, e.g. none or
  two); the overrides `proteinSourcesOverride` and `baseTagsOverride` replace the derived lists (e.g. Frikadellen are
  `MEATBALL`, not `MINCE`).
- **Optional ingredients** (e.g. Apfelmus to Kartoffelpuffer) do not count for diet, allergies, protein or base; their
  extra tags are reported as `optionalTags`, so the rules engine (FOOD-005) can warn.
- **Burger flag:** `isBurger` marks dishes for the burger limit (R6) instead of deriving it from the category.
- **Versioning:** the service writes with the stored version (409 `CONCURRENT_MODIFICATION`) like the other household
  data; clients send no If-Match header.
- **Fields of later tickets** (`imageKey`, `nutritionOverride`, `costOverride`, `favorite`) exist in the model now;
  `imageKey` is read-only until FOOD-011.
- Built after FOOD-021 (ingredients), see that ticket.

---

# Out of Scope

- Dish editor UI (FOOD-010), images (FOOD-011), nutrition and cost calculation (FOOD-012, FOOD-013).

---

# Implementation Status

Done (2026-10-07).

- Model and derivation: `backend/src/meals/models/dish.ts`; service: `backend/src/meals/services/dish.service.ts`;
  schemas in `backend/src/meals/validators.ts`; handlers: `backend/src/meals/handlers/dishes.ts`.
- Routes `GET/POST /meals/dishes`, `GET/PUT/DELETE /meals/dishes/{dishId}`, `POST /meals/dishes/{dishId}/restore`
  (`terraform/locals.tf`, `backend/src/index.ts`); API in `backend/README.md`.
- Tests: `backend/tests/meals-dishes.test.ts`, route tests in `backend/tests/index.test.ts`, Terraform route test.
