# Changelog

All notable changes to Tenner are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Every merge to `main` deploys to production. A release is a Git tag (`vX.Y.Z`) and an entry in this file.

## [Unreleased]

Nothing yet.

## [2.0.0] - 2026-10-10

Family meal planning. The app is now called **Zentrale**: a weekly lunch and dinner plan that follows the family's
rules, a shopping list, today's meals on the phone, in the calendar, by voice and on the Echo Show — deterministic,
without AI. Overview: [`docs/release-2.0/README.md`](docs/release-2.0/README.md). All tickets:
[`docs/release-2.0/backlog/food/`](docs/release-2.0/backlog/food/).

### Added

- **Dishes and ingredients:** 105 reference ingredients with allergens, protein and base, nutrition and price; a
  61-dish family catalog imported in one click; dish editor with live rule hints, photos (camera or gallery),
  nutrition and cost estimates (FOOD-001 – 003, 010 – 013, 021).
- **Family food profile and rules:** eaters with allergies, diets, dislikes and portion factors; household rules
  R1 – R13 (allergies, vegetarian, cooking time, chicken days, light weekday lunch …) (FOOD-004, 005).
- **Weekly plan:** planned automatically for this and next week; replace one meal, choose, swap, lock, regenerate
  the week; day calories and week cost in the plan; what was really eaten with 👍 / 👎 and favorites, which the planner
  learns from (FOOD-006 – 009, 022, 023).
- **Shopping list:** own menu entry, counts instead of grams, own order by drag and drop, offline in the shop, by
  voice and as an Echo Show widget (FOOD-014, 026 – 028).
- **Everywhere:** morning notification „Essensplan am Morgen“ (push and Alexa), „Alexa, frag Familien Zentrale, was es heute gibt“
  and meals in the daily briefing, Echo Show meal widget, subscribable calendar feed (ICS) (FOOD-015 – 018).
- **Analytics:** tab „Essen“ with protein sources, vegetarian share, favorites, cost per week, variety and plan
  adherence (FOOD-019).
- **Aufgaben:** start date for new Aufgaben (HOTFIX-006); dashboard focused on the day: meals, today's Aufgaben,
  shopping for tomorrow (UI-001).

### Changed

- Renamed to „Zentrale“; Tenners are called „Aufgaben“ in the UI; Alexa invocation „Familien Zentrale“ (REC-002).
- Aufgaben not done on their day disappear and count as „Nicht erledigt“ in the analytics (REC-001).
- Alexa skill without Echo Show views; widgets on the home screen instead (MAINT-002 – 006); Alexa API calls share a
  time budget with one retry (MAINT-001).

### Security

- Dish photos in a private S3 bucket behind CloudFront (Origin Access Control), presigned uploads limited in type,
  size and key; public calendar feed authorized by a 256-bit token stored as a hash; allergies never logged or sent
  in notifications (FOOD-011, 015, `docs/security.md`).

### Known Limitations

- Not decided yet: stock or AI images for dishes without a photo (FOOD-024, ADR 0008 proposed) and AI for meal
  planning (FOOD-020, ADR 0009 proposed, recheck 2026-12-07).
- The API access log records the calendar token in the path (TD-047); unattached photo uploads stay in the bucket
  (TD-045). Full list: [`docs/technical-debt.md`](docs/technical-debt.md).

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
