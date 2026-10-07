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
    vegetarianExceptions: protein tags allowed anyway (e.g. BEEF_MINCE, SAUSAGE)
    allergies: tags (hard)          e.g. NUTS, APPLE
    dislikes: tags or ingredient IDs (hard)
    likes: ingredient IDs or dish groups (soft weighting)
  }
]
household: {
  dislikes: tags/ingredients for everyone (TOFU, QUINOA, BLUE_CHEESE_SAUCE)
  maxActiveMinutes: 20
  lunchDays: all 7 days (default)
  lightLunchOnWeekdays: true
  maxSaladLunchesPerWeek: 2
  chicken: { maxPerWeek: 1, allowedSlots: [MON#DINNER, TUE#DINNER] }
  maxBurgerPerWeek: 1
  limitedProteinTags: [CHICKEN, SALMON, EGG, SAUSAGE, SOY, …]   (R7)
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

- [ ] Allergies, preferences, dislikes, children and portion sizes can be stored per eater
- [ ] Household rules editable with the owner's values as defaults
- [ ] Health data never appears in logs or notifications
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

- The owner enters the family once in the app (about five minutes); the repository is public, so no personal seed.
- Every eater eats every planned meal (EPIC-FOOD-001, decision 5).

---

# Out of Scope

- Per-meal attendance („Ein Erwachsener isst Mittwoch auswärts“).
- Calorie targets per person.
