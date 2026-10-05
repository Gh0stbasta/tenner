# FUTURE-010: Evaluate Voice Assistant Integration

## Type

Product Feature (Postponed)

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Evaluate completing and querying Tenners by voice ("Alexa, tell Tenner I vacuumed the office").

---

# Background

Personal access tokens (INTEGRATION-009) already enable Siri via Apple Shortcuts.
Dedicated Alexa/Google Assistant skills need account linking (OAuth) and certification.
Google Conversational Actions were discontinued; check current platform status.

---

# Dependencies

```text
INTEGRATION-009
AI-008
```

---

# Scope

```text
Platform availability and certification effort
Account linking via Cognito OAuth
Value compared to Shortcuts-based approach
Decision
```

---

# Deliverables

```text
Evaluation and decision
```

---

# Acceptance Criteria

- Platforms assessed
- Decision documented

---

# Definition of Done

- Voice integration decision made

---

# Owner Decision (2026-10-05)

The household chose **Amazon Alexa with Echo Show** as its voice platform (`alexaSkill/alexaFoundation.md`). The
Alexa part of this evaluation is answered by the `alexa/` backlog (ALEXA-001 – 009): account linking via Cognito
OAuth (ALEXA-002); no certification is needed because the skill stays in development stage for the household's
Amazon account (ALEXA-001). Still open here: the comparison with the Shortcuts approach and Google Assistant.

---

# Out of Scope

- Implementation
