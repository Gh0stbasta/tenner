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
- Tap opens the skill's meal card (FOOD-017).

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

- [ ] Widget shows today's lunch and dinner on the Echo Show home screen
- [ ] Updates after plan changes and daily
- [ ] Switches to tomorrow in the evening
- [ ] Device test documented
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

- Widget support depends on Amazon's widget platform for private skills; if the device test of ALEXA-007 fails, the
  fallback is the Echo Show dashboard section of FOOD-017 (documented go/no-go).

---

# Out of Scope

- Shopping list widget.
