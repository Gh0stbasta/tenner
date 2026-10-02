# DATA-002: Implement Data Import

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

Allow importing Tenners in bulk from a JSON export (DATA-001) or a simple CSV file.

---

# Background

"Bulk Import" was excluded from FRONTEND-006. Import enables migration from
spreadsheets or other apps and restoring a household from an export.

---

# Dependencies

```text
DATA-001
TICKET-009
```

---

# Scope

## Modes

```text
Tenners CSV  (title, category, frequency, estimatedMinutes, assignedTo)
Full JSON    (Tenners + history), only into an empty household
```

## Flow

```text
1. Upload file (client-side parse)
2. Preview with validation results per row
3. Choose: skip invalid rows | abort
4. Import via POST /import (batched, max 500 items/request)
5. Summary
```

## Rules

- Validation identical to the Create API (shared validators).
- History import only into empty households (avoid mixing timelines).
- Imported items get new IDs; JSON imports keep a mapping for history references.
- Idempotency key per import to avoid duplicates on retry.
- File size limit 5 MB.

---

# Testing Requirements

```text
Valid CSV
Invalid Rows Reported
Abort Mode
Skip Mode
JSON Full Import Into Empty Household
JSON Import Rejected For Non-Empty Household
Idempotent Retry
Size Limit
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Import endpoint
Import wizard UI
CSV template download
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

- CSV and JSON import supported
- Preview with validation
- Duplicates prevented on retry
- Tests passing

---

# Definition of Done

- Households can bring existing data into Tenner
- Feature deploys through GitHub Actions

---

# Out of Scope

- Import from third-party apps' proprietary formats
