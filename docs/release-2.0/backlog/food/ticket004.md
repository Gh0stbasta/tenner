# FOOD-004: Family Food Profile

## Type

Full-Stack Feature

---

## Priority

Critical

---

## Phase

2.0 Core

---

## Goal

The household describes who eats and what each person may and may not eat once; the planner uses it for every plan.

---

# Background

Owner breakdown: allergies, preferences, dislikes, children, portion sizes. The household has two adults (one with
a nut and apple allergy, one vegetarian with exceptions) and three small children (EPIC-FOOD-001). Children are not
Tenner members, so eaters are their own list.

---

# Dependencies

```text
FOOD-001
FOOD-021 (tags for allergies and dislikes)
```

---

# Scope

## Model (`PROFILE` item, versioned)

```text
eaters: [
  {
    eaterId, name (display only), type: ADULT | CHILD,
    memberId?            link to a Tenner member (optional)
    portionFactor        default ADULT 1.0, CHILD 0.5
    diet: OMNIVORE | VEGETARIAN
    vegetarianExceptions: ingredients allowed anyway (e.g. minced meat, sausages)
    allergies: tags (hard)          e.g. NUTS, APPLE
    dislikes: tags or ingredient IDs (hard)
    likes: ingredient IDs or dish groups (soft weighting)
  }
]
household: {
  dislikes: tags/ingredients for everyone (TOFU, QUINOA, BLUE_CHEESE_SAUCE)
  maxActiveMinutes: 20
  attendance: { weekdayLunch: [eaterIds], weekendLunch: all, dinner: all }   (decision 5)
  lightLunchOnWeekdays: true
  maxSaladLunchesPerWeek: 2
  chicken: { maxPerWeek: 1, allowedSlots: [MON#DINNER, TUE#DINNER] }
  maxBurgerPerWeek: 1
  limitedProteinTags: [POULTRY, FISH, MINCE, BURGER_PATTY, SAUSAGE, MEATBALL]   (R7, decision 3)
  mealTimes: { lunch: "12:00", dinner: "18:00" }               (FOOD-015, FOOD-016)
}
```

Defaults reproduce the owner's rules, so a new profile only needs the eaters.

## API and UI

- `GET /meals/profile`, `PUT /meals/profile` (If-Match version); validation of tags against FOOD-021.
- Settings → „Essen“ → „Familienprofil“: eaters as cards (name, adult/child, portion, vegetarian with exceptions,
  allergies, dislikes, likes) and the household rules with their defaults.
- Allergies are shown with a warning icon and are always hard rules.

## Privacy

- Allergies are health data: stored only in `tenner-meals`, never logged, never in notification texts, never sent
  to Alexa except as part of a dish name.
- No birth dates: only adult/child and a portion factor.

---

# Testing Requirements

```text
Defaults equal the owner's rules
Validation: unknown tags, portion range 0.1 – 2.0, duplicate eater
Optimistic locking
Logs contain no allergy values
UI: add, edit, remove eater; allergy warning
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Profile model, service, handlers
Settings section „Familienprofil“
Tests
```

---

# Validation

```bash
cd backend && npm run lint && npm run typecheck && npm test
cd frontend && npm run lint && npm run typecheck && npm run build && npm test
```

---

# Acceptance Criteria

- [x] Allergies, preferences, dislikes, children and portion sizes can be stored per eater
- [x] Who eats weekday lunch, weekend lunch and dinner is stored (default: weekday lunch adults only)
- [x] Household rules editable with the owner's values as defaults
- [x] Health data never appears in logs or notifications
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

- The owner enters the family once in the app (about five minutes); the repository keeps family details
  unrecognizable (EPIC-FOOD-001, decision 6), so there is no personal seed.
- Attendance per meal type (decision 5): Monday – Friday lunch only the two adults, weekend lunch and every dinner
  all eaters. Defaults: weekday lunch = all adults, everything else = all eaters.
- **Model details:** vegetarian exceptions are protein forms (e.g. `MINCE`, `SAUSAGE`); dislikes are split into tags
  and ingredient IDs; likes are ingredient IDs and dish groups (groups get a UI once dishes are edited, FOOD-010).
  Attendance stores explicit eater lists or `null` for the default.
- **No birth dates:** adult/child and a portion factor only (child default 0.5).
- **Whole-profile save:** `PUT /meals/profile` replaces the profile; the UI saves from two dialogs (person, rules)
  and on removal. Versioning as for dishes (409 `CONCURRENT_MODIFICATION`).
- **Member link:** optional, each member once; checked against all household members.

---

# Out of Scope

- Attendance for single days („Ein Erwachsener isst Mittwoch auswärts“); only the weekday/weekend pattern is stored.
- Calorie targets per person.

---

# Implementation Status

Done (2026-10-07).

- Backend: `backend/src/meals/models/profile.ts` (defaults, `eatersAt`), `services/profile.service.ts`,
  `handlers/profile.ts`, schema in `validators.ts`; routes `GET/PUT /meals/profile`.
- Frontend: Settings → „Essen: Familienprofil“ (`frontend/src/features/meals/FoodProfileSettings.tsx`,
  `EaterDialog.tsx`, `FoodRulesDialog.tsx`, `api.ts`, `labels.ts`, `eaters.ts`).
- Tests: `backend/tests/meals-profile.test.ts`, route test incl. „no allergies in logs“,
  `frontend/src/features/meals/FoodProfileSettings.test.tsx`.
- Owner action after deploy: enter the family in Settings → „Essen: Familienprofil“.
