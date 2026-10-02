# TICKET-024: List Archived (Soft-Deleted) Tenners

## Type

Backend API

---

## Priority

High

---

## Phase

MVP

---

## Goal

`GET /tenners` can return archived (soft-deleted) Tenners, so the Tenner Management Page
(FRONTEND-003) can show an "Archived" view with a Restore action.

---

# Background

FRONTEND-003 requires a status filter `Active / Archived / All` and a Restore action for
archived Tenners. "Archive" uses the soft delete (`DELETE /tenners/{id}`, TICKET-012), and
`POST /tenners/{id}/restore` (TICKET-015) restores them. However, `GET /tenners` always excludes
deleted Tenners, so the frontend cannot list them. The repository already has an `includeDeleted`
criterion, but the API does not expose a way to list deleted Tenners.

---

# Dependencies

```text
TICKET-010  (GET /tenners)
TICKET-012  (soft delete)
TICKET-015  (restore)
```

---

# Requirements

- New query parameter `deleted` (`true` / `false`) on `GET /tenners`.
- `deleted=true` returns only soft-deleted Tenners. The `active=true` default does not apply,
  because deleted Tenners are inactive. An explicit `active` value still filters.
- Without the parameter or with `deleted=false`, behaviour is unchanged (deleted Tenners excluded).
- Still a DynamoDB Query on the tenant partition, never a Scan.
- Unknown values (e.g. `deleted=yes`) are rejected with 400.

---

# Acceptance Criteria

- [x] `GET /tenners?deleted=true` returns only soft-deleted Tenners
- [x] Default behaviour unchanged
- [x] Other filters (user, category, due, sorting) combine with `deleted=true`
- [x] Invalid values rejected with 400
- [x] Tests cover query building, service defaults and request parsing
- [x] Backend README updated

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented (none new)
- [x] Acceptance criteria verified
- [x] Git commit created

---

# Assumptions

- "Archived" in the frontend means soft-deleted. Inactive (`active=false`, not deleted) Tenners are a
  separate state that is toggled in the Edit dialog (FRONTEND-005).
- No pagination is needed (small household volume, same as TICKET-010).

---

# Out of Scope

- Permanent deletion
- Pagination of `GET /tenners`

---

# Implementation Status

- `TennerCriteria.onlyDeleted` and the filter `NOT (attribute_not_exists(#deletedAt) OR #deletedAt = :null)`
  in `buildTennerQuery`.
- `ListTennersRequest.deleted`, validated by `listTennersQuerySchema`; `ListTennersService` skips the
  `active` default for `deleted=true`.
- Tests: 7 new (query builder, service, request parsing). Backend: lint, 369 tests (99.8% coverage), build.
- No infrastructure or IAM change (same Query on the same table and indexes).
