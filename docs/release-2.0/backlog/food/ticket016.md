# FOOD-016: Meal Notifications

## Type

Backend Feature / Frontend

---

## Priority

High

---

## Phase

2.0 Extended

---

## Goal

Every morning each member who wants it gets „🍽️ Heute: Mittag Onigiri · Abend Linseneintopf“ on the phone or via
Alexa — and knows in the morning whether something has to be thawed or bought.

---

# Background

Owner breakdown FOOD-016. The notifier (NOTIFICATION-001), preferences (NOTIFICATION-002), browser push
(NOTIFICATION-009 – 011) and Alexa notifications (ALEXA-008) exist; this ticket adds a job and a preference.

---

# Dependencies

```text
FOOD-006
NOTIFICATION-001, 002, 009
ALEXA-008
```

---

# Scope

## Job `MEAL_TODAY` (`backend/src/notifications/jobs/meal-today.ts`)

- Due at the member's meal notification time (new preference, default 07:30, own or household timezone, not in
  quiet hours); once per member per day (delivery key with local date).
- Content: today's lunch and dinner (dish names, vegetarian variant if relevant for the member), deep link to
  `/essen`; skipped when both slots are empty or marked skipped.
- Optional hint line (soft): „Einkaufsliste: 3 Dinge offen“ when the shopping list for the week has unchecked items.
- Channels: push and Alexa (member's channel choice), log channel always.
- No health data in the text.

## Preference

- Settings → Benachrichtigungen → „Essensplan am Morgen“: on/off (default on once the meal plan is used), time,
  channels.

---

# Testing Requirements

```text
Due at the member's time and timezone, not in quiet hours
Once per day (deduplication)
Content: names, variant hint, link; empty day skipped
Channel selection; failures isolated
Preference validation and UI
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Notifier job, preference field, settings UI
Tests
```

---

# Validation

```bash
cd backend && npm run lint && npm run typecheck && npm test
cd frontend && npm run lint && npm run build && npm test
```

---

# Acceptance Criteria

- [ ] Morning notification with today's lunch and dinner
- [ ] Per member on/off, time and channel
- [ ] Sent at most once per day
- [ ] Tests passing

---

# Definition of Done

- [ ] Implementation completed
- [ ] Tests completed
- [ ] Documentation updated (architecture.md notifications)
- [ ] Technical debt documented
- [ ] Acceptance criteria verified
- [ ] Git commit created

---

# Assumptions

- A separate message from the per-Tenner pushes (NOTIFICATION-010) keeps meals and chores apart.

---

# Out of Scope

- Cooking-start reminders („in 20 Minuten anfangen“), thaw reminders.
