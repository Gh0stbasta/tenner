# UX-004: Implement Internationalization (German and English)

## Type

Frontend Feature

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Support German and English in the user interface, with German date and number
formatting for German users.

---

# Background

The household is German-speaking (`Europe/Berlin`), while the code base and
current UI text are English. Notifications (NOTIFICATION domain) also need
localized text.

---

# Dependencies

```text
FRONTEND-001
FRONTEND-008
```

---

# Scope

## Library

Use `react-i18next` (widely used, small) or the platform `Intl` API plus a minimal
message catalog. Justify the choice in the ticket.

## Languages

```text
en (default)
de
```

## Coverage

- All user-facing strings extracted to message catalogs.
- Dates, relative times ("vor 2 Minuten") and numbers formatted via `Intl`.
- Pluralization handled ("1 Tenner" / "3 Tenner").
- Category and frequency labels localized.

## Selection

- Default from browser language.
- Override in Settings (personal preference, local).

## Backend

API error codes stay language-neutral; the frontend maps codes to messages.
Notification text localization is handled by passing the user's language to
the renderer (extension point only in this ticket).

## Quality Gate

CI check fails if a key exists in `en` but not in `de`.

---

# Testing Requirements

```text
Language Detection
Language Switch Without Reload
Missing Key Check
Date And Relative Time Formatting
Pluralization
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
i18n setup
en and de catalogs
Language setting
CI key completeness check
Tests
Documentation
```

---

# Validation

```bash
npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- All UI strings localized in en and de
- Locale-aware formatting
- Language selectable
- Missing translations fail CI
- Tests passing

---

# Definition of Done

- The household can use Tenner in German
- Feature deploys through GitHub Actions

---

# Out of Scope

- Additional languages
- Localizing Tenner titles (user content)
