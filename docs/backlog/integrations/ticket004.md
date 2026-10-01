# INTEGRATION-004: Evaluate and Implement Garmin Connect Integration

## Type

Research + Backend Feature

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Complete fitness and wellbeing Tenners from Garmin Connect activities.

---

# Background

Garmin's Health/Activity APIs require acceptance into the Garmin Connect Developer
Program (business application). For a personal household app, approval is uncertain.

Many Garmin users already sync activities to Strava, which INTEGRATION-003 covers.

---

# Dependencies

```text
INTEGRATION-001
INTEGRATION-003
```

---

# Scope

## Phase 1: Evaluation (time-boxed: 1 day)

Document in the ticket:

```text
Program eligibility and terms
Data available (activities, sleep, stress, body battery)
Effort compared to the Strava path
Privacy implications (health data)
```

Decision: implement directly | rely on Strava sync | drop.

## Phase 2: Implementation (only if decided)

Reuse the activity rule model from INTEGRATION-003 with provider GARMIN.
Health data (sleep etc.) must not be stored; only derived completion events.

---

# Deliverables

```text
Evaluation and decision record
Implementation (conditional)
```

---

# Validation

Phase 2 only:

```bash
npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- Evaluation documented with decision
- If implemented: Garmin activities complete Tenners idempotently

---

# Definition of Done

- Garmin users have a documented path to auto-completion

---

# Out of Scope

- Storing raw health data
