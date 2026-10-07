# BACKLOG-003 - Close the Feature Backlog after Release 1.0

## Goal

Remove every open feature ticket from the backlog. Tenner is feature-complete with release 1.0 and moves to
maintenance and user recommendations.

## Context

On 2026-10-07 the owner decided after reviewing the AI tickets: "eigentlich kann der ganze rest weg … entferne die
tickets aus dem backlog für die restlichen features, wir betrachten das projekt 10-minute-tenner jetzt als
abgeschlossen und begeben uns in den maintenance und user-recommendations betrieb."

At that point 103 tickets were implemented and 68 feature tickets plus the duplicate TICKET-003 file were open.

## Requirements

- Delete the 68 open ticket files (all tickets without an "Implementation Status" section), including the whole
  `ai/`, `integrations/`, `productivity/` and `ux/` (open part) groups and the `future/` evaluations.
- Delete the duplicate TICKET-003 file `infra/ticket004.md` (TD-001).
- List every removed ticket in the "Removed Tickets" section of the backlog index with the reason.
- Remove them from the index tables and the roadmap.
- Live documentation and code comments must not announce removed tickets as planned work. ADRs and implemented
  tickets are history and stay unchanged.
- The risks that the removed tickets would have closed stay visible: record them as technical debt.

## Acceptance Criteria

- [x] 69 files deleted (68 open tickets and the TICKET-003 duplicate); the index lists only implemented tickets
- [x] "Removed Tickets" lists all 68 IDs with the reason "Not planned after release 1.0 (BACKLOG-003)"
- [x] `docs/roadmap.md` shows no open phases; the project is closed with release 1.0
- [x] Code comments, `docs/architecture.md`, `docs/analytics.md`, `docs/security.md`, `README.md`,
  `docs/technical-debt.md` and `terraform/environments/prod/README.md` no longer present removed tickets as planned
- [x] Technical debt: TD-001 resolved; TD-039 (backup restore never tested) and TD-040 (production is the only
  environment) added
- [x] Backend, frontend and Terraform checks still pass (only comments changed in code)

## Definition of Done

- [x] Implementation completed
- [x] Tests completed (reference search; backend and frontend lint, Terraform fmt)
- [x] Documentation updated
- [x] Technical debt documented (TD-039, TD-040)
- [x] Acceptance criteria verified
- [x] Git commit created

## Assumptions

- "Der ganze Rest" means every open ticket, including the operations and security tickets (backup test, environment
  separation, scanning). Their risks are kept as technical debt so they can come back as maintenance tickets.
- Ticket IDs in existing technical-debt entries stay as the name of the change that would fix the debt; a note at
  the top of `docs/technical-debt.md` says these tickets are not planned.
- The owner input files in `docs/human/` were implemented (HOUSEHOLD-ADMIN-006, DATA-008, NOTIFICATION-009 – 011);
  they move with the release archive (RELEASE-001), not here.

## Out of Scope

- Moving the implemented tickets into the release folder (RELEASE-001).
- Fixing any of the technical debt.

## Implementation Status

Done (2026-10-07).
