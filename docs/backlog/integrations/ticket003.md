# INTEGRATION-003: Implement Strava Activity Auto-Completion

## Type

Backend Feature

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Automatically complete fitness Tenners when a matching activity is recorded in Strava.

```text
Zone 2 Ride ← Strava Ride ≥ 45 min
Long Zwift Ride ← Strava VirtualRide ≥ 90 min
Mobility Workout ← Strava Yoga / Workout ≥ 15 min
```

---

# Background

Fitness Tenners are already tracked by sports apps; recording them twice is friction.
Strava offers OAuth and webhooks (push subscriptions) for new activities.

---

# Dependencies

```text
INTEGRATION-001
TICKET-013
```

---

# Scope

## Connection

OAuth with scope `activity:read` (or `activity:read_all` only if private activities must
be matched — user choice, default minimal).

## Webhook

- Single Strava push subscription for the app.
- Handle `create` events for activities: fetch activity details, evaluate rules.
- Handle `athlete deauthorize` events: mark connection revoked.

## Rules

Configured per Tenner in the detail page:

```text
Activity types (Ride, VirtualRide, Run, Yoga, WeightTraining, ...)
Minimum duration
```

## Completion

- `completedAt` = activity start time + elapsed time.
- `actualMinutes` = moving time.
- `completedBy` = connected user.
- Idempotency key = `strava:<activityId>:<tennerId>`.
- Only one Tenner completion per activity per Tenner; an activity may complete multiple Tenners
  only if explicitly configured.

## Rate Limits

Respect Strava API limits (track headers, back off).

---

# Testing Requirements

```text
Rule Matching
Duration Threshold
Idempotent Webhook Retry
Deauthorization
Rate Limit Backoff
Completion Fields Mapping
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Strava provider
Webhook subscription setup documentation
Rule UI on Tenner detail
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

- Users can connect Strava
- Matching activities complete Tenners automatically
- No duplicate completions
- Deauthorization handled
- Tests passing

---

# Definition of Done

- Fitness Tenners complete themselves

---

# Out of Scope

- Writing data to Strava
- Historical activity backfill (may follow)
