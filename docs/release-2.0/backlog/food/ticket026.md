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
- Spoken quantities only when helpful („500 Gramm Hackfleisch“).

## Echo Show

- APL view „Einkaufsliste“: open items in the list's order, checked items struck through at the end; touch to tick
  off.

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

- [ ] Items can be added, read and ticked off by voice
- [ ] Echo Show shows the list
- [ ] Changes appear in the app at once (same list as FOOD-014)
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

- „Alexa, setz Milch auf die Einkaufsliste“ without „Familien Zentrale“ still goes to Amazon's own list; Tenner cannot
  redirect it.

---

# Out of Scope

- Syncing with the Alexa shopping list or other list apps (API switched off by Amazon, see Background).
