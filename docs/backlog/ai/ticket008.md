# AI-008: Implement Tenner Assistant (Q&A)

> **Note (2026-10-06, BACKLOG-001):** PRODUCTIVITY-001 (suggestions) was removed; the assistant uses the dashboard and analytics capabilities only.

## Type

Full-Stack Feature

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Let users ask questions in natural language, as envisioned in the architecture:

```text
What should I spend 20 minutes on today?
Which Tenners are most overdue?
What habits have I neglected recently?
```

---

# Background

Deterministic answers already exist via suggestions (PRODUCTIVITY-001) and analytics.
The assistant maps questions to these capabilities using tool use — the model never
computes metrics itself.

---

# Dependencies

```text
AI-001
PRODUCTIVITY-001
ANALYTICS-001 to 008
```

---

# Scope

## Architecture

```text
Question → LLM with read-only tools:
  get_dashboard, get_suggestions(minutes), get_neglected, get_habits, get_trends, get_tenner(id)
→ tool results (from existing services, tenant-scoped)
→ short answer with links to Tenners
```

- Tools are read-only. Actions (complete, snooze) are offered as UI buttons, executed only by user tap.
- Max 3 tool calls per question; max 500 characters answer.
- Conversation context: single-turn (no stored chat history) to limit cost and privacy exposure.

## Endpoint

```text
POST /ai/ask   { "question": "..." }   (max 300 characters)
```

## Frontend

Assistant input on dashboard ("Ask Tenner…") with example questions.

---

# Testing Requirements

```text
Tool Routing For Example Questions
Read-Only Tool Enforcement
Tool Call Limit
Tenant Scoping In Tools
Answer Length
Prompt Injection In Tenner Titles Does Not Trigger Actions
Eval Fixtures
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Ask endpoint
Tool definitions
UI input
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

- Example questions answered correctly using tools
- No write actions by the model
- Budget limits respected
- Tests passing

---

# Definition of Done

- Users can ask Tenner about their responsibilities

---

# Out of Scope

- Multi-turn chat
- Voice assistants (FUTURE-010)
