# FOOD-018: Echo Show Meal Widget

## Type

Alexa Skill Feature

---

## Priority

High

---

## Phase

2.0 Extended

---

## Goal

The Echo Show home screen permanently shows „🍽️ Heute · Mittag: Onigiri · Abend: Lasagne“, updated when the plan
changes — the kitchen display answers the daily question without anyone asking.

---

# Background

Owner breakdown FOOD-018; the owner expects this to be one of the most used features. The Tenner status widget
(ALEXA-007, `alexa/skill-package/dataStorePackages/tenner-status`, Amazon's layout since MAINT-002) shows how a widget is packaged and fed through the Alexa Data Store. Its
API shapes are not yet verified on a device (TD-036).

---

# Dependencies

```text
FOOD-017
ALEXA-007 (widget packaging and Data Store)
FOOD-011 (images, optional)
```

---

# Scope

## Widget `alexa/skill-package/dataStorePackages/meal-today`

- Sizes as supported by the existing widget; content: title „Heute“, lunch and dinner with small images or category
  icons; after dinner time it switches to „Morgen“.
- ~~Tap opens the skill's meal card (FOOD-017).~~ Dropped: the skill shows no views (owner decision 2026-10-08,
  MAINT-006); the widget has no tap action.

## Data Updates

- The backend pushes the widget data document to the Alexa Data Store when today's or tomorrow's slots change
  (replace, regenerate, choose, swap) and once a day at midnight household time via the notifier.
- Same Data Store client and credentials as ALEXA-007; failures logged and alarmed via the existing Alexa delivery
  alarm.

---

# Testing Requirements

```text
Widget package schema validation (as ALEXA-007)
Data document for full, partial and empty days; switch to tomorrow after dinner time
Update triggered by plan changes and daily job
Data Store failure isolated and logged
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Widget package
Data update service and notifier hook
Device test notes
Tests
```

---

# Validation

```bash
cd alexa && npm run lint && npm run typecheck && npm test
cd backend && npm run lint && npm run typecheck && npm test
```

Manual: install on the owner's Echo Show and record the result (like ALEXA-007).

---

# Acceptance Criteria

- [x] Widget shows today's lunch and dinner on the Echo Show home screen (package and data tested; device check open)
- [x] Updates after plan changes and daily
- [x] Switches to tomorrow in the evening (20:00 household time)
- [ ] Device test documented — owner check after the deploy
- [x] Tests passing

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented (TD-036 covers the unverified device behavior)
- [x] Acceptance criteria verified (device test open)
- [x] Git commit created

---

# Assumptions

- Owner request (2026-10-08): the widget shows the meal plan of today; done before FOOD-017, which is not needed for
  the widget (the tap to the meal card was dropped, see Scope).
- „After dinner time“ = 20:00 household time; the notifier checks every 15 minutes, so the switch happens by 20:15.
- Dish names only, no images (FOOD-011 is not done); a long name is cut to one line. An empty meal shows „–“.
- A separate widget „Tenner Essen“ (`meal-today`) next to the Tenner status widget; both are pushed in one Data Store
  request (two `PUT_OBJECT` commands).
- The widget data comes from the current or next week's plan (`GET`-equivalent read, which creates a missing plan
  like the app does).

- Widget support depends on Amazon's widget platform for private skills; if the device test of ALEXA-007 fails, the
  fallback is the Echo Show dashboard section of FOOD-017 (documented go/no-go).

---

# Out of Scope

- Shopping list widget.

---

# Implementation Status

Done (2026-10-08); the device test is open.

- Widget package `alexa/skill-package/dataStorePackages/meal-today/` (manifest, presentation, document bound to
  `tenner/meals`, no tap action), declared in `skill.json`; preview image `frontend/public/alexa/meal-widget-preview.png`.
- Backend: `backend/src/alexa/widget.ts` (`mealDay`, `mealWidget`, meals pushed with the status, extra push at
  20:00 — reason `EVENING`, `MealWidgetFailed` without blocking the status widget), `datastore-client.ts`
  (`putObjects` with several commands), `notifier.ts` (`mealsOn` from the current or next week's plan). Plan changes
  already publish HouseholdChanged (every successful non-GET route).
- Tests: `backend/tests/widget.test.ts` (today/tomorrow switch incl. month end, full/partial/empty day, combined
  push, failure isolation, evening push, week lookup), `alexa/tests/widget.test.ts` (package schema, fields).
