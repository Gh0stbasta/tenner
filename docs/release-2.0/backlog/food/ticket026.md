# FOOD-026: Shopping List via Alexa

## Type

Alexa Skill Feature

---

## Priority

Medium

---

## Phase

2.0 Extended

---

## Goal

The family uses Tenner's shopping list by voice: add an item, hear what is still open, tick an item off — and sees the
list on the Echo Show.

---

# Background

Owner request (2026-10-07): „Tenner soll die Einkaufsliste in Alexa aktualisieren.“ Not possible: Amazon switched off
the List Management REST API for skills and apps on 2024-07-01; skills can no longer read or write the Alexa
shopping and to-do lists (Amazon developer docs, „Deprecated Features“). The only unofficial way (reading the list
with the Amazon account's login cookies) would put Amazon credentials into AWS, breaks the terms of use and breaks
with every Amazon change; rejected. Owner decision: the list stays in Tenner (app and browser, FOOD-014); Alexa uses
it through the existing „Familien Zentrale“ skill (ADR 0005), like other list apps do since 2024.

---

# Dependencies

```text
FOOD-014 (shopping list and its API)
ALEXA-001 – 006 (skill, account linking, APL)
```

---

# Scope

## Voice (German)

```text
„Alexa, sag Familien Zentrale, setz Milch auf die Einkaufsliste“      → manual item (FOOD-014 PATCH add)
„Alexa, frag Familien Zentrale, was auf der Einkaufsliste steht“      → open items in the list's order (max. 10, then count)
„Alexa, sag Familien Zentrale, ich habe Milch gekauft“                → tick off by name (fuzzy match; asks when ambiguous)
```

- Uses the current week's list; creates it if missing (same rules as FOOD-014).
- Spoken counts only above one („2 mal Nudeln“, FOOD-028).

## Echo Show

- ~~APL view „Einkaufsliste“ with touch~~: the skill shows no views since MAINT-006. Instead (owner request
  2026-10-08), a home-screen widget „Zentrale Einkaufsliste“ shows the open items in the list's order (max. 6, then
  „+ n weitere“), pushed by the notifier like the other widgets.

---

# Testing Requirements

```text
Intents add / read / tick off, including unknown and ambiguous items
Empty list and missing plan answers
APL document renders open and checked items
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Interaction model (intents, slot type for items), handlers, APL document
Tests
```

---

# Validation

```bash
cd alexa && npm run lint && npm run typecheck && npm test
```

---

# Acceptance Criteria

- [x] Items can be added, read and ticked off by voice (tested)
- [x] Echo Show shows the list as widget (package and data tested; device check open)
- [x] Changes appear in the app at once (same list and API as FOOD-014)
- [x] Tests passing
- [ ] Device check: voice phrases and widget on the Echo Show 21 (owner)

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented (TD-036 covers the unverified device behavior)
- [x] Acceptance criteria verified (device check open)
- [x] Git commit created

---

# Assumptions

- Item names are taken as spoken (`AMAZON.SearchQuery`, first letter capitalized, max. 40 characters). An item that
  is already open with the same name is not added again.
- The Alexa request ID is the item key, so Alexa's retries add an item only once.
- Ticking off uses the Tenner matching rules (ALEXA-004): close candidates are named back, nothing is guessed.
- A week without a meal plan has no list. Voice answers that; the widget shows „Alles eingekauft.“ only once the list
  exists.

- „Alexa, setz Milch auf die Einkaufsliste“ without „Familien Zentrale“ still goes to Amazon's own list; Tenner cannot
  redirect it.

---

# Out of Scope

- Syncing with the Alexa shopping list or other list apps (API switched off by Amazon, see Background).

---

# Implementation Status

Done (2026-10-08); the device check is open.

- Alexa:
  - `alexa/src/shopping.ts`: API calls, answers, matching.
  - `alexa/src/handlers/shopping.ts`: `AddShoppingItemIntent`, `ReadShoppingListIntent`, `ShoppingItemBoughtIntent`.
  - Interaction model with samples („setz {item} auf die einkaufsliste“, „was steht auf der einkaufsliste“, „ich habe
    {item} gekauft“). The help text names the list.
- Widget:
  - Package `alexa/skill-package/dataStorePackages/shopping-list/`, bound to `tenner/shopping`, declared in
    `skill.json`.
  - Preview image `frontend/public/alexa/shopping-widget-preview.png`.
- Backend:
  - `backend/src/alexa/widget.ts`: `shoppingWidget`; the shopping list is pushed with the other widgets, and
    `ShoppingWidgetFailed` is isolated.
  - `backend/src/notifier.ts`: `shoppingListOf`. Shopping list changes already publish HouseholdChanged.
- Tests: `alexa/tests/shopping.test.ts`, `alexa/tests/widget.test.ts`, `backend/tests/widget.test.ts`.
