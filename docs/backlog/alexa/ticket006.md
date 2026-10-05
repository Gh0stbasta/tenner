# ALEXA-006: Implement Echo Show Dashboard (APL)

## Type

Visual Feature

---

## Priority

High

---

## Phase

V2

---

## Goal

Show Tenner's household dashboard on Echo Show screens with the Alexa Presentation Language (APL): today's and
overdue Tenners, per-member status and open minutes — readable from across the kitchen and touchable to complete a
Tenner.

---

# Background

Echo Show devices render APL documents sent with the `Alexa.Presentation.APL.RenderDocument` directive while the
skill session is active. Device classes (viewport profiles): Echo Show 5 (hubLandscapeSmall), Show 8
(hubLandscapeMedium), Show 10 (hubLandscapeLarge), Show 15/21 (hubLandscapeXLarge); Show 15 can also be mounted
in portrait. A rendered document stays on screen while the session is open and returns to the home screen after
inactivity (device-dependent) — for permanent visibility see ALEXA-007 (widgets).

Target view (from the Alexa backlog):

```text
🏠 TENNER                         Montag, 5. Oktober
Heute: 3 Tenner · 15 Minuten offen · 1 überfällig

Stefan   ▢ Auto waschen (30 Min.)   ▢ Altglas (5 Min.)
Julia    ▢ Pflanzen gießen (10 Min.)
Alle     ▢ Spülmaschine ausräumen (10 Min.)
Überfällig  ⚠ Haustür putzen – seit 4 Tagen (Julia)
```

---

# Dependencies

```text
ALEXA-003 (data and wording), ALEXA-004 (completion), ALEXA-002 (identity)
```

---

# Scope

## Interfaces

- Manifest: interface `ALEXA_PRESENTATION_APL`; send APL only when
  `context.System.device.supportedInterfaces["Alexa.Presentation.APL"]` is present (voice-only devices keep
  speech only).
- APL documents in `alexa/apl/` as JSON (versioned with the code), data via `datasources`; latest APL version
  supported by all target devices (verify the minimum across Show 5 – 15).

## Views

| View | Trigger | Content |
|---|---|---|
| Dashboard | Launch, Today, Briefing, after a completion | header (date, counts, open minutes), per-member columns/rows (own + shared "Alle"), overdue band |
| List | Overdue intent, "mehr zeigen" | scrollable list with status |
| Confirmation | Completion | short success state, then back to Dashboard |

## Layout per Device Class

- Show 5 (960×480): summary + next 3 Tenners only, large type.
- Show 8 (1280×800) / Show 10 (1280×800): summary + member columns (max 3 members, then "weitere").
- Show 15 landscape (1920×1080): full dashboard incl. overdue band and per-category bar; portrait: stacked.
- Use APL `when` conditions on `@viewportProfile` / responsive components (AlexaHeader, AlexaTextList, etc.) where
  they fit; avoid pixel layouts.

## Touch

- Each Tenner row has a "Erledigt" touch target (≥ 48 dp) sending `SendEvent` with the Tenner ID →
  `Alexa.Presentation.APL.UserEvent` handler → same completion path as ALEXA-004 (idempotency key from the
  request ID).
- Visual confirmation and spoken „Erledigt: …“.

## Look

- Tenner colors: primary `#1976d2`; dark background (Echo Show default) with high-contrast text; overdue with an
  icon + text, not color alone; member colors from the palette validated in ANALYTICS-009 (not user swatches).
- Text sizes for viewing distance: ≥ 32 dp body on Show 8/10, ≥ 40 dp on Show 15.

---

# Architecture Considerations

- **APL size:** keep documents small (< 100 KB including data); images as vector graphics only.
- **Testing:** render each document with sample data in the APL authoring tool for every viewport; unit-test the
  datasource builders (pure) and snapshot the documents.
- **Session lifetime:** the dashboard remains while the session is open; do not keep the microphone open
  (`shouldEndSession` undefined + no reprompt) — verify device behavior and document the actual timeout.
- **Accessibility:** speech always carries the same information as the screen.

---

# Deliverables

```text
APL documents (dashboard, list, confirmation) for all target viewports
Datasource builders + UserEvent handler with tests
Screenshots per device class in the README (from the authoring tool or devices)
```

---

# Testing Requirements

```text
APL Only On Screen Devices
Datasource Mapping (members, shared, overdue)
More Than 3 Members → "weitere"
Touch Complete Event → Completion
Empty Day View
Document Size Limit
Viewport Variants Render (manual, authoring tool)
```

---

# Validation

```bash
npm run lint && npm run build && npm test   # alexa/
```

Manual: Echo Show 5, 8 (or 10) and 15 — launch, complete by touch, return to dashboard.

---

# Acceptance Criteria

- Dashboard renders legibly on Echo Show 5, 8, 10 and 15
- Today's, overdue, per-member status and workload are visible
- Tenners can be completed by touch
- Voice-only devices are unaffected
- Tests passing

---

# Definition of Done

- The kitchen Echo Show shows the household's day at a glance while Tenner is open
- Feature deploys through GitHub Actions

---

# Out of Scope

- Permanent home-screen visibility (ALEXA-007)
- Analytics charts on the Echo Show
- Video or animations beyond simple transitions
