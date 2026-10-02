# INTEGRATION-005: Support Zwift Rides via Strava

## Type

Research + Configuration

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Support "Long Zwift Ride"-style Tenners being completed by Zwift activities.

---

# Background

Zwift has no public API for third-party developers. Zwift uploads rides to Strava
(as `VirtualRide`) and Garmin automatically.

---

# Dependencies

```text
INTEGRATION-003
```

---

# Scope

- Verify that Zwift → Strava uploads arrive as `VirtualRide` with correct durations.
- Add a "Zwift ride" preset rule in the Strava rule UI (VirtualRide, optional name contains "Zwift").
- Document setup in user documentation.
- Re-evaluate yearly whether Zwift offers an official API.

---

# Deliverables

```text
Rule preset
User documentation
Evaluation note
```

---

# Validation

```bash
npm run lint

npm run test
```

---

# Acceptance Criteria

- Zwift rides complete Tenners via Strava
- Preset available
- Documented

---

# Definition of Done

- Zwift users get auto-completion without a direct integration

---

# Out of Scope

- Unofficial/scraped Zwift APIs (terms of service risk)
