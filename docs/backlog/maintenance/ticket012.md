# MAINT-012: Create a dish with a chat AI (prompt and JSON import)

## Goal

When creating a dish, the owner can copy a ready-made prompt into any chat AI, get back JSON in the dish format and
import that JSON into the dish editor.

## Context

Owner request (2026-10-11): „beim anlegen eines gerichts sollen zwei extra buttons sein. ein button soll einen
vorgefertigten prompt in die zwischenablage legen, der die formatierung für ein gericht enthält … danach n json
bekommen, welches ich nutzen kann um ein neues gericht anlegen zu können mit allen nötigen daten. dafür soll dann der
zweite button sein.“

Dish ingredients reference the household's ingredient catalog (FOOD-021), so the prompt has to carry the catalog
names. ADR 0009 keeps AI out of the product; this ticket adds no AI service — the owner uses an external chat AI of
their choice by copy and paste.

## Requirements

- Two buttons in the editor for a new dish: „KI-Prompt kopieren“ and „JSON übernehmen“.
- „KI-Prompt kopieren“ writes a German prompt to the clipboard: the task (describe the dish), the JSON format with every
  field, the allowed values and limits (same as the editor), the catalog ingredient names with their units, and the
  instruction to answer with JSON only.
- The prompt contains no household data beyond the ingredient names (no eaters, allergies, plans).
- „JSON übernehmen“ opens a dialog with a text field for the AI answer. Code fences and text around the JSON object are
  tolerated. Valid JSON fills the editor; nothing is saved until „Speichern“.
- Ingredients are matched to the catalog by name (case-insensitive) or id; units not allowed for the ingredient fall
  back to its base unit. Ingredients not in the catalog are listed in a hint („Neue Zutat“ adds them).
- Invalid JSON or wrong values show a German message in the dialog and change nothing.

## Acceptance Criteria

- [x] Both buttons in the editor for a new dish (not when editing)
- [x] The copied prompt contains the format, the allowed values and the catalog ingredients
- [x] Valid AI JSON fills all fields of the editor; saving works as usual
- [x] Unknown ingredients are reported, wrong JSON gives a message
- [x] Tests passing

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-10-11).

- `src/features/meals/dishImport.ts`: `buildDishPrompt(catalog)` (format with an example, rules with the editor's
  limits from `DISH_LIMITS`, categories with German labels, ingredient names sorted with their allowed units) and
  `parseDishJson(text, catalog)` (first `{` to last `}`, zod schema with defaults for `group`, `vegetarianVariant`,
  `familyFriendly`, `isBurger`, `optional`; catalog match by id or name; unit fallback; duplicates dropped).
- `DishAiImport.tsx`: the two buttons with a short hint and the paste dialog („Antwort der KI“, error in the dialog).
- `DishEditorDialog.tsx`: shows it for a new dish only; an import replaces the draft and lists missing ingredients as
  chips „… anlegen“ that open „Neue Zutat“ (added with the default quantity).
- Tests: prompt content (no household data), parsing (fences, defaults, units, duplicates, unknown ingredients,
  errors), the editor flow from copy to `POST /meals/dishes`, no buttons when editing. Validation: lint, typecheck,
  510 frontend tests, production build.
- Docs: frontend README, CHANGELOG, `docs/security.md` (residual risk: ingredient names go to the external AI the
  owner chooses). No new technical debt; the limits come from `DISH_LIMITS`, so the prompt follows changes there.

## Assumptions

- Pasting the answer into a text field works on every device; reading the clipboard directly needs a permission
  prompt and is not supported everywhere.
- Nutrition stays the estimate from the ingredients; the JSON has no own nutrition values.
- Photos are not part of the JSON.

## Out of Scope

- Calling an AI from the app (ADR 0009).
- Creating missing ingredients from the JSON automatically.
- Importing several dishes at once.
