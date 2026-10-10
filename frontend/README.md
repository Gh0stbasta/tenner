# Tenner Frontend

React single-page application for Tenner (FRONTEND-001). The user interface is German.
It is hosted in S3 behind CloudFront (TICKET-017) and deployed by `deploy.yml` (TICKET-018).

## Commands

```bash
npm ci
npm run dev           # local dev server (needs VITE_API_BASE_URL, see below)
npm run lint          # ESLint, zero warnings allowed
npm run format:check  # Prettier
npm test              # Vitest + React Testing Library, coverage threshold 80%
npm run build         # type check + production build → dist/
```

## Configuration

| Variable                  | Meaning                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`       | API stage URL without trailing slash, e.g. `https://<id>.execute-api.eu-central-1.amazonaws.com/prod` |
| `VITE_COGNITO_ISSUER_URL` | Cognito user pool issuer (Terraform output `cognito_issuer_url`)                                      |
| `VITE_COGNITO_CLIENT_ID`  | Public app client ID (`cognito_client_id`)                                                            |
| `VITE_COGNITO_LOGIN_URL`  | Managed login domain (`cognito_login_url`), used for logout                                           |

`deploy.yml` sets them from the Terraform outputs. Without the Cognito values the app shows
"Anmeldung nicht eingerichtet". Copy `.env.example` to `.env.local` for
local development. The API only allows the CloudFront origin (CORS), so a local dev server cannot call
the deployed API directly; tests use a fetch mock instead.

FRONTEND-001 names the variable `VITE_API_URL`; the frontend uses `VITE_API_BASE_URL` because the
deploy workflow (TICKET-018) already provides that name.

Only `src/config.ts` reads `import.meta.env` (ESLint rule).

## Stack

| Concern              | Library                                                  |
| -------------------- | -------------------------------------------------------- |
| UI                   | React 19, MUI 9 (`@mui/material`, `@mui/icons-material`) |
| Routing              | React Router 8 (declarative routes)                      |
| Server state         | TanStack Query 5                                         |
| Forms and validation | React Hook Form, Zod                                     |
| Build                | Vite 8, TypeScript (strict)                              |
| Tests                | Vitest, React Testing Library, jsdom                     |
| Service worker       | `vite-plugin-pwa` (Workbox), build time only (MOBILE-002) |
| Drag and drop        | `@dnd-kit/core`, `@dnd-kit/sortable` (mouse, touch, keyboard; FOOD-014) |

## Project Structure

```text
src/
├── api/          API client (only place that calls fetch), errors, query client
├── components/   reusable UI: loading, error, empty states, dialogs, page header
├── features/     feature modules (dashboard, tenners, completions, ...)
├── hooks/        generic hooks
├── layouts/      application layout and navigation
├── pages/        generic pages (not found, coming soon)
├── routes/       route table
├── theme/        MUI theme
├── types/        domain enumerations and labels
├── tests/        test setup and helpers
├── config.ts     configuration (only place that reads import.meta.env)
└── main.tsx      entry point
```

Features own their components, hooks and API functions, so `components/` stays small.

## Architecture

- **API isolation:** `src/api/client.ts` wraps `fetch` (ESLint forbids `fetch` elsewhere). It builds URLs,
  sends JSON, unwraps the `{ success, data }` envelope, validates the payload with a Zod schema and turns
  failures into `ApiError` (`status`, `code`, `details`). Network failures have status 0.
- **Server state:** TanStack Query. Queries retry transient failures (network, 429, 5xx) up to 3 times with
  exponential backoff; 4xx are not retried. Mutations are never retried automatically.
- **Routing:** `/` redirects to `/dashboard`. `/tenners`, `/essen` (FOOD-009), `/analytics` and `/settings` exist; unknown paths
  show a not-found page. CloudFront serves `index.html` for unknown paths (SPA fallback).
- **Layout:** app bar, permanent side navigation from `md` (900 px). Below `md` (MOBILE-005): bottom navigation
  (Dashboard, Tenner, Auswertung, Einstellungen) and a floating Quick Add button within thumb reach; safe-area insets
  (`viewport-fit=cover`) keep content clear of notches and the home indicator in the installed app.
- **Errors (UX-005):** a top-level error boundary shows a fallback with a reload button instead of a blank page.
  `src/api/errorMessages.ts` maps API error codes to German messages (e.g. `CONCURRENT_MODIFICATION` → "Jemand anderes
  hat diesen Tenner geändert …", network/5xx → "Tenner ist gerade nicht erreichbar …"); all error alerts and
  snackbars use it. Backend field errors appear on the form field. A banner shows when the device is offline or the
  API is unreachable (reads failing with network errors, 429 or 5xx) and disappears after the next successful read.
  Failed saves keep the form input.

## Features

| Route                       | Feature                                                                                                                                                                                                                                                     | Ticket       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `/dashboard`                | The family's day (UI-001): „Heute essen wir“ (largest card, lunch and dinner), „Heute erledigen wir“ (completed today shown ticked, open Aufgaben with complete button, swipe, snooze and skip), „Für morgen einkaufen“ (open shopping list items for tomorrow's meals, from next week's list on the last day of a week). No counts, workload, upcoming or Quick Add any more | UI-001 |
| `/tenners`                  | Management: live title search (300 ms debounce), filters (status active/archived/all, person, category), sorting, complete, archive (with confirmation), restore                                                                                            | FRONTEND-003 |
| `/tenners` → "Neuer Tenner" | Create dialog: shared `TennerForm` (React Hook Form + Zod, limits mirror the backend), rotating assignment ("Abwechselnd zuständig" with member chips, HOUSEHOLD-001; lists show "Abwechselnd, danach …"), frequency as interval + unit (Tage/Wochen/Monate/Jahre) with presets Täglich, Wöchentlich, Alle 2 Wochen, Monatlich, Vierteljährlich, Jährlich (SCHEDULING-001) and weekday chips Mo–So for weekly frequencies (SCHEDULING-002), inline and server-side validation messages, full screen on phones                                                                                 | FRONTEND-004 |
| `/tenners` → "Bearbeiten"   | Edit dialog: same form plus Active switch and read-only facts, sends only changed fields (`PUT`), asks before discarding unsaved changes                                                                                                                    | FRONTEND-005 |
| `/tenners`                  | Quick Add (on the dashboard until UI-001): type a title and press Enter; defaults from the settings (initially Haushalt, current user, 10 min, every 14 days), keyword-based category suggestion, warning for similar titles                                                                                            | FRONTEND-006 |
| everywhere                  | Completion: one click, optimistic dashboard update with a subtle collapse, snackbar with 10-second "Rückgängig", retries with the same `Idempotency-Key`; "Zuletzt erledigt" (last 10, relative time); "Ich bin" selector in the header                     | FRONTEND-007 |
| `/settings`                 | Settings in two groups. Personal (this browser): profile (signed-in person, read-only, logout), default assignee ("Ich selbst" or a member), theme, reset (the dashboard sections were removed by UI-001). Household (server-side, HOUSEHOLD-ADMIN-003): name, timezone (SCHEDULING-008), week start, workdays, vacation (SCHEDULING-005), defaults for new Tenners (category, minutes, frequency; one-time offer to upload defaults stored on this device), members (HOUSEHOLD-ADMIN-001; deactivate with reassignment and reactivate, HOUSEHOLD-ADMIN-004; hand over a member's Tenners until a date with a preview and end it early, HOUSEHOLD-004 — cards then show "Julia (für Stefan)"), categories (HOUSEHOLD-ADMIN-002) | FRONTEND-008 |
| `/tenners/:tennerId`        | Detail: header with status and actions (complete, snooze when due/overdue, pause/resume, edit, archive/restore), schedule, consistency (completions in 90 days, average interval vs. frequency), history newest first with "Mehr anzeigen"; not-found page. Titles on dashboard and list link here | FRONTEND-009 |
| `/analytics`                | Analytics (ANALYTICS-009): period Woche / Monat / Quartal / Jahr / eigener Zeitraum in the URL (`?period=` or `?from=&to=`); key figures, trend columns, life areas with health, household balance (stacked shares in member-list order, no ranking), time investment, neglected Tenners and habits (tables linking to the Tenner). Each section loads and fails on its own, sections whose endpoint is missing are hidden, every chart has a table view. Charts are small HTML components (no chart library) with a validated palette (`chartColors.ts`) | ANALYTICS-009 |

Queries and mutations share keys from `src/api/queryKeys.ts`. Completing a Tenner invalidates the dashboard,
Tenner lists and history. Completions send an `Idempotency-Key`, so a repeated request cannot complete twice.
The current user comes from the login (SECURITY-003) and is used for completions, undo, restores and as default assignee.

The completion workflow lives in `features/completions/CompletionProvider.tsx` at app level, so it keeps running when the optimistic update removes the card that started it.

"Archived" means soft-deleted (`DELETE /tenners/{id}`); the archive view uses `GET /tenners?deleted=true`
(TICKET-024). Status "Alle" combines three requests (active, inactive, archived). Telemetry events
(created, completed, archived, restored, filter changed) are logged to the console for now (`src/utils/telemetry.ts`).

Success messages use the global snackbar (`components/NotificationProvider.tsx`, `useNotify()`).

## Authentication (SECURITY-003, FUTURE-011)

- `src/auth/`: `oidc-client-ts` `UserManager` (Authorization Code flow with PKCE against Cognito, scopes
  `openid email`, `lang=de`, `identity_provider=Google`) and `react-oidc-context` for React state.
- **Login:** `AuthGate` wraps every page except `/auth/callback`. Without a session it redirects through Cognito
  directly to Google sign-in and remembers the page; `/auth/callback` finishes the code exchange and returns there.
- **Tokens:** stored in `localStorage` (owner decision, ADR 0001): a device stays logged in for up to 30 days
  (refresh token). Trade-off: injected scripts could read them; mitigated by the strict CSP (`script-src 'self'`)
  and no third-party scripts.
- **API:** `src/api/client.ts` sends `Authorization: Bearer <ID token>` (ADR 0001). On `401` it refreshes the
  session once and retries; if that fails, it redirects to the login.
- **Current user:** the household group `household:<tenantId>:<userId>` in `cognito:groups` of the ID token
  (Stefan/Julia), shown in the header with "Abmelden". The former "Ich bin" selector is gone.
- **First login (HOTFIX-001):** Google users without a household group see `AssignmentPage`
  (`src/features/onboarding/`: page, `AssignmentCard`, `useOnboarding` / `useAssignHouseholdMember`):
  "Willkommen bei Tenner", one card per member, taken members disabled. After the choice the session is refreshed
  (`signinSilent`, new ID token with the group) and the app opens the dashboard. Accounts that are already
  assigned skip the page automatically; if all members are taken the page shows "Kein freier Platz".
- **Logout:** clears the tokens and opens the Cognito logout endpoint, which returns to the app.

## Meal Plan (FOOD-009)

- **Page `/essen`** (`src/features/meals/MealPlanPage.tsx`): „Diese Woche“ / „Nächste Woche“ (`GET /meals/plans/current|next`),
  one card per day with lunch and dinner (`MealCard`: dish, active minutes, vegetarian or the vegetarian variant,
  „Nichts geplant“ with the planner's reason, rule hints as chips). The days run Monday – Sunday in plan week order;
  today's card is highlighted in its place (device date, MAINT-007). Without dishes or eaters a hint links to the settings.
- **Meal menu** (`MealActions`, online and not in the past): „Anderes Gericht“ (FOOD-007) replaces the meal; repeated
  use cycles through alternatives (rejected dishes are sent as `excludeDishIds`); the snackbar offers „Rückgängig“.
  „Selbst wählen“ (FOOD-022, `MealPickerDialog`) lists every dish with search, those that fit all rules first and
  the conflicts as chips (allergy and vegetarian in red); such a choice asks „Wirklich?“ and is sent again with
  `confirm`. „Tauschen“ (`SwapMealDialog`) swaps with another meal of the week from today on. „Festlegen“ /
  „Festlegung lösen“ toggles the lock (lock icon on the card). Choose and swap offer „Rückgängig“ (puts the previous
  dish back / swaps back; the meals stay manual and locked). Picker options use the query key `meals/options` and are
  not cached offline.
- **„Woche neu planen“** (FOOD-008, online, button in the header): a confirmation names how many meals are replanned
  and which future meals stay (locked, chosen by hand, cooked, past — `isKept`, same rule as the backend); the
  snackbar offers „Rückgängig“, which sends the previous dishes of the changed meals as `restore`.
- **Navigation:** „Essen“ between Tenner and Auswertung (side and bottom navigation).
- **Dashboard:** „Heute essen wir“ (`TodayMealsCard`) with today's meals; since UI-001 the largest dashboard card, „Für heute ist noch nichts geplant.“ without a plan.
- **What was eaten** (FOOD-023, `MealStatusControls.tsx`): today's and past meals get „Gekocht“, „Ausgefallen“,
  „Anderes gegessen“ and, when cooked, 👍 / 👎; favorites have a star (dish cards: ⭐ toggles `favorite`, plan cards
  show it); dish cards show „Zuletzt gegessen am … · n× in 3 Monaten“ (`GET /meals/history`).
- **Food analytics** (FOOD-019, `features/analytics/FoodAnalytics.tsx`): Auswertung → tab „Essen“ (4 Wochen, 12
  Wochen, 1 Jahr) with tiles, protein and favorites bars, cost per week, plan adherence and rarely eaten dishes.
- **Calendar** (FOOD-015, `MealCalendarSettings.tsx`): Settings → „Essen: Kalender“ creates a private ICS link (shown
  once, copy button, „In Apple Kalender öffnen“ via `webcal:`), replaces it or revokes it; instructions for Google and
  Apple; calendar apps refresh on their own schedule.
- **Morning notification** (FOOD-016): Settings → Benachrichtigungen → „Essensplan am Morgen“ (on/off, time in
  15-minute steps, channels push/Alexa; default on at 07:30, sent by the notifier).
- **Offline:** plans use the query root `mealPlans` and are kept in the offline cache; the food profile is not.

## Dishes (FOOD-010)

- **Page `/essen/gerichte`** (`src/features/meals/DishesPage.tsx`, button „Gerichte“ on the plan page, „Gerichte
  verwalten“ in Settings → Essen): the household's dishes with search (name and group) and the filters Mittag/Abend,
  Kategorie, Vegetarisch and „Archivierte zeigen“. „Archivieren“ / „Wiederherstellen“ with „Rückgängig“; archived
  dishes are no longer planned.
- **Editor** (`DishEditorDialog.tsx`): name, group (suggestions), category, Mittag/Abend, leicht/sättigend, warm/kalt,
  ingredients per adult portion (catalog picker; quantity; g/ml or EL/TL, Stück for counted ingredients; „optional“),
  active and total minutes, vegetarian variant, family-friendly, burger. „Neue Zutat „…“ anlegen“ opens
  `NewIngredientDialog.tsx` (`POST /meals/ingredients`).
- **„Was das Gericht bedeutet“:** derived live in `dishes.ts` (`deriveDraft`, `ruleHints`, a mirror of the backend's
  `deriveDish` and rules): vegetarian, protein source, base ingredient, tags, and which eaters and household rules
  exclude or limit the dish. Validation follows the backend limits; server errors (`DISH_NAME_TAKEN`,
  `VALIDATION_ERROR`, `CONCURRENT_MODIFICATION`) are shown at the fields or as a hint.
- **Cache:** dishes use the query key `meals/dishes/active|archived`; saving invalidates `meals` and `mealPlans`.
- **Photos** (FOOD-011, `dishImages.ts`, `DishImage.tsx`): „Foto aufnehmen / auswählen“ in the editor (camera or
  gallery), preview, „Foto entfernen“. The photo is shrunk in the browser (canvas, max. 1200 px, JPEG ~300 KB) and
  uploaded after the dish is saved: presigned PUT straight to S3 (no Authorization header), then the key is attached.
  If only the photo fails, the dish stays saved and a message says so. Photos (`/images/…`, lazy) or a placeholder per
  category appear in the dish list, on the plan cards and in „Heute essen wir“.
- **Nutrition** (FOOD-012, `format.ts`): „ca. 520 kcal · 24 g Eiweiß · 60 g KH · 18 g Fett“ on dish cards and in the
  editor (server estimate as of the last save; „mind.“ when ingredient values are missing), „Nährwerte selbst
  eintragen“ sends `nutritionOverride`. The plan shows the day total in each day header and a soft hint on weekday
  lunches above „Leichtes Mittagessen bis (kcal)“ (rules dialog, default 600). Disclaimer: „Grobe Schätzung pro
  Erwachsenenportion, keine Ernährungsberatung.“
- **Cost** (FOOD-013, `format.ts`, `IngredientPricesDialog.tsx`): dish cards show „€€ · ca. 8–10 €“ for the whole
  family (portion factors of the profile; one adult portion while no eaters exist), the plan header the week total
  and the average per meal. Tiers are set in the rules dialog („€ bis“, „€€ bis“), prices in Settings → Essen →
  „Preise“ (search, save per ingredient; pantry items are not listed).

## Shopping List (FOOD-014)

- **Page `/einkaufsliste`** (`src/features/meals/ShoppingListPage.tsx`; own navigation entry „Einkaufsliste“ after
  „Essen“, „Einkauf“ in the bottom navigation, since FOOD-027; `/essen/einkaufsliste` redirects; button on the plan page): the week's items in the household's own order with quantity
  („2×“, counts only since FOOD-028) and meals („für Mo Abend, Do Mittag“); „Ab heute“ / „Ganze Woche“; „Eigener Eintrag“; „Teilen“ (Web Share
  API, otherwise copied as text).
- **Own order:** drag handle per item (`@dnd-kit`: mouse, touch with a short press, keyboard with Space and arrow
  keys); a drop is sent as `{ type: "move", key, afterKey }`.
- **Ticking off:** a ticked item is struck through and moves to „Erledigt“ at the end; unticking puts it back.
  Pantry items (salt, oil …) are in a collapsed „Vorrat prüfen“.
- **„Liste aktualisieren“** appears when the plan changed since the list was made (`stale`).
- **Offline:** the list uses the query root `shoppingLists` (offline cache). Every change is queued in localStorage
  (`tenner.shoppingQueue`, `shoppingQueue.ts`) and sent when online (`useShoppingChanges`); the page shows the server
  list with the queued changes applied. The changes are idempotent, so a replay does no harm. The queue is deleted
  on logout without a question.

## Settings (FRONTEND-008)

- Model and storage: `src/features/settings/preferences.ts` (`UserPreferences`, versioned envelope in
  `localStorage` key `tenner.preferences`; invalid fields fall back to defaults individually; blocked storage
  is tolerated). `SettingsProvider` (in `AppProviders`, above the theme) loads once and persists every change;
  hooks `useSettings()`, `useThemePreference()`, `useNewTennerDefaults()`.
- Consumers: Quick Add and the create dialog use the defaults. The dashboard section switches (upcoming,
  per-person, per-category, recent activity) have no effect since UI-001 and are no longer shown (TD-043).
- The current user is **not** selectable: it comes from the Google login (SECURITY-003/004).
- **Essen: Familienprofil** (FOOD-004, `src/features/meals/FoodProfileSettings.tsx`): household-wide, stored on the
  server (`GET/PUT /meals/profile`). People with adult/child, portion, vegetarian with exceptions, allergies (⚠),
  dislikes and likes (`EaterDialog`); planning rules and who eats when (`FoodRulesDialog`; default: weekday lunch
  only adults). Every change saves the whole profile.
- **Essen: Gerichtekatalog** (FOOD-003, `src/features/meals/MealCatalogSettings.tsx`): „Katalog prüfen“ (dry run) →
  „Jetzt importieren“ (`POST /meals/catalog`); safe to repeat.

## Installable App (MOBILE-001)

Tenner is a Progressive Web App: it can be added to the home screen and starts without browser UI.

- `public/manifest.json`: name, `start_url` `/dashboard`, `display: standalone`, theme colors, icons (192, 512,
  maskable 512) and the shortcuts "Neue Aufgabe" (`/tenners?quickAdd=1`, focuses Quick Add, UI-001) and "Heute".
- `index.html`: manifest link, Apple touch icon and the iOS home-screen meta tags.
- Settings → "App": "App installieren" where the browser offers installation (Chrome, Edge, Android; the
  `beforeinstallprompt` event is captured at startup in `src/features/install/installPrompt.ts`), step-by-step
  instructions on iPhone/iPad ("Teilen → Zum Home-Bildschirm"), a confirmation once installed; hidden elsewhere
  (e.g. Firefox desktop).
- Icons in `public/icons/` were rendered from the favicon motif (white "10" on `#1976d2`); the maskable icon keeps the
  motif inside the 80 % safe zone. To change them, render new PNGs of the same sizes.
- No service worker is needed for installation in current browsers.

## Service Worker (MOBILE-002)

- **What it does:** `vite-plugin-pwa` generates `dist/sw.js`, which precaches the app shell (`index.html`, hashed
  assets, icons, manifest) with content revisions. The app starts from the cache, also offline and on deep links
  (navigation fallback to `index.html`). API requests (other origin) are never intercepted: always network.
- **Updates:** every deploy changes the precache revisions, so browsers install a new worker. The app shows
  "Neue Version verfügbar – Neu laden" (`src/features/install/UpdatePrompt.tsx`); "Später" keeps the old version
  until the next launch. Open sessions check for updates hourly. A stale shell is served for at most one launch.
- **Deploy:** `sw.js` and `workbox-*.js` are root files, so `scripts/deploy-frontend.sh` uploads them with
  `no-cache` like `index.html`; CloudFront does not cache them. No infrastructure change.
- **Kill switch** (if a broken worker ever ships): set `SERVICE_WORKER_KILL_SWITCH = true` in `vite.config.ts`, merge
  and deploy. The new `sw.js` unregisters itself and deletes its caches on the next visit; the app then loads
  from the network as before MOBILE-002. Revert the flag once fixed.
- **Why a dependency:** a correct precache needs the list of built files with revisions on every build; Workbox
  generates it and handles cleanup of outdated caches. Only `workbox-window` (~2 kB gzip, loaded on demand) ships to
  the browser; `workbox-build` runs at build time.
- The dev server (`npm run dev`) does not register the worker.

## Offline Reading (MOBILE-003)

- **What it does:** the TanStack Query cache of the dashboard, Tenner list and detail, history, members, categories and meal plans (FOOD-009)
  is persisted in `localStorage` (key `tenner.offlineCache`, `src/features/offline/`). Offline, the app opens with
  the last known data; queries pause and refresh on reconnect.
- **Age shown:** while offline or while the API is unreachable, the banner adds „Angezeigt wird der Stand von …“
  (oldest update time of the data on screen).
- **Lifetime:** max. 7 days (older caches are discarded at startup; `gcTime` is 7 days so unobserved pages stay
  available). A new build or another member on the device discards the cache. Logout deletes it.
- **Offline session:** offline, a stored login opens the app even if the access token has expired; the login
  redirect and token refresh wait for the connection. Back online, an expired session is renewed silently (refresh
  token) before the app falls back to the login page. Without a stored login the app still asks for the login.
- **Not persisted:** analytics, settings, notification preferences, Alexa links, onboarding, the food profile (allergies), dishes and ingredients.
- **Privacy:** Tenner titles, notes, due dates, member names and recent completions of the household stay on the
  device for up to 7 days (or until logout). Anyone with access to the unlocked device and browser profile can read
  them, as with the login tokens (ADR 0001).
- **Why `localStorage`, not IndexedDB:** the cache is a few hundred kB at most for one household; synchronous
  `localStorage` needs no extra library and works the same in tests. Writes that fail (quota, private mode) are
  ignored; the app works without the cache.
- **Dependency:** `@tanstack/react-query-persist-client` (same release as `@tanstack/react-query`, official
  TanStack package) for restore-before-fetch, dehydration filters, max age and cache busting.

## Offline Completion (MOBILE-004)

- **What it does:** without a connection, „Erledigt“ (button or swipe) stores the completion on the device
  (`localStorage` key `tenner.offlineQueue`, `src/features/offline/completionQueue.ts`) with the device time and an
  Idempotency-Key generated at that moment. The Tenner disappears from the dashboard at once; „⏳ … wartet auf die
  Übertragung“ lists what is waiting. The snackbar's „Rückgängig“ takes it out of the queue again.
- **Also queued:** a request that gets no response at all (connection dropped while online).
- **Sync:** at app start, on the browser's `online` event and every 60 s while entries wait, the queue is replayed in
  order through the normal Complete endpoint with `completedAt` and the stored Idempotency-Key, so a replay never
  completes a Tenner twice. One run at a time; the app must be open (no Background Sync).
- **Rules:**
  - network error, 5xx, 429, 401 → stop, keep the entry and the ones after it, try again later
  - `409 CONCURRENT_MODIFICATION` → one immediate retry; if it happens again, keep for later
  - `404` / `409 TENNER_INACTIVE` → drop: „Der Tenner wurde inzwischen gelöscht oder archiviert.“
  - `400` on `completedAt` (someone completed it later online) → drop: „Der Tenner wurde inzwischen schon
    erledigt.“ The backend accepts no completion earlier than the last one, so the offline one is not kept in the
    history.
  - device time up to 5 minutes in the future → clamped to now; further → drop with a hint to check the clock
  - any other refusal → drop with the usual error message
  The result appears in one snackbar („✅ 2 Offline-Erledigungen übertragen.“ plus refused ones).
- **One entry per Tenner:** a second offline completion of the same Tenner is refused („schon zum Übertragen
  vorgemerkt“).
- **Logout:** with waiting entries the app asks before discarding them; afterwards the queue is deleted.
- **Not offline:** create, edit, archive, snooze, skip, pause, undo of synced completions.

## Touch Interaction (MOBILE-005)

- **Swipe on dashboard cards** (due today and overdue): right → complete (with the usual undo snackbar), left → the
  snooze menu. A gesture counts only when it moves further sideways than vertically (page scrolling keeps working)
  and past 80 px; the card follows the finger and shows "Erledigt" / "Verschieben" behind it. The "Erledigt" and
  "Verschieben" buttons stay on every card as the accessible alternative (`src/features/mobile/useSwipe.ts`).
- **Pull to refresh** on the dashboard (installed apps have no browser pull-to-refresh): pulling down at the top
  reloads the dashboard and recent activity (`PullToRefresh.tsx`).
- **Touch targets:** buttons, icon buttons, toggle buttons and clickable chips are at least 44 × 44 px on touch
  screens (`@media (pointer: coarse)` in the theme); mouse layouts stay compact.
- **Haptics:** a short vibration on completion where the browser supports it (Android).

## Theme

`src/theme/theme.ts`: `createAppTheme("light" | "dark")` (FRONTEND-008; the preference "wie das Gerät" follows
`prefers-color-scheme`), primary `#1976d2` (dark `#90caf9`), secondary `#2e7d32`, rounded corners, system font stack
(no web fonts, so no external requests; the CloudFront CSP only allows `'self'`). Typography: `h1` page title,
`h2` section title, `body1`/`body2` text, custom `metric` variant for key numbers.

## Accessibility

Semantic landmarks (`header`, `nav`, `main`), labelled navigation and buttons, keyboard-reachable controls
(MUI), `role="status"` with `aria-busy` on loading placeholders.
