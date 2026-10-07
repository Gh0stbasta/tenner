# ALEXA-003: Implement Today's Tenners Voice Experience

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

Answer the household's everyday questions by voice: what is due today, what is overdue, what should I do now,
and how much work is left — personal when the speaker is known, household-wide otherwise.

---

# Background

The dashboard API (`GET /dashboard`, TICKET-016) already classifies Tenners into due today, overdue, upcoming and
paused, with minutes per person and category, in the household timezone (SCHEDULING-008). Shared Tenners
(HOUSEHOLD-002) belong to everyone. ALEXA-002 provides the acting member.

---

# Dependencies

```text
ALEXA-001, ALEXA-002
TICKET-016 (dashboard API), SCHEDULING-005 (paused Tenners), HOUSEHOLD-002 (shared Tenners)
```

---

# Scope

## Intents (de-DE)

| Intent | Sample utterances | Answer |
|---|---|---|
| `TodayIntent` | „was ist heute fällig“, „was muss ich heute machen“, „was steht heute an“ | Count, minutes and up to 3 titles of today's Tenners for the speaker (own + shared), then „Soll ich die restlichen vorlesen?“ |
| `OverdueIntent` | „was ist überfällig“, „was habe ich vergessen“ | Overdue Tenners, longest overdue first, with „seit X Tagen“ |
| `SuggestIntent` | „was soll ich jetzt machen“, „was mache ich als nächstes“ | One Tenner: overdue before due today, then shortest; „Wie wäre es mit … (10 Minuten)?“ |
| `WorkLeftIntent` | „wie viel ist noch zu tun“, „wie viel Arbeit ist übrig“ | Open minutes today + overdue, split per member when nobody is recognized |
| `AMAZON.YesIntent` / `AMAZON.NoIntent` | — | Continue or end a listing (session attribute) |

Optional slot `member` (custom slot type filled with dynamic entities = active member names, see
`Dialog.UpdateDynamicEntities`): „was ist heute für Julia fällig“.

## Behavior

- Data: one `GET /dashboard` (with `assignedTo` when a member is known, which also includes shared Tenners).
- Speech: German, short sentences, numbers as words where Alexa reads them naturally; titles are read as entered
  (SSML-escape `&`, `<`, `>`); lists of at most 3 items per turn.
- Nothing due: „Heute ist nichts fällig. 🎉“ (spoken without emoji) and the next upcoming Tenner.
- Paused Tenners and the vacation (SCHEDULING-005) are never read as due.
- Every answer also returns an APL view on screen devices once ALEXA-006 exists; until then a simple card.
- One-shot invocations work: „Alexa, frag Tenner, was heute fällig ist.“

## Code

- `alexa/src/handlers/today.ts` etc.; text building in `speech.ts` (pure functions, unit-tested with dashboard
  fixtures identical to the frontend's).

---

# Architecture Considerations

- **Single source of truth:** all classification comes from the API; the skill only formats.
- **Latency:** one API call per intent; no fan-out.
- **Voice UX:** answers start with the number („Drei Tenner, zusammen 25 Minuten.“), then details; avoid reading
  IDs, dates in ISO form or category codes (use category names from `GET /categories`, cached per session).

---

# Deliverables

```text
Interaction model: intents, samples, member slot with dynamic entities
Handlers and speech builders with tests
README: supported phrases
```

---

# Testing Requirements

```text
Today For Known Speaker (own + shared)
Today For Unknown Speaker (household)
Nothing Due
Overdue Ordering And Wording
Suggestion Rule
Work Left Split Per Member
Listing Continuation (Yes / No)
SSML Escaping Of Titles
Paused Tenners Not Read
API Error Messages
```

---

# Validation

```bash
npm run lint && npm run build && npm test   # alexa/
```

Manual: each phrase on an Echo device; dialog simulation in the developer console for all samples.

---

# Acceptance Criteria

- All four questions answered correctly for known and unknown speakers
- Answers are short, German and readable aloud
- Tests passing

---

# Definition of Done

- The household can ask "what is due" without opening the app
- Feature deploys through GitHub Actions

---

# Out of Scope

- Completing by voice (ALEXA-004), daily briefing (ALEXA-005), visuals (ALEXA-006)

---

# Implementation Status

Implemented 2026-10-05.

- [x] Interaction model: `TodayIntent`, `OverdueIntent`, `SuggestIntent`, `WorkLeftIntent` (with optional
  `member` slot, type `TennerMember` filled by dynamic entities on launch), `AMAZON.YesIntent`/`NoIntent`;
  one-shot phrasings („was heute fällig ist“) included
- [x] One `GET /dashboard` per question (`assignedTo` = named member or recognized speaker, else household-wide);
  the household context comes from the session (ALEXA-002) — at most two API calls for a one-shot question
- [x] Speech builders in `alexa/src/answers.ts` (pure): answers start with the number, number words up to twelve,
  at most three items per turn with „Soll ich die restlichen … vorlesen?“, „seit gestern / seit 4 Tagen“,
  „morgen / übermorgen / in 5 Tagen“; titles XML-escaped for SSML, plain in the card
- [x] Nothing due → „Heute ist nichts fällig.“ plus the next upcoming Tenner; overdue as a hint
- [x] Paused Tenners and the vacation are never read (the API excludes them; tested)
- [x] Simple card per answer until ALEXA-006 adds APL
- [x] README: supported phrases
- [x] Tests passing: alexa 68 (+29: known/unknown speaker, named member, own name, unknown name, nothing due,
  overdue order and wording, suggestion rule and ties, work left per member, Yes/No continuation, SSML escaping,
  paused not read, API error, one-shot vs. open session); lint and build clean

Decisions and assumptions:

- One-shot requests end the session after the answer; inside an open session Tenner waits for the next question.
- `SuggestIntent` stores the suggested Tenner ID in the session for ALEXA-004 („erledigt“).
- Category names are not read (titles are enough for voice), so `GET /categories` is not called.
- Shared Tenners are part of a member's answer (the API includes them with `assignedTo`); titles are not prefixed
  with the assignee to keep answers short.
