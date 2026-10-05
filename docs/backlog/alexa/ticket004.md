# ALEXA-004: Implement Voice Completion Workflow

## Type

Voice Feature

---

## Priority

High

---

## Phase

V2

---

## Goal

Complete and undo Tenners by voice: „Alexa, sag Tenner, Mobility ist erledigt“ and „mach das rückgängig“ —
reliably, with the right Tenner matched from free speech and the right person recorded.

---

# Background

Completion (`POST /tenners/{id}/complete`, TICKET-013) supports `completedBy` and an `Idempotency-Key`; undo is
`POST /tenners/{id}/undo-completion` (TICKET-014). Rotation (HOUSEHOLD-001) and handovers (HOUSEHOLD-004) are
handled server-side. Titles are free text („Büro saugen“, „Mobility“), so speech must be matched to Tenners.

---

# Dependencies

```text
ALEXA-002, ALEXA-003
TICKET-013, TICKET-014
```

---

# Scope

## Intents (de-DE)

| Intent | Samples | Behavior |
|---|---|---|
| `CompleteIntent` | „{tenner} ist erledigt“, „erledige {tenner}“, „ich habe {tenner} gemacht“, „hake {tenner} ab“ | Match, confirm when unsure, complete |
| `UndoIntent` | „mach das rückgängig“, „das war falsch“, „letzte Erledigung rückgängig“ | Undo the last completion of this session, else the household's latest completion by the speaker (ask before) |

Slot `tenner`: custom slot type `TennerTitle` with **dynamic entities** (`Dialog.UpdateDynamicEntities`, replace
behavior) loaded at session start from the household's active Tenners: value = title, id = tennerId, synonyms =
simple variants (lowercase, without articles). Static fallback values keep the slot type valid.

## Matching

1. Entity resolution match on dynamic entities with a single ID → that Tenner.
2. Several matches or none → fuzzy match on the slot text (normalized: lowercase, umlauts, articles removed;
   token overlap + Levenshtein); prefer Tenners due today/overdue for the speaker.
3. Score below threshold or several close candidates → ask: „Meinst du ‚Büro saugen‘ oder ‚Büro aufräumen‘?“
   (max. 3 options) or „Welchen Tenner meinst du?“.
4. Never complete without a clear match; confirmation („‚Mobility‘ erledigen?“) when the Tenner is not due yet.

## Completing

- `completedBy` = recognized member (ALEXA-002), otherwise ask „Wer hat es gemacht?“ unless the household has one
  active member.
- `Idempotency-Key` = Alexa `request.requestId` (Alexa retries are deduplicated).
- Response: „Erledigt: Mobility. Als Nächstes fällig am 12. Oktober.“; rotating Tenners add „Nächstes Mal ist
  Julia dran.“; the APL view (ALEXA-006) refreshes when on screen.
- Inactive/paused/archived Tenners: explain instead of failing (`TENNER_INACTIVE` → „Mobility ist pausiert.“).

## Undo

- Session keeps the last completed Tenner ID; „rückgängig“ undoes it directly.
- Outside that, find the speaker's latest completion today (`GET /history?completedBy=…&limit=1`) and confirm
  before undoing.

---

# Architecture Considerations

- **Safety:** misrecognized speech must not complete the wrong Tenner — the confirmation rules above are the
  guard; log match scores (no titles in logs beyond the Tenner ID).
- **Idempotency:** Alexa may resend a request; the request ID as idempotency key makes this safe.
- **Dynamic entities limit:** up to 100 entity values per slot type per update (verify); a household has fewer
  active Tenners — if more, load due/overdue first.

---

# Deliverables

```text
Interaction model: CompleteIntent, UndoIntent, TennerTitle slot type
Dynamic entity loader (session start)
Matcher (pure, unit-tested) and completion/undo handlers
README: phrases and matching rules
```

---

# Testing Requirements

```text
Exact Match Completes
Fuzzy Match (umlauts, articles, plural)
Ambiguous Match Asks
No Match Asks
Not-Yet-Due Confirmation
Completed By Recognized Speaker / Asked Speaker
Idempotency Key = Request ID
Undo In Session / Outside Session With Confirmation
Inactive And Paused Tenners
Rotation Hint
```

---

# Validation

```bash
npm run lint && npm run build && npm test   # alexa/
```

Manual: complete and undo three real Tenners with different speakers; check history in the web app.

---

# Acceptance Criteria

- Tenners can be completed and undone by voice
- Ambiguous or uncertain matches always ask before acting
- The correct member is recorded as `completedBy`
- Tests passing

---

# Definition of Done

- Completing a Tenner takes one sentence
- Feature deploys through GitHub Actions

---

# Out of Scope

- Creating or editing Tenners by voice (possible follow-up ticket)
- Snoozing/skipping by voice (possible follow-up ticket)
