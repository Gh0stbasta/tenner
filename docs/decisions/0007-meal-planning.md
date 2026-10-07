# ADR 0007: Meal Planning Architecture

- **Status:** Accepted (2026-10-07)
- **Ticket:** FOOD-001 (epic EPIC-FOOD-001, release 2.0)
- **Deciders:** repository owner (Stefan), by asking to start the release 2.0 foundation („na dann leg mal los mit
  foundation von release 2.0“) after merging the FOOD backlog whose FOOD-001 proposes these options.

## Context

Release 2.0 adds meal planning: dishes, ingredients, a family food profile, weekly plans, shopping lists and later
photos and a calendar feed. The architecture is serverless and limited to the allowed services
(`docs/architecture.md` → "Serverless Only"). The planner must follow explicit household rules and work without AI.

## Considered Options

| Topic | Options | Assessment |
|---|---|---|
| Storage | A: one new table `tenner-meals`, partition key `tenantId`, sort key `itemKey` with typed prefixes · B: attributes on the household item · C: one table per entity | A keeps all meal data in one place with one IAM grant; B would hit the 400 KB item limit with plans and lists; C adds tables and Terraform without benefit |
| API | A: routes in the existing `tenner-api` Lambda · B: a new Lambda | A reuses router, authorizer, throttling and logging; no extra cost or cold starts |
| Planner | A: deterministic backend module with a stored seed · B: in the browser · C: AI | A is testable, reproducible and works for Alexa and notifications; C is excluded for 2.0 |
| Plan creation | A: on first read · B: scheduled job · C: both | C: read path creates a missing week idempotently; the notifier prepares next week so notifications and Alexa always have data |
| Dish images | A: private S3 bucket behind the existing CloudFront distribution, presigned upload · B: external image host | A uses allowed services only |
| Calendar | A: public ICS route with a secret token · B: Google Calendar API | A needs no OAuth and works with every calendar app |

## Decision

All options **A**, plan creation **C**.

- **Table `tenner-meals`:** `tenantId` (partition key) and `itemKey` (sort key). Item kinds:

  | `itemKey` | Content | Ticket |
  |---|---|---|
  | `DISH#<dishId>` | dish | FOOD-002 |
  | `INGREDIENT#<ingredientId>` | household-specific ingredient | FOOD-021 |
  | `PROFILE` | family food profile | FOOD-004 |
  | `PLAN#<weekStart>` | weekly plan | FOOD-006 |
  | `LIST#<weekStart>` | shopping list | FOOD-014 |

  On-demand, encrypted, point-in-time recovery, deletion protection, `prevent_destroy`; attribute `expiresAt`
  enabled as TTL for old plans (FOOD-023). Every item carries a `version` for optimistic locking.
- **Module:** `backend/src/meals/` (models, repository, planner, services, catalog); frontend
  `frontend/src/features/meals/`. Each feature ticket adds its own routes to `api_routes`; no route exists before its
  handler does.
- **IAM:** the API role gets the existing read/write actions (GetItem, PutItem, UpdateItem, Query) on the meals table;
  the notifier gets access with FOOD-006.

## Consequences

- No new AWS service; the allowed-services list stays unchanged. S3 for images and the public ICS route are decided
  here and built in FOOD-011 and FOOD-015.
- The deploy role must be allowed to create and manage `tenner-meals` (README → "CI Permissions") before the first
  deploy with this table.
- Allergies are stored in the profile item; they are never logged and never put into notification texts.
- Cost: a few hundred reads and writes per day, within the DynamoDB free tier.

## Risks

- A single table mixes item kinds: repository code must always set the prefix; a shared key helper
  (`backend/src/meals/keys.ts`) is the only place that builds sort keys.
- Optimistic locking conflicts when two people edit the same plan at once; handled with 409 and client retry.
