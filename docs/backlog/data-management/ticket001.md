# DATA-001: Implement Data Export

## Type

Full-Stack Feature

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Allow the household to export all its data in open formats.

```text
JSON  (complete, re-importable)
CSV   (Tenners, history — for spreadsheets)
```

---

# Background

Data portability protects users from lock-in, supports personal analysis and is a
GDPR right. FRONTEND-005 and FRONTEND-008 excluded import/export; FRONTEND-008
prepared the settings model for export.

---

# Dependencies

```text
TICKET-010
TICKET-020
SECURITY-004
```

---

# Scope

## Endpoint

```text
GET /export?format=json
GET /export?format=csv&entity=tenners|history
```

## JSON Format

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-10-01T18:00:00Z",
  "household": { ... },
  "members": [ ... ],
  "categories": [ ... ],
  "tenners": [ ... ],
  "history": [ ... ]
}
```

Includes soft-deleted Tenners (flagged). Excludes secrets, channel tokens and
notification logs.

## Size

For a household the export is small (< 5 MB). Stream directly from Lambda.
If the response exceeds API Gateway limits (10 MB), switch to S3 pre-signed URL
(document threshold; implement only if needed).

## CSV

RFC 4180, UTF-8 with BOM for Excel compatibility, ISO dates.
Formula-injection protection: prefix cells starting with `= + - @` with `'`.

## Frontend

Settings → Data → "Export JSON" / "Export CSV".

---

# Testing Requirements

```text
JSON Schema Completeness
CSV Escaping
CSV Formula Injection Protection
Soft-Deleted Included And Flagged
Secrets Excluded
Tenant Isolation
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Export endpoint
JSON schema documentation (docs/data-format.md)
Frontend buttons
Tests
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

- Full JSON export available
- CSV exports for Tenners and history available
- No secrets exported
- Format documented and versioned
- Tests passing

---

# Definition of Done

- Households own and can take their data
- Feature deploys through GitHub Actions

---

# Out of Scope

- Import (DATA-002)
- Scheduled exports (DATA-003)
