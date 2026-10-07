# HOUSEHOLD-ADMIN-003: Implement Household Settings

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

Provide server-side household-wide settings shared by all members.

```text
Household name
Timezone
Week start day
Workdays
Default Tenner values
```

---

# Background

FRONTEND-008 stores all settings in Local Storage, which means:

- Settings differ per device/browser.
- Backend jobs (notifications, analytics week buckets, timezone) cannot read them.

Personal UI preferences (theme, current user) may remain local.
Household-wide settings must be server-side.

---

# Dependencies

```text
FRONTEND-008
SCHEDULING-008
```

---

# Scope

## API

```text
GET /household
PUT /household
```

## Model

```json
{
  "name": "Schmidpeter Household",
  "timezone": "Europe/Berlin",
  "weekStartsOn": "MONDAY",
  "workdays": ["MON","TUE","WED","THU","FRI"],
  "defaults": {
    "category": "HOUSEHOLD",
    "estimatedMinutes": 10,
    "frequencyDays": 14
  }
}
```

## Storage

Single item per tenant in a configuration table.

## Migration From Local Storage

On first load after deployment, if the server has no household settings and
Local Storage contains Quick Add defaults, offer to upload them.

## Consumers

```text
SCHEDULING-008   timezone
ANALYTICS-002    week start
SCHEDULING-007   workdays
FRONTEND-006     Quick Add defaults
```

---

# Testing Requirements

```text
Default Settings
Update Settings
Validation (timezone, workdays, defaults ranges)
Local Storage Migration Offer
Consumers Read Server Settings
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Household settings API and storage
Settings UI split: Household vs Personal
Migration prompt
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

- Household settings stored server-side
- All devices see the same household settings
- Backend jobs can read settings
- Personal preferences remain local
- Tests passing

---

# Definition of Done

- Household configuration is consistent across devices
- Feature deploys through GitHub Actions

---

# Out of Scope

- Personal settings sync across devices (UX domain, future)
- Multiple households (FUTURE-001)

---

# Implementation Status

Implemented 2026-10-05.

- [x] Household settings stored server-side: `name`, `timezone`, `weekStartsOn`, `workdays`, `defaults` in the
  household item of `tenner-households` (single item per tenant); `GET /household` returns effective values,
  `PUT /household` accepts any subset with validation (timezone, workdays, default ranges, selectable category)
- [x] All devices see the same household settings: the settings page reads and writes them through the API;
  Quick Add and the create dialog use the household defaults
- [x] Backend jobs can read settings: `HouseholdService.settingsOf(tenantId)` returns the effective settings
  (timezone is already used everywhere; week start and workdays have no consumer yet — ANALYTICS-002, SCHEDULING-007)
- [x] Personal preferences remain local: default assignee, dashboard sections and theme (localStorage)
- [x] Local Storage migration offer: Quick Add defaults stored on a device are offered once ("Übernehmen" /
  "Verwerfen") while the household still uses the built-in defaults
- [x] Tests passing: backend 627 (defaults, update, validation, consumers read settings), frontend 291 (personal vs.
  household split, defaults saved on the server, migration offer accept/dismiss, name/week start/workdays),
  Terraform 51; lint and build clean
- [ ] Deploys through GitHub Actions: no infrastructure change; verified after merge

Decisions and assumptions:

- No new table: the existing household item already holds timezone, vacation, members and categories.
- `defaultsSource` (`DEFAULT`/`HOUSEHOLD`) tells the frontend whether to offer the migration.
- Numbers and the household name are saved when the field is left (not per keystroke) to avoid many writes.
- The default assignee stays personal ("Ich selbst" differs per person).
- Week start options: Monday or Sunday.
