# ALEXA-010: Use the Invocation Name "tenner board" and Keep the Skill Private

## Type

Configuration / Security

---

## Priority

High

---

## Phase

V2

---

## Goal

The skill is opened with „Alexa, öffne Tenner Board“ (the name the owner registered in the developer console), and it
stays a private household skill that is never offered in the Alexa Skills Store.

---

# Context

The owner created the skill in the Alexa developer console with the invocation name **„tenner board“** and set it to
the development stage (2026-10-06). The repository still uses `tenner`, so the next skill-package deployment would
overwrite the console's name. The owner does not want the skill to reach other people through the store.

A skill only becomes public after it is submitted for certification and published. A development-stage skill is
available only on the devices of the developer's Amazon account (and of invited beta testers).

---

# Requirements

- Invocation name `tenner board` in `alexa/skill-package/interactionModels/custom/de-DE.json`.
- All spoken hints, example phrases, the post-deploy health check and the documentation use „Tenner Board“ as the
  invocation („Alexa, öffne Tenner Board“, „Alexa, sag Tenner Board, starte meinen Tag“). The app name stays „Tenner“.
- Privacy safeguards:
  - CI and scripts only ever update the **development** stage; no certification submission, publication or beta
    test is automated (enforced by a test).
  - Manifest: not available worldwide, distribution limited to Germany, no store-only fields that imply publication.
  - Documentation: how the skill stays private and what the owner must never click (Submit for certification).

---

# Acceptance Criteria

- [x] Interaction model uses `tenner board`; tests check it
- [x] Spoken texts, example phrases, health check and docs say „Tenner Board“
- [x] A test fails if a workflow or script submits, publishes or beta-tests the skill
- [x] README/ADR describe how the skill stays private
- [x] Tests passing

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

---

# Assumptions

- The console accepted „tenner board“ (owner confirmed it is set up); the next deployment writes the same name.
- The skill's display name in the manifest stays „Tenner“.

---

# Out of Scope

- Publishing, certification or beta tests
- Other locales

---

# Implementation Status

Implemented 2026-10-06.

- [x] Invocation name `tenner board` in the interaction model (test updated)
- [x] „Tenner Board“ in the reminder text, example phrases, health check simulation („öffne tenner board“),
  README, runbook and ADR 0005 amendment; display name stays „Tenner“
- [x] `scripts/tests/test_alexa_private.py`: fails on certification, publishing, beta tests or the live stage in
  workflows/scripts; checks the development stage and the Germany-only manifest
- [x] `alexa/README.md` → "Private skill"
- [x] Tests passing: alexa 146, backend 863, scripts 43 (+3)
