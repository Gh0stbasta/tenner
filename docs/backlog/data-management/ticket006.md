# DATA-006: Establish Schema Versioning and Data Migrations

## Type

Backend Architecture

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Introduce a consistent strategy for evolving the DynamoDB item schema so that
new fields (frequencyUnit, importance, checklist, weekdays, ...) can be added safely.

---

# Background

Many V2 tickets extend the Tenner item. Without a strategy, each ticket invents its own
defaulting and backfill approach, and old items may break new code.

---

# Dependencies

```text
TICKET-008
OPERATIONS-007
```

---

# Scope

## Rules

```text
1. Additive changes only (new optional attributes); never rename in place
2. Read path applies defaults for missing attributes (single mapper function per entity)
3. Items carry schemaVersion (number); mapper upgrades in memory
4. Backfills are optional, idempotent, run via OPERATIONS-007 framework
5. Removing an attribute requires two releases: stop reading → stop writing → cleanup
```

## Implementation

- Add `schemaVersion` to Tenner and history items (default 1 when absent).
- Central `mapTennerItem()` / `mapHistoryItem()` with version upgrade steps.
- Migration registry documenting each version change.

## Documentation

`docs/data-migrations.md` with rules and the registry.

---

# Testing Requirements

```text
Mapping Of Version-Less Item
Upgrade Chain
Unknown Future Version Handling (reject or pass-through, documented)
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Mappers with versioning
Migration registry
Documentation
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

- Schema evolution rules documented
- Central mappers with defaults exist
- schemaVersion handled
- Tests passing

---

# Definition of Done

- Data model can evolve without breaking existing data

---

# Out of Scope

- Table redesign
