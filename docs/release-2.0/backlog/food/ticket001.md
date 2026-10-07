# FOOD-001: Meal Planning Architecture

## Type

Architecture / Backend / Infrastructure

---

## Priority

Critical

---

## Phase

2.0 Core

---

## Goal

Decide and document how meal planning fits into Tenner's serverless architecture before any feature is built:
data storage, API shape, where the planner runs, how images are stored, and how notifications, Alexa and the
calendar reach the plan.

---

# Background

Release 2.0 adds a new domain (EPIC-FOOD-001, `docs/release-2.0/metaticket.md`). Tenner's architecture is
authoritative (`docs/architecture.md`): serverless only, allowed services API Gateway, Lambda, DynamoDB, S3,
CloudFront, EventBridge, Cognito, SSM Parameter Store, Alexa Skills Kit. Every later FOOD ticket depends on the
decisions made here.

---

# Dependencies

```text
Release 1.0 (household, members, settings, notifier, push, Alexa, offline cache)
```

---

# Scope

## ADR 0007: Meal Planning

`docs/decisions/0007-meal-planning.md` with context, options, decision, consequences and risks for:

| Topic | Options to compare | Proposed decision |
|---|---|---|
| Storage | (A) new table `tenner-meals` with typed sort keys; (B) items on the existing household item; (C) one table per entity | **A**: one table, partition key `tenantId`, sort key `DISH#<id>`, `INGREDIENT#<id>`, `PROFILE`, `PLAN#<weekStart>`, `LIST#<weekStart>`; on-demand, PITR, deletion protection, tagging as in TICKET-006 |
| API | (A) routes in the existing `tenner-api` Lambda; (B) a new Lambda | **A**: same Lambda, router, authorizer and throttling; no new runtime cost |
| Planner | (A) backend service, deterministic, seeded; (B) client side; (C) AI | **A**: pure function in `backend/src/meals/planner/`, seed stored with the plan so a plan is reproducible |
| Plan creation | (A) on first read of a week; (B) scheduled job; (C) both | **C**: the plan service creates a missing week on read (idempotent conditional write); the notifier calls the same service for the next week so notifications and Alexa always have data |
| Images (FOOD-011) | (A) private S3 bucket behind the existing CloudFront distribution, upload via presigned PUT; (B) external image host | **A**: no new service; images resized in the browser before upload |
| Calendar (FOOD-015) | (A) public ICS route with a secret token; (B) Google Calendar API | **A**: no OAuth, no new service |

## API Overview (to be refined by each ticket)

```text
GET    /meals/dishes                         list (filter: archived, slot, group)
POST   /meals/dishes                         create (FOOD-010)
GET    /meals/dishes/{dishId}
PUT    /meals/dishes/{dishId}
DELETE /meals/dishes/{dishId}                archive
POST   /meals/dishes/{dishId}/restore
GET    /meals/ingredients                    FOOD-021
GET    /meals/profile    PUT /meals/profile  FOOD-004
POST   /meals/catalog                        seed import (FOOD-003, dryRun)
GET    /meals/plans/{weekStart}              get or create (FOOD-006)
POST   /meals/plans/{weekStart}/regenerate   FOOD-008
POST   /meals/plans/{weekStart}/slots/{slotId}/replace   FOOD-007
PUT    /meals/plans/{weekStart}/slots/{slotId}           choose, lock, status (FOOD-022, FOOD-023)
POST   /meals/plans/{weekStart}/swap                     FOOD-022
GET    /meals/today                          today and tomorrow (Alexa, notifications)
GET    /meals/plans/{weekStart}/shopping-list   PATCH …  FOOD-014
GET    /meals/analytics                      FOOD-019
GET    /meals/calendar/{token}.ics           public, FOOD-015
```

`slotId` = `<ISO date>#LUNCH` or `<ISO date>#DINNER`. Week = 7 days from the household's week start
(HOUSEHOLD-ADMIN-003) in the household timezone (SCHEDULING-008).

## Module Layout

```text
backend/src/meals/
├── models/          Dish, Ingredient, FoodProfile, MealPlan, ShoppingList
├── repositories/    DynamoDB access for tenner-meals
├── planner/         rules (FOOD-005) and planner (FOOD-006), pure functions
├── services/        dish, profile, plan, shopping list services
└── catalog/         seed data (FOOD-003, FOOD-021)
frontend/src/features/meals/
```

## Infrastructure (this ticket)

- Terraform: table `tenner-meals`, IAM for the API Lambda (only the needed actions on this table), routes added
  to `api_routes`, Resource Group tagging, Terraform tests.
- `docs/architecture.md`: new section "Meal Planning" (components, data flow, security boundaries, cost).

## Cross-Cutting Rules

- Tenant and acting user only from the verified token (SECURITY-004); every member may read and change the plan.
- Optimistic versioning on plans, profile and shopping lists (as `saveVersionedList`) for parallel edits.
- Health data (allergies) is never logged and never sent in notifications.
- German UI texts; English code and API.

---

# Testing Requirements

```text
Terraform: table, keys, PITR, deletion protection, tags, IAM scope, routes
Backend: meals config, key helper and versioned store (get, prefix query, create, versioned update, error mapping)
Architecture document and ADR reviewed against the allowed-services list
```

---

# Deliverables

```text
ADR 0007
docs/architecture.md section "Meal Planning"
Terraform table tenner-meals, IAM, routes
backend/src/meals/ skeleton with repository base
Terraform tests
```

---

# Validation

```bash
cd terraform && terraform fmt -check -recursive && terraform validate && terraform test
cd backend && npm run lint && npm run typecheck && npm test
```

---

# Acceptance Criteria

- [x] ADR 0007 accepted by the owner, covering storage, API, planner, plan creation, images, calendar
- [x] No service outside the allowed list
- [x] `tenner-meals` table defined with PITR, deletion protection, tags and least-privilege IAM
- [x] Route list and module layout documented; later tickets refer to them
- [x] Architecture document updated
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

- One new DynamoDB table is cheaper to reason about than more attributes on the household item, whose 400 KB item
  limit would be reached by plans and shopping lists over time.
- Cost stays within the free tier (a few hundred reads and writes per day).
- **Routes come with their handlers:** instead of 501 stubs for all planned routes, each feature ticket adds its
  routes to `api_routes` and the router. No reachable endpoint without an implementation.
- **ADR accepted** by the owner's request to start the release 2.0 foundation (2026-10-07), which follows the
  proposals of this ticket.
- **Deploy role (outside the repository):** `GitHubActionsDeployRole` must be allowed to create and manage
  `tenner-meals` (DynamoDB create, update, tag, PITR, TTL, deletion protection) before this change is deployed;
  README → "CI Permissions".

---

# Out of Scope

- Implementing the features (FOOD-002 onward).
- AI services (FOOD-020, FOOD-024).

---

# Implementation Status

Done (2026-10-07).

- ADR [0007](../../../decisions/0007-meal-planning.md); `docs/architecture.md` → "Meal Planning".
- Terraform: `aws_dynamodb_table.meals` (`tenner-meals`, `tenantId`/`itemKey`, TTL `expiresAt`, PITR, encryption,
  deletion protection, `prevent_destroy`), API role access (`iam.tf`), `MEALS_TABLE` for the API; tests in
  `dynamodb.tftest.hcl`, `iam.tftest.hcl`, `api.tftest.hcl`.
- Backend: `config.mealsTable`; `backend/src/meals/keys.ts`, `backend/src/meals/repositories/meals-store.ts`;
  tests `backend/tests/meals-store.test.ts`.
- Owner action before the deploy: extend `GitHubActionsDeployRole` for `tenner-meals` (README → "CI Permissions").
