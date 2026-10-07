# DATA-008: Import the Household Task Catalog

## Type

Full-Stack Feature

---

## Priority

High

---

## Phase

V2

---

## Goal

The household's recurring responsibilities are in Tenner without entering them by hand, so Tenner replaces the
Google Calendar workflow.

---

# Background

Owner ticket `docs/human/householdTaskSeed.md` (2026-10-07; its ID „DATA-001“ was taken, so this is DATA-008).
Owner decisions 2026-10-07: import once into the existing household (idempotent, existing titles skipped), German
titles, „Haushaltshilfe“ as a member without login (HOUSEHOLD-ADMIN-006).

---

# Dependencies

```text
HOUSEHOLD-ADMIN-006
SCHEDULING-001/002 (DAY and weekday-bound WEEK recurrences)
```

---

# Scope

## Catalog (`backend/src/catalog/household-catalog.ts`)

| Group | Tenners | Recurrence | Assignee |
|---|---|---|---|
| Daily | Saugroboter Erdgeschoss / Obergeschoss (1 min), Küche abends klar machen (10), Wäsche-Runde (10) | every day | Stefan; Wäsche: Julia |
| Every 3 days | Müll rausbringen (5) | every 3 days | Stefan |
| Weekly | Mo: Kleines Bad (10), Spiegel putzen (5) · Di: Obergeschoss abstauben (10), Bad oben (10) · Mi: Erdgeschoss abstauben (10) | every week on that day | Stefan; Bad oben: Julia |
| Household help | Böden gründlich reinigen (60), Staub wischen (60) | every week | Haushaltshilfe |
| 12-week rotation | 12 Tenners (Kühlschrank, Backofen, ausmisten …) | every 12 weeks on Friday, one per Friday | Stefan |
| 26-week rotation | 10 Tenners (Fenster Teil 1–4, Rauchmelder …) | every 26 weeks on Saturday, one per Saturday | Stefan |

Thursday (joker day) and Sunday stay free.

## Import

- `POST /household/catalog` (`{ "dryRun": true }` = preview); regular member and Tenner services (validation,
  categories, assignees), first due date = the next matching weekday plus the rotation slot in weeks.
- Settings → „Aufgabenkatalog“: „Katalog prüfen“ (dry run) → summary → „Jetzt importieren“.

---

# Acceptance Criteria

- [x] Stefan tasks available
- [x] Julia tasks available
- [x] Haushaltshilfe available (member without login)
- [x] Daily tasks configured (incl. every 3 days)
- [x] Weekly tasks configured on their weekdays
- [x] 12-week cycle configured (12 Tenners, Fridays, staggered)
- [x] 26-week cycle configured (10 Tenners, Saturdays, staggered)
- [x] Import is one action in the app and safe to repeat (existing titles and members skipped)
- [x] Tests passing: backend 877, frontend 390, Terraform 74; lint, typecheck and build clean

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated (`backend/README.md` API table, this ticket)
- [x] Technical debt documented (none new)
- [x] Acceptance criteria verified
- [ ] Import run in production — owner, after deploy (Settings → Aufgabenkatalog)
- [x] Git commit created

---

# Assumptions

- **Import in the app instead of a GitHub Action:** an Action would need data write permissions for the deploy role
  and would bypass the services' validation. An authenticated endpoint uses the normal rules and needs no new AWS
  permissions. It stays a one-time, repeatable action.
- **„Execute automatically for newly created households“:** households are not created in the app (one household).
  The import is the manual equivalent; an automatic run can follow with multi-household support.
- **Rotation as 12 (26) separate Tenners:** each repeats every 12 (26) weeks on its weekday. The first due dates are
  one per week, so one rotation Tenner falls on each Friday (Saturday). The 26-week catalog has 10 entries, so 16
  Saturdays per cycle stay free. Late completion moves a Tenner to the next matching weekday (SCHEDULING-002).
- **Household help weekly tasks** have no fixed day (completion-based weeks, first due today).
- Descriptions from the owner list (e.g. what the laundry cycle includes) are not stored: Tenners have no description
  field.
- Categories chosen per task (Haushalt by default; Haus & Garten, Familie, Finanzen where they fit).

---

# Out of Scope

- Push reminders for these Tenners (`docs/human/mobileReminder.md`, separate tickets).

---

# Implementation Status

Done (2026-10-07). Owner action after deploy: Settings → Aufgabenkatalog → „Katalog prüfen“ → „Jetzt importieren“.
