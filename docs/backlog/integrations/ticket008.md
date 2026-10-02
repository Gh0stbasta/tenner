# INTEGRATION-008: Implement Outlook Calendar Integration

## Type

Backend Feature

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Provide the same availability features as INTEGRATION-007 for Microsoft 365 / Outlook
calendars via Microsoft Graph.

---

# Background

Work calendars are often in Outlook. Microsoft Graph supports `Calendars.ReadBasic`
and `getSchedule` (free/busy).

Work tenants may block third-party app consent; document this limitation.

---

# Dependencies

```text
INTEGRATION-007
```

---

# Scope

- Azure app registration (manual, documented; client secret per SECURITY-006).
- OAuth with minimal scopes (`Calendars.ReadBasic`, `offline_access`).
- Reuse busy-day model and vacation suggestion from INTEGRATION-007 through a common
  `CalendarAvailabilityProvider` interface.

---

# Deliverables

```text
Outlook provider
Provider interface refactoring
Setup documentation
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

- Outlook calendars provide busy-day data
- Shared provider interface used
- Tenant consent limitations documented
- Tests passing

---

# Definition of Done

- Outlook users get the same planning support as Google users

---

# Out of Scope

- Exchange on-premises
