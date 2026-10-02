# TICKET-016: Implement Due & Dashboard API

## Type

Backend Feature

---

## Priority

Critical

---

## Goal

Implement the primary dashboard API for Tenner.

The endpoint must provide users with an immediate overview of:

- Tenners due today
- Overdue Tenners
- Tenners due within the next seven days
- Total estimated effort
- Work distribution by assigned user
- Work distribution by category

This endpoint represents the primary read model for the future Tenner dashboard.

---

# Background

The following capabilities already exist:

- Create Tenner API
- List Tenners API
- Update Tenner API
- Delete Tenner API
- Complete Tenner Workflow
- Undo Completion Workflow
- Restore Tenner API
- DynamoDB due-date index
- Backend domain foundation

Tenner now requires a dashboard-oriented API that aggregates currently relevant work without requiring the frontend to issue and combine multiple requests.

---

# Scope

Implement:

```text
GET /dashboard
```

The endpoint must return:

```text
Due Today

Overdue

Upcoming

Summary Metrics
```

Only active, non-deleted Tenners may appear in the dashboard.

---

# Endpoint

## Request

```http
GET /dashboard
```

---

## Optional Query Parameters

### assignedTo

Filters all dashboard sections by assigned user.

Example:

```http
GET /dashboard?assignedTo=STEFAN
```

Allowed values:

```text
STEFAN

JULIA
```

---

### category

Filters all dashboard sections by category.

Example:

```http
GET /dashboard?category=HOUSEHOLD
```

Allowed values:

```text
HOUSEHOLD

FITNESS

FAMILY

HOME

PERSONAL

FINANCE
```

---

### date

Defines the reference date used for due-date classification.

Format:

```text
YYYY-MM-DD
```

Example:

```http
GET /dashboard?date=2026-10-01
```

If omitted, use the current date in the configured application timezone.

This parameter exists primarily for deterministic tests and future historical views.

Future dates must be supported.

---

# Timezone Configuration

Add centralized configuration:

```text
APPLICATION_TIMEZONE
```

Default value:

```text
Europe/Berlin
```

The dashboard reference date must be calculated in the configured application timezone.

Do not rely on the Lambda runtime's default timezone.

Store and compare `nextDue` as:

```text
YYYY-MM-DD
```

---

# Dashboard Classification

## Due Today

Definition:

```text
nextDue = referenceDate
```

---

## Overdue

Definition:

```text
nextDue < referenceDate
```

---

## Upcoming

Definition:

```text
referenceDate < nextDue <= referenceDate + 7 days
```

The reference date itself must not appear in Upcoming because it belongs to Due Today.

---

## Excluded Tenners

Exclude Tenners where:

```text
active = false
```

or:

```text
deletedAt != null
```

---

# Sorting Rules

## Due Today

Sort by:

```text
estimatedMinutes ascending

title ascending
```

---

## Overdue

Sort by:

```text
nextDue ascending

title ascending
```

The longest-overdue Tenners appear first.

---

## Upcoming

Sort by:

```text
nextDue ascending

estimatedMinutes ascending

title ascending
```

---

# Dashboard Summary

Return a summary object containing:

```text
referenceDate

timezone

dueTodayCount

overdueCount

upcomingCount

dueTodayMinutes

overdueMinutes

upcomingMinutes

totalActionableCount

totalActionableMinutes
```

---

## Actionable Definition

Actionable Tenners include:

```text
Due Today

Overdue
```

Upcoming Tenners are informational and must not be included in:

```text
totalActionableCount

totalActionableMinutes
```

---

# User Summary

Return workload grouped by assigned user.

Example:

```json
{
  "STEFAN": {
    "count": 3,
    "estimatedMinutes": 35
  },
  "JULIA": {
    "count": 2,
    "estimatedMinutes": 20
  }
}
```

The user summary must include actionable Tenners only:

```text
Due Today

Overdue
```

---

# Category Summary

Return actionable workload grouped by category.

Example:

```json
{
  "HOUSEHOLD": {
    "count": 3,
    "estimatedMinutes": 30
  },
  "FITNESS": {
    "count": 1,
    "estimatedMinutes": 45
  }
}
```

Categories without actionable Tenners may be omitted.

---

# Response

## Success

HTTP:

```text
200 OK
```

Example:

```json
{
  "success": true,
  "data": {
    "referenceDate": "2026-10-01",
    "timezone": "Europe/Berlin",
    "summary": {
      "dueTodayCount": 2,
      "overdueCount": 1,
      "upcomingCount": 2,
      "dueTodayMinutes": 20,
      "overdueMinutes": 15,
      "upcomingMinutes": 40,
      "totalActionableCount": 3,
      "totalActionableMinutes": 35
    },
    "dueToday": [
      {
        "tennerId": "tenner-001",
        "title": "Vacuum Office",
        "category": "HOUSEHOLD",
        "assignedTo": "STEFAN",
        "estimatedMinutes": 10,
        "nextDue": "2026-10-01"
      }
    ],
    "overdue": [
      {
        "tennerId": "tenner-002",
        "title": "Clean Front Door",
        "category": "HOME",
        "assignedTo": "STEFAN",
        "estimatedMinutes": 15,
        "nextDue": "2026-09-28",
        "overdueDays": 3
      }
    ],
    "upcoming": [
      {
        "tennerId": "tenner-003",
        "title": "Wash Car",
        "category": "HOME",
        "assignedTo": "JULIA",
        "estimatedMinutes": 20,
        "nextDue": "2026-10-04",
        "daysUntilDue": 3
      }
    ],
    "byUser": {
      "STEFAN": {
        "count": 2,
        "estimatedMinutes": 25
      }
    },
    "byCategory": {
      "HOUSEHOLD": {
        "count": 1,
        "estimatedMinutes": 10
      },
      "HOME": {
        "count": 1,
        "estimatedMinutes": 15
      }
    }
  }
}
```

---

# Empty Dashboard Response

When no matching Tenners exist, return:

```text
200 OK
```

Example:

```json
{
  "success": true,
  "data": {
    "referenceDate": "2026-10-01",
    "timezone": "Europe/Berlin",
    "summary": {
      "dueTodayCount": 0,
      "overdueCount": 0,
      "upcomingCount": 0,
      "dueTodayMinutes": 0,
      "overdueMinutes": 0,
      "upcomingMinutes": 0,
      "totalActionableCount": 0,
      "totalActionableMinutes": 0
    },
    "dueToday": [],
    "overdue": [],
    "upcoming": [],
    "byUser": {},
    "byCategory": {}
  }
}
```

---

# Validation Errors

Invalid query parameters must return:

```text
400 Bad Request
```

Example:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid dashboard query."
  }
}
```

Validate:

```text
assignedTo

category

date format

calendar date validity
```

Example invalid date:

```text
2026-02-30
```

---

# Data Access Strategy

Use:

```text
nextDue-index
```

to query active Tenners with:

```text
nextDue <= referenceDate + 7 days
```

Avoid a full table scan.

The service layer must classify the returned Tenners into:

```text
Due Today

Overdue

Upcoming
```

---

## Index Compatibility

If the current index does not support excluding inactive or deleted Tenners efficiently, filtering after the query is acceptable for the MVP.

Do not introduce a new index unless the existing access pattern cannot retrieve due and upcoming Tenners without scanning the base table.

Document any DynamoDB filtering behavior.

---

# Repository Layer

Create or extend:

```typescript
getDashboardCandidates(
  tenantId: string,
  endDate: string
): Promise<Tenner[]>
```

Responsibilities:

```text
Query DynamoDB

Use the nextDue index

Return candidate Tenners

Map database records
```

The repository must not calculate summaries or classify dashboard sections.

---

# Service Layer

Implement:

```typescript
getDashboard()
```

Responsibilities:

```text
Resolve Reference Date

Apply Timezone

Apply Optional Filters

Exclude Inactive Tenners

Exclude Deleted Tenners

Classify Results

Calculate Overdue Days

Calculate Days Until Due

Sort Dashboard Sections

Calculate Summary Metrics

Calculate User Summary

Calculate Category Summary
```

---

# DTOs

Create:

```typescript
DashboardRequest

DashboardResponse

DashboardTennerResponse

DashboardSummaryResponse

DashboardGroupSummary
```

---

# API Gateway and Routing

Add:

```text
GET /dashboard
```

Use the existing Tenner API Lambda.

Do not create an additional Lambda function.

---

# CORS

Ensure the dashboard endpoint is accessible from the Tenner frontend.

Use the existing centralized API Gateway CORS configuration.

Do not implement endpoint-specific wildcard CORS configuration.

---

# Logging

Log:

```text
Dashboard requested

Reference date

Applied filters

Due today count

Overdue count

Upcoming count

Total actionable minutes

Query duration
```

Do not log:

```text
AWS credentials

Tokens

Complete API Gateway events

Sensitive request headers
```

Use the existing structured logger and correlation ID.

---

# Metrics

Emit structured log events that can later support metrics for:

```text
Dashboard requests

Dashboard request duration

Dashboard errors

Actionable Tenner count

Overdue Tenner count
```

Do not create CloudWatch dashboards or alarms in this ticket.

---

# Performance Requirements

The dashboard must be served through one API request.

The frontend must not need separate calls for:

```text
Due Today

Overdue

Upcoming

Summary Metrics
```

Avoid:

```text
One DynamoDB request per Tenner

One query per dashboard section

Base table scans
```

---

# Testing Requirements

Create unit tests for:

```text
Dashboard With Mixed Tenners

Due Today Classification

Overdue Classification

Upcoming Classification

Eight-Days-Away Exclusion

Inactive Tenner Exclusion

Deleted Tenner Exclusion

Assigned User Filter

Category Filter

Combined Filters

Default Reference Date

Explicit Reference Date

Timezone Date Resolution

Invalid User

Invalid Category

Invalid Date Format

Invalid Calendar Date

Empty Dashboard

Section Sorting

Actionable Count Calculation

Actionable Minutes Calculation

User Summary Calculation

Category Summary Calculation

Repository Failure
```

---

## Date Boundary Tests

Test at least:

```text
UTC day differs from Europe/Berlin day

Daylight-saving transition

End of month

End of year

Leap year
```

Use deterministic clock and timezone mocks.

Do not use the real system clock directly in unit tests.

---

## Integration Tests

Verify:

```text
GET /dashboard routing works

Due records are retrieved through the expected index

Inactive and deleted records are excluded

The response matches the standard API contract
```

---

## Coverage

Minimum coverage for newly added code:

```text
80%
```

---

# Documentation

Update:

```text
docs/architecture.md

backend/README.md
```

Document:

```text
Dashboard read model

Date classifications

Application timezone

Actionable definition

DynamoDB access pattern

Sorting rules

Summary calculations
```

---

# Deliverables

Implement:

```text
GET /dashboard
```

Create or update:

```text
DashboardRequest

DashboardResponse

DashboardTennerResponse

DashboardSummaryResponse

DashboardGroupSummary

DashboardService

Tenner repository implementation

API routing

Configuration

Unit tests

Integration tests

Documentation
```

---

# Validation

The following must succeed:

```bash
terraform fmt -check

terraform validate

npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- `GET /dashboard` is implemented
- Due Today, Overdue and Upcoming sections are returned
- Only active, non-deleted Tenners are included
- Upcoming includes the next seven days and excludes today
- Optional user and category filters work
- Explicit reference date is supported
- Europe/Berlin is used as the 

---

## Implementation Status

Implemented: 2026-10-01.

### Deliverables

- [x] `GET /dashboard`: `src/handlers/dashboard.ts`, route in `src/index.ts` and `local.api_routes`
- [x] DTOs: `DashboardRequest`, `DashboardResponse`, `DashboardTennerResponse`, `DashboardSummaryResponse`, `DashboardGroupSummary`
- [x] `DashboardService.getDashboard()`: reference date, timezone, filters, exclusions, classification, day counts, sorting, summaries
- [x] Repository `getDashboardCandidates(tenantId, endDate)`: one Query on `nextDue-index`
- [x] Timezone configuration:
  - `APPLICATION_TIMEZONE` (`src/config.ts`, default `Europe/Berlin`)
  - `src/utils/timezone.ts`
  - Terraform `var.application_timezone` and Lambda environment variable
- [x] `AnalyticsService.getDashboard` now uses the final DTOs. The TICKET-008 placeholder `DashboardResponse` was replaced.
- [x] Documentation (`backend/README.md`, `docs/architecture.md`), TD-005 updated

### Acceptance Criteria (Testing Requirements)

All listed unit tests exist and pass:
- mixed Tenners; due today, overdue and upcoming classification; 8-days-away exclusion
- inactive exclusion, deleted exclusion
- user filter, category filter, combined filters
- default and explicit reference date (including future dates), timezone date resolution
- invalid user, invalid category, invalid date format, invalid calendar date (`2026-02-30`)
- empty dashboard, section sorting
- actionable count and minutes, user summary, category summary
- repository failure

**Date boundaries** (deterministic clock, explicit timezone, no system clock):
- UTC day differs from the Berlin day (summer and winter)
- DST start and end
- end of month, end of year, leap year

**Integration:**
- `GET /dashboard` routing and the standard contract are tested in `index.test.ts`.
- `nextDue-index` usage is checked in repository and wiring tests.
- Inactive and deleted Tenners are excluded both by the filter expression and in the service.
- The bundle ran against a fake DynamoDB endpoint: one `nextDue-index` Query, correct summary and `byUser`,
  and `2026-02-30` → 400.

Backend: 316 tests, 100% coverage. Terraform: 21 tests.

### Assumptions

- **Overall response:** `referenceDate` and `timezone` are top-level fields, as in the example response. They are
  not repeated inside `summary`.
- **Invalid `APPLICATION_TIMEZONE`:** falls back to `Europe/Berlin`. Terraform also validates the format.
- **CORS:** no central API Gateway CORS configuration exists yet. It comes with frontend hosting (TICKET-017),
  which configures it for the CloudFront origin, so it also applies to `/dashboard`. No endpoint-specific CORS was added.
- **Inconsistent "today":** the dashboard uses Berlin time, while `nextDue` calculation and list filters still use
  UTC (TD-005 updated, SCHEDULING-008).
- **Defensive filtering:** inactive and deleted Tenners are filtered in DynamoDB and again in the service.
