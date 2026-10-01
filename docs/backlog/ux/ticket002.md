# UX-002: Implement Keyboard Shortcuts

## Type

Frontend Feature

---

## Priority

Low

---

## Phase

V2

---

## Goal

Allow power users to operate Tenner efficiently on desktop.

---

# Background

Quick Add (FRONTEND-006) and completion (FRONTEND-007) are frequent actions.
Keyboard shortcuts reduce friction on desktop without affecting mobile.

---

# Dependencies

```text
FRONTEND-006
FRONTEND-007
```

---

# Scope

## Shortcuts

```text
n        Quick Add
/        Focus search
g d      Go to dashboard
g t      Go to Tenners
g a      Go to analytics
g s      Go to settings
j / k    Move selection in lists
c        Complete selected Tenner
u        Undo last completion
?        Show shortcut help
```

## Rules

- Shortcuts disabled while typing in inputs.
- No conflicts with browser or screen reader shortcuts.
- Help dialog lists all shortcuts.
- Implemented as a single hook `useKeyboardShortcuts` with a central registry.

---

# Testing Requirements

```text
Each Shortcut
Disabled In Inputs
Help Dialog
Selection Navigation
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Shortcut registry and hook
Help dialog
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

- Shortcuts work as listed
- No interference with typing or assistive technology
- Help dialog available
- Tests passing

---

# Definition of Done

- Desktop users can work keyboard-only
- Feature deploys through GitHub Actions

---

# Out of Scope

- Customizable shortcuts
- Command palette
