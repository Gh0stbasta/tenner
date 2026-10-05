# ALEXA-005: Implement Daily Briefing

## Type

Voice Feature

---

## Priority

Medium

---

## Phase

V2

---

## Goal

„Alexa, sag Tenner, starte meinen Tag“ gives a 20–40 second morning briefing: what is due today, what is overdue,
how long it takes, and how the household is doing — and it can run automatically every morning through an Alexa
routine.

---

# Background

ALEXA-003 answers single questions. A briefing combines them in a fixed, predictable order. NOTIFICATION-003 plans
a written daily digest; the briefing should use the same content rules so both channels say the same.

The Alexa Routines Kit (skills offering routines) is discontinued since 2026-05-13. Users can still add
"open skill" / custom-skill actions to their own routines in the Alexa app — this is the way to schedule the
briefing (verify the exact routine action name in the current Alexa app).

---

# Dependencies

```text
ALEXA-003
NOTIFICATION-003 (shared digest content rules; can follow later)
ANALYTICS-001 (yesterday's completions, optional sentence)
```

---

# Scope

## Intent

`BriefingIntent`: „starte meinen Tag“, „guten Morgen“, „was ist heute los“, „gib mir einen Überblick“.

## Content (in this order, each part only if non-empty)

1. Greeting with name when the speaker is known: „Guten Morgen, Stefan.“
2. Today: „Heute stehen 4 Tenner an, zusammen etwa 40 Minuten.“ + up to 3 titles (own + shared).
3. Overdue: „2 sind überfällig, am längsten ‚Fenster putzen‘ seit 5 Tagen.“
4. Household: „Im Haushalt sind heute insgesamt 7 offen; Julia hat 3.“ (only when more than one member)
5. Vacation/pause notice: „Urlaubsmodus bis 24. Oktober.“ (SCHEDULING-005)
6. Optional motivation from analytics: „Gestern habt ihr 6 Tenner erledigt.“
7. Closing question: „Soll ich dir den ersten Tenner nennen?“ → `SuggestIntent` behavior.

Total speech ≤ 40 s; long parts are cut with „und X weitere“.

## Content Builder

- Pure function `buildBriefing(dashboard, summary, member, household)` shared with NOTIFICATION-003 (move to a
  package both can use, or duplicate with a shared test fixture — decide in implementation, document).

## Routine Setup (documentation)

- README section with screenshots/steps: Alexa app → Routinen → Neu → Wann: Uhrzeit (z. B. 7:00) → Aktion:
  Skills → Tenner (or "Benutzerdefiniert": „sag Tenner, starte meinen Tag“) → Gerät: Echo Show Küche.
- Note: a routine runs without a recognized speaker → household-wide briefing.

---

# Architecture Considerations

- **Predictability:** fixed order and wording templates; no randomness except optional variants of the greeting.
- **Echo Show:** the briefing shows the dashboard view (ALEXA-006) while speaking.
- **Time zone:** "today" and "guten Morgen" vs. "guten Abend" follow the household timezone (from the API), not
  the device.

---

# Deliverables

```text
BriefingIntent, briefing builder with tests
README: routine setup
```

---

# Testing Requirements

```text
Full Briefing Order
Empty Day
Known vs Unknown Speaker
Single-Member Household (no household sentence)
Vacation Notice
Length Limit (≤ 40 s estimate by word count)
Time-Of-Day Greeting In Household Timezone
```

---

# Validation

```bash
npm run lint && npm run build && npm test   # alexa/
```

Manual: run via voice and via a scheduled Alexa routine.

---

# Acceptance Criteria

- Briefing covers due today, overdue, effort and household summary
- It runs on demand and from a user routine
- Tests passing

---

# Definition of Done

- The household starts the day with Tenner without opening an app
- Feature deploys through GitHub Actions

---

# Out of Scope

- Skill-provided routines (Routines Kit is discontinued)
- Weather, calendar or news in the briefing
