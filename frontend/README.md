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

| Variable            | Meaning                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | API stage URL without trailing slash, e.g. `https://<id>.execute-api.eu-central-1.amazonaws.com/prod` |

`deploy.yml` sets it from the Terraform output `api_endpoint`. Copy `.env.example` to `.env.local` for
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
- **Routing:** `/` redirects to `/dashboard`. `/tenners`, `/analytics` and `/settings` exist; unknown paths
  show a not-found page. CloudFront serves `index.html` for unknown paths (SPA fallback).
- **Layout:** app bar, permanent side navigation from `md` (900 px), drawer behind a menu button below.
- **Errors (UX-005):** a top-level error boundary shows a fallback with a reload button instead of a blank page.
  `src/api/errorMessages.ts` maps API error codes to German messages (e.g. `CONCURRENT_MODIFICATION` → "Jemand anderes
  hat diesen Tenner geändert …", network/5xx → "Tenner ist gerade nicht erreichbar …"); all error alerts and
  snackbars use it. Backend field errors appear on the form field. A banner shows when the device is offline or the
  API is unreachable (reads failing with network errors, 429 or 5xx) and disappears after the next successful read.
  Failed saves keep the form input.

## Features

| Route                       | Feature                                                                                                                                                                                                                                                     | Ticket       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `/dashboard`                | Today: summary cards, due today, overdue (highlighted), upcoming, workload per person and category, one-click completion                                                                                                                                    | FRONTEND-002 |
| `/tenners`                  | Management: live title search (300 ms debounce), filters (status active/archived/all, person, category), sorting, complete, archive (with confirmation), restore                                                                                            | FRONTEND-003 |
| `/tenners` → "Neuer Tenner" | Create dialog: shared `TennerForm` (React Hook Form + Zod, limits mirror the backend), frequency presets, inline and server-side validation messages, full screen on phones                                                                                 | FRONTEND-004 |
| `/tenners` → "Bearbeiten"   | Edit dialog: same form plus Active switch and read-only facts, sends only changed fields (`PUT`), asks before discarding unsaved changes                                                                                                                    | FRONTEND-005 |
| `/dashboard`, `/tenners`    | Quick Add: type a title and press Enter; defaults (Haushalt, current user, 10 min, every 14 days), keyword-based category suggestion, warning for similar titles                                                                                            | FRONTEND-006 |
| everywhere                  | Completion: one click, optimistic dashboard update with a subtle collapse, snackbar with 10-second "Rückgängig", retries with the same `Idempotency-Key`; "Zuletzt erledigt" (last 10, relative time); "Ich bin" selector in the header                     | FRONTEND-007 |
| `/tenners/:tennerId`        | Detail: header with status and actions (complete, edit, archive/restore), schedule, consistency (completions in 90 days, average interval vs. frequency), history newest first with "Mehr anzeigen"; not-found page. Titles on dashboard and list link here | FRONTEND-009 |

Queries and mutations share keys from `src/api/queryKeys.ts`. Completing a Tenner invalidates the dashboard,
Tenner lists and history. Completions send an `Idempotency-Key`, so a repeated request cannot complete twice.
The current user ("Ich bin" in the header, default Stefan) is stored per device in `localStorage` (`tenner.currentUser`) and used for completions, undo, restores and as default assignee. FRONTEND-008 moves the selection into the settings page.

The completion workflow lives in `features/completions/CompletionProvider.tsx` at app level, so it keeps running when the optimistic update removes the card that started it.

"Archived" means soft-deleted (`DELETE /tenners/{id}`); the archive view uses `GET /tenners?deleted=true`
(TICKET-024). Status "Alle" combines three requests (active, inactive, archived). Telemetry events
(created, completed, archived, restored, filter changed) are logged to the console for now (`src/utils/telemetry.ts`).

Success messages use the global snackbar (`components/NotificationProvider.tsx`, `useNotify()`).

## Theme

`src/theme/theme.ts`: light theme, primary `#1976d2`, secondary `#2e7d32`, rounded corners, system font stack
(no web fonts, so no external requests; the CloudFront CSP only allows `'self'`). Typography: `h1` page title,
`h2` section title, `body1`/`body2` text, custom `metric` variant for key numbers.

## Accessibility

Semantic landmarks (`header`, `nav`, `main`), labelled navigation and buttons, keyboard-reachable controls
(MUI), `role="status"` with `aria-busy` on loading placeholders.
