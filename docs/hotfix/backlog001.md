# BACKLOG-001 - Remove Dropped Features from the Backlog

## Goal

Remove the features the owner decided not to build from the backlog, so the roadmap and dashboard show only real
plans.

## Context

On 2026-10-06 the owner dropped: push notifications on the phone, e-mail and Telegram reminders, and the "I have 10
minutes" suggestions ("nimm diese dinge mal komplett aus dem backlog raus"). Next feature: offline completion
(MOBILE-004).

## Requirements

- Delete the ticket files MOBILE-006, NOTIFICATION-005, NOTIFICATION-006, NOTIFICATION-007 and PRODUCTIVITY-001.
- Remove them from the backlog index and the roadmap; list them in a "Removed Tickets" section with the reason.
- Mark open tickets that depended on them, so nobody starts from a broken dependency.
- Move MOBILE-004 (offline completion) into the Phase 2 mobile order, because the owner wants it next.

## Acceptance Criteria

- [x] The five ticket files are deleted; `docs/backlog/README.md` lists them under "Removed Tickets"
- [x] `docs/roadmap.md`: reminders, mobile and productivity orders updated; SES row removed; MOBILE-004 moved
  from Phase 3 to Phase 2
- [x] Open dependents carry a dated note: INTEGRATION-002, FUTURE-007, FUTURE-009, AI-008, PRODUCTIVITY-002
- [x] `docs/architecture.md` notification channels updated; TD-037 records the leftover channel enums in the code
- [x] No remaining references to the removed IDs outside history (implemented tickets, ADRs, tickets' notes)

## Definition of Done

- [x] Implementation completed
- [x] Tests completed (documentation only; reference search across the repository)
- [x] Documentation updated
- [x] Technical debt documented (TD-037)
- [x] Acceptance criteria verified
- [x] Git commit created

## Assumptions

- Implemented tickets and ADRs that mention the removed IDs (NOTIFICATION-001/002, ALEXA-008, MOBILE-001,
  SECURITY-006, OBSERVABILITY-002, TICKET-022, ADR 0006) are history and stay unchanged.
- INTEGRATION-002 (interactive Telegram bot) stays in the backlog with a note. It cannot start without the removed
  Telegram channel, so it needs an owner decision.
- "Komplett raus" refers to the backlog. The unused channel enum values in the code are recorded as TD-037 and not
  removed here.

## Out of Scope

- Code changes (TD-037).
- Deciding INTEGRATION-002 and FUTURE-009.

## Implementation Status

Done (2026-10-06).
