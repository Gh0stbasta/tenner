# CLEANUP-001 - Remove the Dropped Notification Channels from the Code

## Goal

The code knows only the notification channels that exist: the internal log and Alexa.

## Context

BACKLOG-001 dropped e-mail, Telegram and push notifications from the backlog and recorded the leftover channel names
in the code as TD-037. Owner decision 2026-10-06: „code auch bereinigen“.

## Requirements

- Backend: `CHANNEL_TYPES` = `LOG`, `ALEXA`; `USER_CHANNELS` = `ALEXA`.
- Frontend: `USER_CHANNELS` and `CHANNEL_LABELS` = Alexa only.
- `GET /users/{userId}/notification-preferences` lists only Alexa as a channel; `PUT` rejects other channel names
  with 400.
- Tests, API documentation and TD-037 updated.

## Acceptance Criteria

- [x] No `EMAIL`, `TELEGRAM` or `WEB_PUSH` channel names in backend or frontend code and tests
- [x] Backend tests (863), lint and typecheck pass
- [x] Frontend tests (385), lint and typecheck pass
- [x] `backend/README.md` API table updated; TD-037 marked resolved

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented (TD-037 resolved)
- [x] Acceptance criteria verified
- [x] Git commit created

## Assumptions

- No stored preferences contain the removed channels: the API accepted only connected channels, and only Alexa
  could ever be connected. Reading stored preferences therefore cannot fail on the narrower enum.
- The backend and the frontend deploy together, so the narrower API response needs no compatibility period.

## Out of Scope

- Budget alert e-mails (`BUDGET_ALERT_EMAIL`) and alarm e-mails via SNS: infrastructure alerts, not user
  notification channels.

## Implementation Status

Done (2026-10-06).
