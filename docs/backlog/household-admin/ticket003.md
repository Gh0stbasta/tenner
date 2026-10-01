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
