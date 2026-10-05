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

---

# Implementation Status

Implemented 2026-10-05.

- [x] Interaction model: `CompleteIntent` (slot `tenner`, type `TennerTitle`, incl. bare „erledigt“ and a
  slot-only sample for answers), `UndoIntent`; static placeholder value keeps the type valid
- [x] Dynamic entities on launch: active Tenners as `TennerTitle` (id = tennerId, up to 100, synonym without
  leading article) together with the member names; a failed Tenner load does not break the greeting
- [x] Matcher `alexa/src/matcher.ts` (pure): normalization (umlauts, articles, punctuation), token overlap with
  edit-distance tolerance, containment, whole-string similarity; clear ≥ 0.8 with lead ≥ 0.15, due bonus for the
  speaker's due/overdue Tenners, at most three options
- [x] Completion: entity ID → direct; clear match → complete; uncertain → „Meinst du …?“; several → choice; none →
  ask again; not-yet-due and paused → confirmation; `completedBy` = recognized speaker, the only member, or asked
  („Wer hat … gemacht?“); `Idempotency-Key` = Alexa request ID; answer with next due date and rotation hint;
  `TENNER_INACTIVE` / 404 explained
- [x] Undo: session's last completion directly; otherwise `GET /history?limit=1[&completedBy=speaker]`, only
  if completed today (household timezone), after confirmation; `NO_COMPLETION_TO_UNDO` explained
- [x] Backend: `GET /household/alexa` also returns the household `timezone` (for "today" in the skill)
- [x] Logs: match outcome, score and Tenner ID only (no titles); README: phrases and matching rules
- [x] Tests passing: alexa 94 (+26: exact, entity ID, fuzzy, ambiguous with choice via either intent, no match,
  not-yet-due confirmation, paused + „nein“, inactive, asked/only member, bare „erledigt“, rotation hint,
  idempotency key, undo in session / outside with confirmation / old or none / nothing left, entities), backend
  774; lint and build clean

Decisions and assumptions:

- API timeout per call lowered to 2 s: a one-shot completion needs up to three sequential calls (context, list,
  complete) inside the 7 s Lambda timeout.
- An uncertain single candidate is asked as „Meinst du X?“ including its warning, so „ja“ completes directly.
- A bare name in answer to a question may arrive as `SpeakerIntent` or `CompleteIntent`; both are accepted while
  a question is open.
- Undo outside the session for an unrecognized speaker uses the household's latest completion today and names
  who did it.
