# BACKLOG-002 - Remove the Telegram Bot from the Backlog

## Goal

Remove INTEGRATION-002 (interactive Telegram bot), the last Telegram feature in the backlog.

## Context

BACKLOG-001 dropped the Telegram reminder channel (NOTIFICATION-006). INTEGRATION-002 depended on it and was kept
with a note until the owner decided. Owner decision 2026-10-06: „streichen“.

## Requirements

- Delete `docs/backlog/integrations/ticket002.md`; list it under "Removed Tickets" in the backlog index.
- Remove it from the roadmap's integration order.
- Mark INTEGRATION-001 (integration foundation) that Telegram is no longer a planned provider.

## Acceptance Criteria

- [x] Ticket file deleted; backlog index lists it under "Removed Tickets" with the reason
- [x] Roadmap: `INTEGRATION-001 → 006 → 003`; removal note names BACKLOG-002
- [x] INTEGRATION-001 carries a dated note
- [x] No open ticket depends on INTEGRATION-002 (reference search; NOTIFICATION-003 is implemented history)

## Definition of Done

- [x] Implementation completed
- [x] Tests completed (documentation only; reference search)
- [x] Documentation updated
- [x] Technical debt documented (none)
- [x] Acceptance criteria verified
- [x] Git commit created

## Assumptions

- Implemented tickets and earlier hotfix tickets that mention INTEGRATION-002 stay unchanged as history.

## Out of Scope

- Code cleanup of the dropped channels (CLEANUP-001).

## Implementation Status

Done (2026-10-06).
