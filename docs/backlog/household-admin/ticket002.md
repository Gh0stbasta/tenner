# HOUSEHOLD-ADMIN-002: Implement Category Management

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

Allow households to manage their own categories instead of the fixed list:

```text
HOUSEHOLD, FITNESS, FAMILY, HOME, PERSONAL, FINANCE
```

---

# Background

Categories drive filtering and analytics ("What areas of life am I neglecting?").
Households differ: a family with a garden needs GARDEN, a pet owner PETS.

---

# Dependencies

```text
TICKET-008
HOUSEHOLD-ADMIN-001 (pattern for configuration tables)
```

---

# Scope

## Storage

Store categories per tenant (new `tenner-categories` table or items in a shared
configuration table — choose the simpler option and document it).

```text
categoryId    immutable uppercase slug
name          display name
icon          one of a fixed icon set
color         fixed palette
sortOrder
archived      boolean
```

## Seed

Seed existing six categories idempotently.

## API

```text
GET  /categories
POST /categories
PUT  /categories/{categoryId}
```

Archiving instead of deleting: archived categories remain valid on existing Tenners
but cannot be chosen for new ones.

## Refactoring

Replace hardcoded category enums in backend validation, analytics and frontend.

## Frontend

Settings section "Categories": add, rename, reorder, archive.

---

# Testing Requirements

```text
Seed
Create Category
Duplicate Rejected
Archive Category
Archived Category On Existing Tenner
Archived Category Rejected For New Tenner
Analytics Use Dynamic Categories
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Category storage
Categories API
Refactored validation
Settings UI
Tests
Documentation
```

---

# Validation

```bash
terraform fmt -check

terraform validate

npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- Categories manageable per household
- Existing categories preserved
- No hardcoded category lists remain
- Archived categories handled correctly
- Tests passing

---

# Definition of Done

- Categories reflect the household's life areas
- Feature deploys through GitHub Actions

---

# Out of Scope

- Nested categories
- Tags in addition to categories

---

# Implementation Status

Implemented 2026-10-05.

- [x] Categories manageable per household: `GET/POST /categories`, `PUT /categories/{categoryId}`; Settings →
  "Kategorien" with add, rename, icon, color, reorder (up/down) and archive/restore
- [x] Existing categories preserved: the six original categories are the seed (read-time default, idempotent)
- [x] No hardcoded category lists remain: validation, dashboard workload, filters, form, Quick Add defaults,
  vacation categories and all labels use the managed categories (the seed is the only constant; the Quick Add
  keyword table still covers the seed categories, TD-030)
- [x] Archived categories handled: they stay on existing Tenners (shown, edit form keeps them as disabled option),
  in filters and analytics, but are rejected for new Tenners and category changes (400)
- [x] Tests passing: backend 614 (seed, create, duplicate rejected, archive, archived on existing Tenner, archived
  rejected for new Tenner, dynamic analytics grouping, reorder), frontend 285, Terraform 51; lint and build clean
- [ ] Deploys through GitHub Actions: new API routes only; verified after merge

Decisions and assumptions:

- Storage: list in the household item of `tenner-households`, same as members (the ticket allowed "the simpler
  option"); optimistic locking with `categoriesVersion`.
- Reorder: `PUT` with `sortOrder` = new position; the service renumbers all categories (one request per move).
- An archived default category in the user preferences falls back to the first selectable category.
- At most 30 categories; colors reuse the member palette; icons are a fixed set of 12.

Technical debt: TD-007 resolved; TD-030 added.
