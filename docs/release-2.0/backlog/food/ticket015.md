# FOOD-015: Meal Calendar Feed (ICS)

## Type

Full-Stack Feature

---

## Priority

Low

---

## Phase

2.0 Extended

---

## Goal

The meal plan appears in the family's calendar apps (Google, Apple, Outlook) as read-only entries, updated
automatically.

---

# Background

Owner breakdown FOOD-015 „Calendar Integration“. A subscribed ICS feed works with every calendar app without OAuth
and without a new AWS service (ADR 0007). INTEGRATION-006 (ICS feed for Tenners) was removed in release 1.0; this
ticket covers meals only.

---

# Dependencies

```text
FOOD-006
FOOD-004 (meal times)
```

---

# Scope

## Feed

```text
GET /meals/calendar/{token}.ics   (public route, no JWT)
```

- Events for the current and the next week: „🍽️ Mittag: Onigiri“ at the household's lunch time, „🍽️ Abend:
  Lasagne“ at dinner time, 30 minutes, description with active time and vegetarian variant.
- Stable UIDs per slot, so calendar apps update instead of duplicating; `REFRESH-INTERVAL` / `X-PUBLISHED-TTL`
  6 hours.
- No allergy or profile data in the feed.

## Token

- Settings → Essen → „Kalender abonnieren“: create token (shown once as URL with copy button and instructions for
  Google and Apple), revoke and recreate.
- Stored as SHA-256 hash; 256-bit random token; unknown or revoked token → 404 (no difference visible).
- The route is added to the public routes; API throttling applies (SECURITY-014).

---

# Testing Requirements

```text
ICS valid (RFC 5545: line folding, escaping, UTC/TZID)
Stable UIDs across plan changes
Token create, revoke, hash storage; unknown token → 404
No profile data in the feed
Terraform: route public, others still protected
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
ICS endpoint and token management
Settings section
Tests
```

---

# Validation

```bash
cd backend && npm run lint && npm run typecheck && npm test
cd frontend && npm run lint && npm run build && npm test
cd terraform && terraform test
```

---

# Acceptance Criteria

- [x] Plan subscribable in Google and Apple Calendar
- [x] Changes appear after the calendar's refresh
- [x] Token revocable; no health data in the feed
- [x] Tests passing

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated (security.md: public route)
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

---

# Assumptions

- Calendar apps refresh subscribed feeds on their own schedule (Google: up to 24 hours); the UI says so.
- Whoever has the URL can read the meal names; acceptable for meal names, documented in `docs/security.md`.
- The token carries the household: `<tenantId>.<secret>` (the public route has no login to tell the tenant). One link
  per household; a new link replaces the old one.
- Times are written in UTC (no VTIMEZONE block); calendar apps show them in local time. Skipped meals are left out.
- „Subscribable in Google and Apple“ is verified by RFC 5545 tests (folding, escaping, UTC, UIDs); a real subscription
  is the owner's check after the deploy.

---

# Out of Scope

- Writing into calendars (Google Calendar API), Tenners in the feed.

---

# Implementation Status

Done (2026-10-10).

- Backend: `src/meals/calendar.ts` (ICS builder with escaping and folding), `services/calendar-feed.service.ts`
  (token create/revoke/status, hash storage, constant-time check, feed), `handlers/calendar.ts`, routes
  `GET/POST/DELETE /meals/calendar` and public `GET /meals/calendar/{token}`, item kind `CALENDAR`.
- Terraform: four routes, the feed in `api_public_routes` (no JWT); tests check that only the feed is public.
- Frontend: `MealCalendarSettings.tsx` in Settings („Essen: Kalender“): create, show once, copy, `webcal:` link,
  replace, revoke, instructions.
- Tests: `backend/tests/meals-calendar.test.ts` (escaping, folding, times across DST, UIDs stable after a regenerate,
  token hash, unknown/malformed/other-tenant/replaced/revoked → 404, no profile data), route tests;
  `terraform/tests/api.tftest.hcl`, `auth.tftest.hcl`; frontend `MealCalendarSettings.test.tsx`.
- Validation: backend lint, typecheck, 1,129 tests; frontend lint, typecheck, build, 493 tests; Terraform api and
  auth tests.
- Owner check after the deploy: create the link in Settings and subscribe in Google or Apple Calendar.
- Technical debt: TD-047 (the access log records the token in the path).

