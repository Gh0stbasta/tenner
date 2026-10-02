# INTEGRATION-006: Provide ICS Calendar Feed

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

Show due Tenners in any calendar app (Google Calendar, Outlook, Apple Calendar)
via a subscribable ICS feed.

---

# Background

A read-only ICS feed is the simplest calendar integration: no OAuth, works with all
calendar apps, and covers most of the value of the Google/Outlook ideas.

---

# Dependencies

```text
TICKET-016
SECURITY-004
```

---

# Scope

## Endpoint

```text
GET /calendar/{feedToken}.ics
```

- `feedToken`: random 32-byte token per user, stored hashed, revocable/regeneratable.
- Excluded from the JWT authorizer (calendar apps cannot send tokens); the feed token is the credential.
- Contains only Tenner titles and dates (no notes, no member emails).

## Content

- All-day events for the next occurrence of each active Tenner assigned to the user (option: whole household).
- Overdue Tenners shown on today with "(overdue)" suffix.
- Stable `UID` per Tenner occurrence; `DTSTAMP`, `SEQUENCE` updates.
- Optional: projected future occurrences for 30 days (marked tentative).

## Caching

`Cache-Control: max-age=900`. Calendar apps poll infrequently (Google: up to 24h; document).

## Frontend

Settings → Integrations → Calendar: copy feed URL, regenerate token, choose scope.

---

# Testing Requirements

```text
Valid ICS (RFC 5545) Output
Token Validation
Regenerated Token Invalidates Old
Overdue Representation
Scope: Own vs Household
No Sensitive Fields
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
ICS endpoint
Feed token management
Settings UI
Tests
Documentation
```

---

# Validation

```bash
npm run lint

npm run build

npm run test
```

Manual: subscribe in Google Calendar and Apple Calendar.

---

# Acceptance Criteria

- ICS feed works in major calendar apps
- Feed token revocable
- Only minimal data exposed
- Tests passing

---

# Definition of Done

- Due Tenners appear in users' calendars

---

# Out of Scope

- Two-way sync (INTEGRATION-007, 008)
