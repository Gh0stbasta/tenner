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

- [ ] Plan subscribable in Google and Apple Calendar
- [ ] Changes appear after the calendar's refresh
- [ ] Token revocable; no health data in the feed
- [ ] Tests passing

---

# Definition of Done

- [ ] Implementation completed
- [ ] Tests completed
- [ ] Documentation updated (security.md: public route)
- [ ] Technical debt documented
- [ ] Acceptance criteria verified
- [ ] Git commit created

---

# Assumptions

- Calendar apps refresh subscribed feeds on their own schedule (Google: up to 24 hours); the UI says so.
- Whoever has the URL can read the meal names; acceptable for meal names, documented in `docs/security.md`.

---

# Out of Scope

- Writing into calendars (Google Calendar API), Tenners in the feed.
