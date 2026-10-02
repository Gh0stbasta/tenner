# AI-009: Implement Tenner Splitting Assistant

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

Help users apply the "Ten-Minute First" principle by splitting large responsibilities
into several small recurring Tenners.

```text
"Clean the entire house" (120 min)
→ Vacuum office (10) · Clean front door (10) · Wipe window sills (10) · ...
```

---

# Background

The architecture explicitly recommends splitting large projects into small recurring
activities. Time analytics (ANALYTICS-005) identify Tenners that exceed ten minutes.

---

# Dependencies

```text
AI-001
ANALYTICS-005
PRODUCTIVITY-005 (bulk create) or sequential create
```

---

# Scope

- Trigger: creating/editing a Tenner with `estimatedMinutes > 20`, or from the
  "exceeding estimate" list in analytics.
- `POST /ai/split-tenner { tennerId | draft }` → proposed list (2–8 items) with title,
  estimatedMinutes (≤ 15), frequency.
- User edits/selects items; selected items created; original optionally deactivated.
- Fallback without AI: manual split dialog with empty rows.

---

# Testing Requirements

```text
Schema Validation
Max Item Count
Minutes Limit
Original Deactivation Optional
Manual Fallback
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Split endpoint
Split dialog
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

- Large Tenners can be split into small ones
- User selects and confirms
- Works without AI
- Tests passing

---

# Definition of Done

- The Ten-Minute principle is actively supported

---

# Out of Scope

- Automatic splitting
