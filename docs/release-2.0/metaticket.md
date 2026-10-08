# EPIC-FOOD-001: Family Meal Planning Platform (Release 2.0)

## Type

Epic / Backlog Generation

---

## Priority

High

---

## Phase

Release 2.0

---

## Goal

Tenner plans the family's meals. Every week a lunch and dinner plan for seven days is ready without anyone planning
it, follows the household's rules (allergies, diet, variety, preparation time), and turns into a shopping list.
People see it in the app, on the phone, in a calendar, by voice and on the Echo Show.

The first version is **deterministic**: predefined dishes, explicit rules, application logic. No AI.

---

# Context

Owner input of 2026-10-07 (this file before it was put into this form; the original text is in the Git history).

Release 1.0 made Tenner complete for recurring household responsibilities and closed the feature backlog
(BACKLOG-003, RELEASE-001). The owner opens release 2.0 with a new capability: meal planning. The family already
follows a semi-structured meal plan with a fixed catalog of preferred dishes. Every day the question
„Was gibt's heute?“ has to be answered; Tenner should answer it.

Objectives:

- remove planning overhead and decision fatigue
- ensure variety
- respect allergies, diet and dislikes
- support family routines (light lunches on weekdays, warm dinners, little cooking effort)

Owner's expectation: meal plan, shopping list and the Echo Show widget will be used more often than any other
Tenner feature.

---

# Vision

Users open Tenner → „Essen“ and see the current week, already planned:

```text
Diese Woche

Montag      Mittag  Salat mit Halloumi
            Abend   Burgerwraps
Dienstag    Mittag  Onigiri
            Abend   Chicken Dinos mit Pommes
…
Sonntag     Mittag  Kaiserschmarrn
            Abend   Flammkuchen
```

Users can:

- regenerate the whole week (locked meals stay)
- replace one meal („Tausche Mittwoch Abend“)
- choose or swap meals by hand
- create, edit and archive dishes
- see estimated nutrition and cost
- get a shopping list for the week
- hear „Alexa, was gibt es heute?“ and see today's meals on the Echo Show

---

# Owner Input: Household Rules

The family details given by the owner (names, ages) are made unrecognizable in this file and in every ticket (owner
decision 6). They are entered once in the app's family profile (FOOD-004). The rules below are the planning-relevant
content.

## Eaters

| Eater | Diet and restrictions (entered in the profile) |
|---|---|
| Adult 1 | Allergic to nuts and apples |
| Adult 2 | Vegetarian; occasionally eats minced meat (Hackfleisch) or sausages (Würstchen) |
| Child 1 – 3 | Toddler and preschool age; smaller portions |

**Who eats when (decision 5):** Monday to Friday lunch only the two adults; weekend lunch and every dinner the
whole family.

## Preferences

- Liked: pasta, Spätzle, rice, potatoes; vegetables (broccoli, beans, spinach, peas); salad with protein; pizza,
  burgers, hot dogs, chicken nuggets, wraps; fish **only** fish fingers or salmon; cheese such as Camembert, feta,
  mozzarella, parmesan.
- Not wanted: tofu, quinoa, sauces with blue cheese (Schimmelkäse).

## Planning Rules

| # | Rule | Type |
|---|---|---|
| R1 | No dish may contain an ingredient an eater is allergic to | Hard |
| R2 | Every meal must be suitable for every eater (vegetarian, or meat only in the vegetarian's allowed exceptions, or a vegetarian variant of the dish exists) | Hard |
| R3 | No disliked ingredient (tofu, quinoa, blue-cheese sauce) | Hard |
| R4 | Active cooking time at most 20 minutes per meal (oven or simmering time does not count) | Hard |
| R5 | Chicken at most once per week, and only on Monday **or** Tuesday dinner | Hard |
| R6 | Burger dishes at most once per week | Hard |
| R7 | Each animal protein source at most once per week: poultry, fish, and beef/pork **by form** — minced meat, burger patties, sausages, meatballs | Hard |
| R8 | The same base ingredient at most once per day; groups: pasta (incl. Spätzle), gnocchi, Schupfnudeln, rice, potatoes, bread | Hard |
| R9 | Weekday lunches (adults only) are light and low in calories | Hard |
| R10 | Dinners are preferably warm and filling | Soft |
| R11 | Salads at lunch only occasionally (not every day) | Soft |
| R12 | Variety: no dish twice in a week; prefer dishes not eaten last week | Hard (week) / Soft (last week) |
| R13 | Dishes must be simple and family-friendly | Catalog property |

Breakfast rules (cold on weekdays, scrambled eggs allowed at the weekend) are recorded; breakfast is not planned in
release 2.0. Kitchen: four-burner hob, oven, microwave — every catalog dish fits it.

---

# Owner Input: Dish Catalog

57 dishes after merging the owner's two lists (the dish list and the favorites; duplicates removed). Dishes with
alternatives in their name become variants of one dish group (FOOD-002). Classification (meal slot, protein, base,
time, ingredients) is done in FOOD-003.

| Group | Dishes |
|---|---|
| Pasta | Nudeln mit Soße · Spaghetti Bolognese · One Pot Pasta · Käsemakkaroni · Ofenrigatoni · Tortellini · Tortellini mit Frischkäsefüllung & Brokkoli · Ravioli · Lasagne · Nudelauflauf |
| Potatoes | Kartoffelsuppe mit Würstl · Kartoffeln mit Butter · Kartoffelpuffer · Kartoffelmuffins · Bratkartoffeln mit Ei · Bratkartoffeln mit Würstl · Frikadellen mit Kartoffelbrei · Fischstäbchen-Auflauf mit Kartoffeln und Spinat · Rösti mit Kräuterquark · Eier in Senfsoße mit Kartoffeln |
| Gnocchi | Gnocchi in Tomatensoße · Gnocchi in Spinatsoße · Gnocchi mit Spinat & Feta |
| Rice | Eierreis mit Gemüse · Mikrowellenrisotto · Chili · Reispfanne mit Paprika & Zucchini · Curryreis mit Kokosmilch (mild) |
| Burgers & wraps | Burger · Burgerwraps · Piratenburger · Gemüsefrikadellen · Hot Dogs |
| Meat & fish | Spätzle mit Hackbraten · Spätzle mit Soße · Köttbullar · Chicken Dinos mit Pommes · Fischstäbchen mit Erbsenpüree · Gebratener Lachs mit Gemüse |
| Vegetarian & classics | Spätzle · Käsespätzle mit Röstzwiebeln · Schupfnudeln · Grießbrei · Kaiserschmarrn · Ofengemüse mit Kräuterquark · Gebratener Halloumi mit Ofengemüse · Gemüsecurry · Linseneintopf · Ramen · Onigiri · Toast Hawaii · Flammkuchen · Pfannenpizza (Wrap-Boden) · Mozzarella-Tomaten-Baguettes · Kontaktgrill-Sandwiches · Gemüse-Toasts aus dem Ofen |
| Salads | Salat mit Protein (variants by protein, FOOD-003) |

---

# Requirements

- Put this epic into the ticket format of the repository.
- Create the domain folder `docs/release-2.0/backlog/food/` and all implementation tickets needed for the vision,
  at least FOOD-001 to FOOD-020 (the owner's breakdown), each in the same format and level of detail as the
  release 1.0 tickets.
- Add the tickets the owner's breakdown misses but the vision needs.
- Give a recommended implementation order and the decisions the owner still has to make.
- Keep the AI planning engine as a later, optional evaluation.

---

# Ticket Breakdown

| ID | Title | Priority | Phase |
|---|---|---|---|
| [FOOD-001](backlog/food/ticket001.md) | Meal Planning Architecture | Critical | 2.0 Core |
| [FOOD-002](backlog/food/ticket002.md) | Dish Data Model and Dish API | Critical | 2.0 Core |
| [FOOD-003](backlog/food/ticket003.md) | Seed the Family Dish Catalog | High | 2.0 Core |
| [FOOD-004](backlog/food/ticket004.md) | Family Food Profile | Critical | 2.0 Core |
| [FOOD-005](backlog/food/ticket005.md) | Meal Planning Rules Engine | Critical | 2.0 Core |
| [FOOD-006](backlog/food/ticket006.md) | Automatic Weekly Planner | Critical | 2.0 Core |
| [FOOD-007](backlog/food/ticket007.md) | Replace a Single Meal | High | 2.0 Core |
| [FOOD-008](backlog/food/ticket008.md) | Regenerate the Week | High | 2.0 Core |
| [FOOD-009](backlog/food/ticket009.md) | Meal Plan Page | Critical | 2.0 Core |
| [FOOD-010](backlog/food/ticket010.md) | Dish Editor | High | 2.0 Extended |
| [FOOD-011](backlog/food/ticket011.md) | Dish Photos | Medium | 2.0 Extended |
| [FOOD-012](backlog/food/ticket012.md) | Nutrition Estimate | Medium | 2.0 Extended |
| [FOOD-013](backlog/food/ticket013.md) | Cost Estimate | Medium | 2.0 Extended |
| [FOOD-014](backlog/food/ticket014.md) | Shopping List | High | 2.0 Core |
| [FOOD-015](backlog/food/ticket015.md) | Meal Calendar Feed (ICS) | Low | 2.0 Extended |
| [FOOD-016](backlog/food/ticket016.md) | Meal Notifications | High | 2.0 Extended |
| [FOOD-017](backlog/food/ticket017.md) | Alexa: „Was gibt es heute?“ | High | 2.0 Extended |
| [FOOD-018](backlog/food/ticket018.md) | Echo Show Meal Widget | High | 2.0 Extended |
| [FOOD-019](backlog/food/ticket019.md) | Food Analytics | Low | 2.0 Extended |
| [FOOD-020](backlog/food/ticket020.md) | Evaluate an AI Planning Engine | Low | Long-Term |
| [FOOD-021](backlog/food/ticket021.md) | Ingredient Reference Catalog | Critical | 2.0 Core |
| [FOOD-022](backlog/food/ticket022.md) | Choose, Swap and Lock Meals by Hand | High | 2.0 Core |
| [FOOD-023](backlog/food/ticket023.md) | Meal History and Feedback | Medium | 2.0 Extended |
| [FOOD-024](backlog/food/ticket024.md) | Evaluate Stock and AI-Generated Dish Images | Low | Long-Term |
| [FOOD-025](backlog/food/ticket025.md) | Release Tenner 2.0 | High | 2.0 Release |
| [FOOD-026](backlog/food/ticket026.md) | Shopping List via Alexa (added 2026-10-07) | Medium | 2.0 Extended |
| [FOOD-027](backlog/food/ticket027.md) | Shopping List as Its Own Navigation Entry (added 2026-10-08) | High | 2.0 Core |

Added to the owner's breakdown:

- **FOOD-021 Ingredient Reference Catalog:** allergies, shopping list, nutrition and cost all need a shared list of
  ingredients with allergen tags, protein source, base ingredient, shopping section, nutrition and price.
- **FOOD-022 Choose, Swap and Lock:** the vision's „manually swap meals“ and keeping hand-picked meals when the week
  is regenerated.
- **FOOD-023 Meal History and Feedback:** „favorite dishes“ (FOOD-019) and „prefer dishes not eaten last week“ (R12)
  need a record of what was really eaten.
- **FOOD-024:** stock and AI-generated images (FOOD-011 in the owner's list) need an external service and an ADR;
  photo upload stays in FOOD-011.
- **FOOD-025:** version 2.0.0, changelog and release notes, like RELEASE-001.

---

# Recommended Order

```text
Foundation:        FOOD-001 → 002 → 021 → 004 → 003
Planning (first usable version):
                   FOOD-005 → 006 → 009 → 007 → 022 → 008
Kitchen:           FOOD-014 → 010 → 012 → 013 → 011
Everywhere:        FOOD-016 → 017 → 026 → 018 → 015
Insight:           FOOD-023 → 019
Release:           FOOD-025
Later (evaluate):  FOOD-020, FOOD-024
```

After the planning block the family can use the plan every day; the shopping list follows directly because the
owner rates it most valuable.

---

# Owner Decisions

Answered by the owner on 2026-10-07; the tickets follow them.

| # | Question | Decision |
|---|---|---|
| 1 | „Max 20 minutes“: active or total time? | **Active cooking time.** Oven and simmering time do not count; total time is shown (R4) |
| 2 | Coconut milk and the nut allergy | **Coconut milk is tolerated.** Coconut is not an allergen for the family; Curryreis mit Kokosmilch stays in the catalog |
| 3 | Which protein sources count for R7? | **Animal protein sources such as poultry, beef or fish.** Tags: `POULTRY`, `FISH`, and for beef/pork by form: `MINCE`, `BURGER_PATTY`, `SAUSAGE`, `MEATBALL`; each at most once per week (owner, 2026-10-07: for beef and pork the form decides, not the animal) |
| 4 | Base-ingredient groups for R8 | **Spätzle count as pasta; gnocchi and Schupfnudeln are separate groups** |
| 5 | Who eats lunch? | **Monday to Friday only the two adults; at the weekend the children too.** Dinner always with the whole family |
| 6 | Family details in the public repository | **Not sensitive.** The Git history stays as it is; current files make the details unrecognizable |

Consequences:

- Decision 3: egg, cheese (also halloumi and feta), other dairy and legumes are not limited by R7. Beef and pork
  count by form: minced meat (Bolognese, Chili, Lasagne), burger patties, sausages (Würstl, Hot Dogs) and meatballs
  (Frikadellen, Köttbullar, Hackbraten) are four sources. Assumption: shaped minced meat (meatballs, Hackbraten) is
  its own form, separate from loose minced meat and from burger patties.
- Decision 5: weekday lunches are planned for two portions and only have to suit the adults (R2 for the eaters
  present); shopping list and cost use the eaters of each meal (FOOD-004, FOOD-013, FOOD-014).

---

# Acceptance Criteria

- [x] The epic follows the repository's ticket format (goal, context, requirements, criteria, assumptions, scope)
- [x] Domain folder `docs/release-2.0/backlog/food/` with FOOD-001 – FOOD-025 in the release 1.0 ticket format
  (type, priority, phase, goal, background, dependencies, scope, testing, deliverables, validation, acceptance
  criteria, definition of done, assumptions, out of scope)
- [x] Every capability of the vision and every owner ticket idea is covered by a ticket
- [x] Every planning rule R1 – R13 is assigned to a ticket (FOOD-005)
- [x] Recommended order documented; owner decisions 1 – 6 recorded and applied to the tickets (2026-10-07)
- [x] Family details (names, birth years) unrecognizable in the generated files (owner decision 6)
- [x] Release 2.0 index (`docs/release-2.0/README.md`), maintenance backlog, roadmap, `CLAUDE.md` and dashboard
  point to the release 2.0 backlog

---

# Definition of Done

- [x] Implementation completed (tickets generated)
- [x] Tests completed (documentation only; link check, ticket structure check)
- [x] Documentation updated
- [x] Technical debt documented (none new)
- [x] Acceptance criteria verified
- [x] Git commit created

---

# Assumptions

- **Release 2.0 reopens feature work.** Release 1.0 put the project into maintenance; the owner's request starts a
  new release. Release 2.0 tickets live in `docs/release-2.0/backlog/<domain>/`, next to this epic, the way release
  1.0's are archived in `docs/release-1.0/`. Maintenance (`MAINT`) and recommendations (`REC`) stay in
  `docs/backlog/`.
- **Owner numbering kept:** FOOD-001 – FOOD-020 keep the owner's numbers and titles; added tickets start at FOOD-021.
- **Family details:** the owner does not consider them sensitive (decision 6); the Git history keeps the original
  text, current files use roles (Adult 1, Child 1 …). The real profile is entered in the app and stored in DynamoDB
  like all household data; seeds contain dishes and generic rules only.
- **Deterministic first:** no AI service is used in release 2.0 (owner goal). AI-generated images and an AI planner
  are evaluations (FOOD-020, FOOD-024).
- **One household,** as in release 1.0.

---

# Out of Scope

- Breakfast planning, recipes with step-by-step instructions, online grocery ordering, supermarket price data.
- AI features (FOOD-020, FOOD-024 evaluate them).
- Multiple households.

---

# Implementation Status

Done (2026-10-07): 25 tickets generated in `docs/release-2.0/backlog/food/`; owner decisions 1 – 6 applied on the
same day. Next: FOOD-001.
