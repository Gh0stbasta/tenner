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
