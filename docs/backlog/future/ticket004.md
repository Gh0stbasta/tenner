# FUTURE-004: Implement Tenner Templates

## Type

Product Feature (Postponed)

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Provide reusable, curated template packs that create a set of Tenners at once.

```text
"New Homeowner" · "Cyclist" · "Family with Toddler" · "Car Owner" · "Garden"
```

---

# Background

UX-001 ships a static starter set for onboarding. Templates generalize this into a
versioned catalog that can be applied at any time. Excluded from FRONTEND-006.

---

# Dependencies

```text
UX-001
PRODUCTIVITY-005
```

---

# Scope

- Template model: id, name, description, version, items (Tenner drafts).
- Catalog stored as versioned JSON in the repository (no admin UI).
- Apply flow: preview, select items, adjust assignment, spread due dates.
- Applied templates recorded so the UI can show "already applied".
- Save own Tenners as a personal template (export subset).

---

# Deliverables

```text
Template catalog
Apply flow
Save-as-template
Tests
```

---

# Acceptance Criteria

- Templates can be browsed and applied
- Due dates spread on apply
- Own templates can be created

---

# Definition of Done

- Common Tenner sets can be set up in seconds

---

# Out of Scope

- Sharing between households (FUTURE-005)
