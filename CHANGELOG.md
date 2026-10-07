# Changelog

All notable changes to Tenner are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Every merge to `main` deploys to production. A release is a Git tag (`vX.Y.Z`) and an entry in this file.

## [Unreleased]

Nothing yet. Since 1.0.0 the project is in maintenance; see [`docs/backlog/README.md`](docs/backlog/README.md).

## [1.0.0] - 2026-10-07

First release. Tenner is feature-complete for one household: a German web app (installable on phones), an Alexa
skill with an Echo Show dashboard, and reminders via push and Alexa. Overview with figures and diagrams:
[`docs/release-1.0/README.md`](docs/release-1.0/README.md). All tickets: [`docs/release-1.0/`](docs/release-1.0/).

### Added

- **Tenners:** create, edit, Quick Add, complete with undo, archive and restore, detail page with history
  (TICKET-008 – 020, 024, FRONTEND-001 – 007, 009).
- **Scheduling:** timezone-aware due dates, calendar frequencies (days to years), weekdays, snooze, skip, pause and
  vacation mode (SCHEDULING-001 – 005, 008).
- **Household:** members (also without login, e.g. household help), categories, household settings, member
  deactivation, shared and rotating Tenners, temporary handover (HOUSEHOLD-001, 002, 004,
  HOUSEHOLD-ADMIN-001 – 004, 006).
- **Household task catalog:** 34 recurring Tenners imported in one click, idempotent (DATA-008).
- **Analytics:** trends, members, categories, time investment, neglected Tenners, household balance, habits and an
  analytics page (ANALYTICS-001 – 009).
- **Settings:** personal defaults, dashboard sections, light/dark theme (FRONTEND-008).
- **Phone app:** installable PWA, app-shell caching, touch navigation with swipe to complete, offline reading and
  offline completion with sync (MOBILE-001 – 005).
- **Reminders:** daily digest and overdue alerts per member; browser push with one notification per Tenner and the
  actions „Erledigt“ and „Später“ (NOTIFICATION-001 – 004, 009 – 011).
- **Alexa „Tenner Board“:** account linking, today's Tenners and completion by voice, daily briefing, Echo Show
  dashboard and home-screen widget, Alexa notifications and reminders, private skill (ALEXA-001 – 010).
- **Sign-in:** Google sign-in via Cognito, one household per account, identity-based authorization
  (SECURITY-001 – 004, FUTURE-011, HOTFIX-001).
- **Operations:** CI/CD with GitHub OIDC, Terraform with remote state and tag governance, smoke tests, cost budget
  and anomaly detection, CloudWatch dashboard and alarms with e-mail, API throttling, secrets in Parameter Store,
  dependency scanning (TICKET-001 – 007, 017, 018, 023, OPERATIONS-001, 006, OBSERVABILITY-001, 002,
  SECURITY-005 – 007, 014).

### Fixed

- Deploy fixes after the first production runs: AWS tag characters, Dependabot validation, CloudWatch dashboard
  metric format, Alexa manifest permission, Alexa test enablement and simulator outages (TICKET-023,
  HOTFIX-002 – 006).

### Removed

- Not built and removed from the backlog: e-mail and Telegram reminders, the Telegram bot, "I have X minutes"
  suggestions (BACKLOG-001, BACKLOG-002, CLEANUP-001) and every other open feature ticket (BACKLOG-003).

### Known Limitations

- Backup restore was never tested (TD-039); production is the only environment (TD-040).
- Anyone with a Google account can claim a newly added member until that person signs in (TD-020).
- Full list: [`docs/technical-debt.md`](docs/technical-debt.md).

[Unreleased]: https://github.com/Gh0stbasta/tenner/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Gh0stbasta/tenner/releases/tag/v1.0.0
