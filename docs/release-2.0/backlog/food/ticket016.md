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

- [x] Morning notification with today's lunch and dinner
- [x] Per member on/off, time and channel
- [x] Sent at most once per day
- [x] Tests passing

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated (architecture.md notifications)
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

---

# Assumptions

- A separate message from the per-Tenner pushes (NOTIFICATION-010) keeps meals and chores apart.
- The job lives in `backend/src/notifications/meal-today.ts` next to the other jobs (the repository has no `jobs/`
  folder).
- „Default on once the meal plan is used“: the preference defaults to on; without a planned meal nothing is sent, and
  the job only exists when the meals table is configured. Channels stay empty until the member picks one (only the
  log channel then), like the other notifications.
- The vegetarian variant is named for a member whose eater (`memberId`) is vegetarian.
- Alexa speaks a reminder with both dish names (Skill Messaging, like the daily digest).

---

# Out of Scope

- Cooking-start reminders („in 20 Minuten anfangen“), thaw reminders.

---

# Implementation Status

Done (2026-10-10).

- Backend: type `MEAL_TODAY`, job `notifications/meal-today.ts` (due time, timezone, quiet hours, content, empty
  days skipped), preference `mealToday { enabled, time, channels }` (default on, 07:30; older stored preferences and
  clients get the default; connected channels only), Alexa reminder text `mealReminderText`, wiring in `notifier.ts`
  with the plan, the profile (vegetarian member) and the shopping list (open items).
- Frontend: block „Essensplan am Morgen“ in the notification settings (switch, time, channels).
- Tests: `backend/tests/meal-today.test.ts` (timing, timezone, quiet hours, content, variant, empty day,
  deduplication, preference defaults and validation, Alexa text), `alexa-channel.test.ts`, `notifier.test.ts`,
  `notification-preferences.test.ts`; frontend `NotificationSettings.test.tsx`.
- Validation: backend lint, typecheck, 1,120 tests; frontend lint, typecheck, build, 489 tests.
- Technical debt: none new.

