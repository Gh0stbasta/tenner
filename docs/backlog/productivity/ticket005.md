# PRODUCTIVITY-005: Implement Bulk Actions

## Type

Full-Stack Feature

---

## Priority

Low

---

## Phase

V2

---

## Goal

Allow users to act on multiple Tenners at once in the Tenner Management Page:

```text
Complete selected
Snooze selected
Reassign selected
Change category of selected
Deactivate selected
```

---

# Background

"Bulk Update Operations" were excluded from TICKET-011 and "Bulk Editing" from FRONTEND-005.

After a busy Saturday, completing ten Tenners one by one is tedious.
When a household member is away, reassigning their Tenners one by one is error prone.

---

# Dependencies

```text
FRONTEND-003
TICKET-011
TICKET-013
SCHEDULING-003
```

---

# Scope

## Backend

```text
POST /tenners/bulk
```

```json
{
  "action": "COMPLETE | SNOOZE | REASSIGN | SET_CATEGORY | DEACTIVATE",
  "tennerIds": ["tenner-001", "tenner-002"],
  "params": { "completedBy": "STEFAN" }
}
```

Rules:

```text
max 25 Tenners per request
each item processed with the same rules as the single-item endpoint
partial success allowed; per-item results returned
```

Response:

```json
{
  "success": true,
  "data": {
    "results": [
      { "tennerId": "tenner-001", "status": "OK" },
      { "tennerId": "tenner-002", "status": "ERROR", "code": "TENNER_INACTIVE" }
    ]
  }
}
```

Reuse existing service methods; do not duplicate business rules.

## Frontend

- Selection checkboxes in Tenner list.
- Bulk action toolbar with confirmation for destructive actions.
- Result summary toast ("8 completed, 2 failed").

---

# Testing Requirements

```text
Each Action Type
Limit Enforcement
Partial Failure Reporting
Rules Identical To Single Endpoints
Selection UI
Confirmation Dialog
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Bulk endpoint
Selection UI and toolbar
Tests
Documentation
```

---

# Validation

```bash
npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- Bulk endpoint supports all listed actions
- Partial failures reported per item
- UI supports selection and confirmation
- Tests passing

---

# Definition of Done

- Multi-Tenner maintenance is efficient
- Feature deploys through GitHub Actions

---

# Out of Scope

- Bulk delete (hard delete)
- Bulk import (DATA-002)
