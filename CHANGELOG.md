# Changelog

All notable changes to Tenner are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Every merge to `main` deploys to production. A release is a Git tag (`vX.Y.Z`) and an entry in this file.

## [Unreleased]

### Added

- **„Alexa, sag Butler Bruno Übersicht“:** opens the Tafel in the Echo Show's browser (APL `OpenURL`); where the
  device does not allow it, the screen shows the address (MAINT-023).
- **Tafel:** `/tafel` shows meals (today with large photos, or the week), today's Aufgaben and the shopping list full
  screen for the Echo Show browser; it refreshes itself (MAINT-022).
- **„Abgehakte Einträge löschen“:** one button removes all ticked entries from the shopping list; they stay
  „vorhanden“ for the week (MAINT-020).
- **Meal rule R14:** fish at most once a day — the planner, „Anderes Gericht“, the meal picker and swapping never put
  fish at lunch and dinner of the same day (MAINT-015).
- **Photo from the dashboard:** tap a dish picture in „Heute essen wir“ to take or choose a photo for that dish
  (MAINT-013).
- **Create a dish with a chat AI:** in the editor for a new dish, „KI-Prompt kopieren“ copies a prompt with the dish
  format and the ingredient catalog; „JSON übernehmen“ fills the editor from the AI's JSON answer (MAINT-012). The app
  itself calls no AI.

### Changed

- **Alexa shopping phrases:** „Alexa, sag Butler Bruno Milch, Eier und Butter“ adds up to five items at once;
  „Alexa, sag Butler Bruno Einkauf“ starts a shopping mode that asks „Noch etwas?“ until „nein“ or „fertig“
  (MAINT-018).
- **Alexa:** the skill is now called with „Butler Bruno“ („Alexa, sag Butler Bruno, …“). „Familien Zentrale“
  was confused with the public skill „Familienkalender“ (MAINT-017); „Mary Poppins“ was not found by Alexa+ on the Echo
  Show 21 (MAINT-025); „Zimmer Service“ was not
  found reliably on either Echo, probably because of Amazon's built-in hotel „Zimmerservice“ (MAINT-026).
- **Plus button by page:** on „Essen“ the plus button on the phone opens the editor for a new dish; elsewhere it
  still creates an Aufgabe (MAINT-008). On the shopping list it adds a shopping item (MAINT-010).
- **Copy the shopping list:** „Kopieren“ next to „Teilen“ puts the list as text on the clipboard, also on phones
  (MAINT-011).
- **„Für morgen einkaufen“:** names tomorrow's lunch and dinner in a small text line above the items (MAINT-009).

### Fixed

- **Shopping list widget:** shows the open items instead of a single bullet and follows changes; each item has a
  fixed line in the widget (package 1.1.0, MAINT-027).
- **Meal widget:** long dish names wrap onto up to three lines instead of being cut off (MAINT-024).
- **Deploy:** Alexa slot names without digits (`itemA` – `itemE`); Amazon rejected `item1` – `item5` and the
  deploy of MAINT-017 – 020 failed at the skill upload (MAINT-021).
- **Ticked items stay bought:** what is ticked off the shopping list in a week no longer comes back when the meal
  plan changes and the list is refreshed (MAINT-019).
- **Security:** zod updated to 4.6.7 in backend and frontend (GHSA-mrhx-c7xc-m3w5, high) (MAINT-016).
- **Pantry items in the shopping list:** salt, oil and other pantry items are normal entries of the generated list
  (sorted by section, in „Teilen“ / „Kopieren“, on the Echo Show widget, read out by Alexa and in the morning count)
  instead of a separate „Vorrat prüfen“ section (MAINT-014).
- **Meal plan order:** the days always run Monday – Sunday; today stays highlighted in its place instead of moving
  to the top (MAINT-007).

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

- Dishes without a photo keep the category placeholder; no stock or AI images (FOOD-024, ADR 0008). AI for meal
  planning is not decided yet (FOOD-020, ADR 0009 proposed, recheck 2026-12-07).
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
