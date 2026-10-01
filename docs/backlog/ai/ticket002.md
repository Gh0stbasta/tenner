# AI-002: Implement Natural Language Tenner Entry

## Type

Full-Stack Feature

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Create Tenners from natural language:

```text
"Vacuum the office every two weeks, takes 10 minutes, Julia"
"Staubsaugen Büro alle 2 Wochen"
"Review finances on the first of every month"
```

---

# Background

Quick Add (FRONTEND-006) uses defaults for all fields. Natural language entry fills
fields from one sentence. "AI-generated Tenners" was excluded from FRONTEND-006.

---

# Dependencies

```text
AI-001
FRONTEND-006
SCHEDULING-001
```

---

# Scope

## Endpoint

```text
POST /ai/parse-tenner   { "text": "..." }   (max 300 characters)
```

Response: a **draft** (not persisted):

```json
{
  "title": "Vacuum Office",
  "category": "HOUSEHOLD",
  "frequencyUnit": "WEEK",
  "frequencyInterval": 2,
  "estimatedMinutes": 10,
  "assignedTo": "JULIA",
  "confidence": { "frequency": "HIGH", "assignedTo": "HIGH" }
}
```

Output validated against the Create API validators; invalid fields fall back to defaults.

## Deterministic First

Simple patterns ("every 2 weeks", "alle 14 Tage", "monthly") are parsed by a deterministic
parser first; the model is called only when needed. This reduces cost and latency.

## Frontend

Quick Add gets an optional "✨ Parse" mode: shows the draft in the Create dialog for
confirmation. Never creates without user confirmation.

## Languages

English and German input.

---

# Testing Requirements

```text
Deterministic Parser Cases (en, de)
Model Fallback Called Only When Needed
Invalid Model Output Falls Back To Defaults
Unknown User Name Ignored
Length Limit
Draft Not Persisted
Eval Fixtures (≥ 30 examples)
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Parse endpoint
Deterministic parser
Prompt + schema
Quick Add integration
Eval fixtures
Tests
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

- Natural language produces a validated draft
- Deterministic parser handles common patterns without AI
- User confirms before creation
- Works in English and German
- Tests passing

---

# Definition of Done

- Creating a Tenner takes one sentence

---

# Out of Scope

- Voice input
- Telegram natural language (may reuse endpoint later)
