# PRODUCTIVITY-004: Implement Completion Notes

## Type

Full-Stack Feature

---

## Priority

Low

---

## Phase

V2

---

## Goal

Allow users to attach a short note when completing a Tenner.

Examples:

```text
"Filter replaced, next one in the garage shelf"
"Tyre pressure 2.4 bar front"
```

---

# Background

Completion history is immutable. A note must therefore be provided at completion time.

---

# Dependencies

```text
TICKET-013
TICKET-020
FRONTEND-007
FRONTEND-009
```

---

# Scope

## API

Extend `POST /tenners/{tennerId}/complete` with optional:

```text
note   string, max 500 characters, trimmed
```

Return `note` in history endpoints.

## Security

Notes are user content: render as plain text only (no HTML), never log note contents.

## Frontend

- Optional "Add note" field in the completion flow (collapsed by default to keep completion one tap).
- Notes shown in the detail history and household history.

---

# Testing Requirements

```text
Complete With Note
Note Length Validation
Whitespace Trimming
Note Not Logged
Note Rendered As Text (XSS)
Idempotent Retry Keeps Note
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
API extension
History DTO extension
Completion UI extension
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

- Notes can be added at completion
- Notes visible in history
- Notes safely rendered and not logged
- One-tap completion unaffected
- Tests passing

---

# Definition of Done

- Useful context is preserved with completions
- Feature deploys through GitHub Actions

---

# Out of Scope

- Editing notes later
- Photo attachments
