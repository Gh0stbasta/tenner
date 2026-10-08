# REC-001: Missed Tenners disappear and count as not done

## Goal

A Tenner that nobody completes on its due day disappears instead of staying overdue. It comes back at its next
occurrence and shows up in the analytics as not done.

## Context

- **Who asked:** the owner (Erwachsener 1), 2026-10-08: „wenn tenner an einem tag nicht erledigt werden, sollten sie
  einfach verschwinden und halt in der Statistik als nicht erledigt auftauchen.“
- **Problem behind the wish:** overdue Tenners pile up on the dashboard and in Alexa answers, and the list never
  becomes empty.
- **Owner decision:** accepted (2026-10-08) for **all** Tenners, also rare ones. The owner chose this knowing that a
  yearly Tenner that is missed comes back only a year later.

## Requirements

- At the start of each household day, the notifier moves every active Tenner with a due date before today. This runs
  every 15 minutes and is idempotent. Paused Tenners and Tenners on vacation are left alone.
- The new due date is the Tenner's first scheduled occurrence on or after today, counted from the missed due date. It
  follows the interval and weekdays and is moved out of a household vacation.
- The miss is written atomically with the move as a history event: SKIP with `missed: true` and `missedCount`. It is
  attributed to the assignee. `lastCompleted` stays, a snooze is cleared, and `updatedBy` is `SYSTEM`.
- Analytics:
  - A missed occurrence is not excused like a deliberate skip, so consistency and the neglect score count it as not
    done.
  - The summary gets `missed` (occurrences in the period).
  - The analytics page shows „Nicht erledigt“ instead of „Jetzt überfällig“.
- A completion at the same moment wins. The move is skipped and logged as `MissedTennerSkipped`.
- A failure never stops the notifications: it is logged as `MissedTennersFailed` and retried in the next run.

## Acceptance Criteria

- [x] Daily, weekly, weekday, monthly and yearly Tenners move to their next occurrence (tested)
- [x] Several missed cycles are counted; the count is bounded (tested)
- [x] Paused Tenners, Tenners due today and concurrent changes are left alone (tested)
- [x] Vacation respected for the new due date (tested)
- [x] History event stored and read with `missed`/`missedCount`; plain skips unchanged (tested)
- [x] Analytics: missed occurrences counted, not excused; page shows „Nicht erledigt“ (tested)
- [x] Notifier runs the move before the jobs; failures isolated (tested)
- [x] IAM: notifier may update Tenners and put history items only (Terraform test)
- [x] Tests passing (backend, frontend; Terraform tests run in CI)

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented (TD-041)
- [x] Acceptance criteria verified
- [x] Git commit created

## Assumptions

- **Timing.** „Am Tag nicht erledigt“ means: not completed by the end of the due date in the household timezone.
  Between midnight and the next notifier run (at most 15 minutes) a Tenner can still show as overdue.
- **Existing overdue Tenners.** Tenners that are already overdue are moved by the first run after the deploy. All
  their passed occurrences count as missed.
- **Rotation.** A miss does not rotate the assignee; only a completion does.
- **Statistics date.** The miss counts on its first missed due date. If several cycles were missed at once, they all
  count in the period of that date.

## Out of Scope

- Removing the „Überfällig“ sections, overdue alerts and the Alexa overdue question. They are now normally empty;
  see TD-041.
- Showing missed occurrences in a Tenner's history list. Skips are not listed there either.

---

# Implementation Status

Done (2026-10-08).

- Backend:
  - `backend/src/services/missed-tenner.service.ts`: `nextDueAfterMiss`, `MissedTennerService.moveMissed`.
  - `backend/src/notifier.ts`: the move runs before the meal plans and the jobs; the result is `missedTenners`.
  - `backend/src/models/skip.ts` and `repositories/dynamodb/completion.mapper.ts`: `missed` and `missedCount`.
  - `backend/src/analytics/`: the `excused` skips filter and `summary.missed`.
- Frontend: `features/analytics/SummaryCards.tsx` („Nicht erledigt“), `api.ts` (`missed`).
- Terraform: `notifier.tf` statement `MoveMissedTenners`, tested in `tests/notifier.tftest.hcl`.
- Tests: `backend/tests/missed-tenners.test.ts`, `analytics-summary.test.ts`, `widget.test.ts` (notifier routing),
  `frontend/src/features/analytics/AnalyticsPage.test.tsx`.
