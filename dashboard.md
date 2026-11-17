# 🧭 Zentrale (formerly Tenner) — Executive Dashboard

> Snapshot of **2026-11-17**. Updated with every pull request (see *About this dashboard* at the end).

## 📌 Executive Summary

| | |
|---|---|
| **Project health** | 🟢 **Live**; all 1,957 automated tests pass (backend 1,151, frontend 513, alexa 165, Terraform 82, scripts 48) |
| **Current phase** | **Release 2.0.0 — Family Meal Planning, live.** Owner feedback is coming in as maintenance tickets |
| **Current focus** | This pull request: Alexa skill renamed „Mary Poppins“ (Echo confused „Familien Zentrale“ with „Familienkalender“), short shopping phrases and shopping mode, ticked items stay „vorhanden“ for the week, „Abgehakte Einträge löschen“ (MAINT-017 – 020). Amazon's own shopping list stays closed to apps (confirmed 2026-11-17) |
| **Biggest blocker** | None. Frontend-only changes, no infrastructure |
| **Recommended next action** | Merge, then test on the Echo: „Alexa, sag Mary Poppins Milch und Eier“ and „Alexa, sag Mary Poppins Einkauf“ |

## 📈 Progress

```text
Release 1.0  ████████████████████ 100%  104 / 104 tickets done (tag v1.0.0 still to set)
Release 2.0  ███████████████████░  93%   26 /  28 FOOD tickets (all features; FOOD-025 waits for the tag, FOOD-020 for data)
Maintenance  20 done (MAINT-001 – 020; device checks open) · REC 2 done (REC-001, 002) · owner hotfixes 2 done (HOTFIX-006, UI-001)
```

✅ Completed: **155** (104 + EPIC-FOOD-001 + 26 FOOD + 20 MAINT + 2 REC + 2 owner hotfixes) · 🚧 In progress: **1** (FOOD-025, tag) · 📋 Open: **1** (FOOD-020: AI evaluation, recheck 2026-12-07)

## 🧩 Feature Status

| ✅ Live in 1.0 | ✅ Release 2.0 — Essen |
|---|---|
| ✅ Google login, one household, private data | ✅ Dishes and ingredients: 105 ingredients, 61-dish catalog, editor with photos, nutrition and cost; 🆕 create a dish via chat-AI prompt and JSON (FOOD-001 – 004, 010 – 013, 021, MAINT-012) |
| ✅ Aufgaben (formerly Tenner), scheduling, household, task catalog, analytics; missed ones count as „Nicht erledigt“ (REC-001), start date (HOTFIX-006), dashboard shows the day (UI-001) | ✅ Weekly plan with rules R1 – R14 (🆕 R14: fish at most once a day), always Monday – Sunday; replace, choose, swap, lock, regenerate; cooked / skipped, 👍 / 👎, favorites (FOOD-005 – 009, 022, 023, MAINT-007, 015) |
| ✅ Phone app with offline use; 🆕 plus button creates Aufgabe, dish or shopping item by page (MAINT-008, 010) | ✅ Shopping list: own order, counts, offline, by voice, Echo Show widget, „Kopieren“, plus button adds items, pantry items in the list; 🆕 ticked items stay „vorhanden“ for the week, „Abgehakte Einträge löschen“ (FOOD-014, 026 – 028, MAINT-010, 011, 014, 019, 020) |
| ✅ Push per Aufgabe with „Erledigt“/„Später“ | ✅ Meal widget (FOOD-018) · 🆕 „Essensplan am Morgen“, „Alexa, frag Mary Poppins, was es heute gibt“, calendar feed (FOOD-016, 017, 015) |
| ✅ Alexa by voice („Mary Poppins“), widgets on the Echo Show; 🆕 „sag Mary Poppins Milch, Eier und Butter“, shopping mode (MAINT-006, 017, 018) | ✅ Auswertung „Essen“ (FOOD-019) · 🆕 dashboard names tomorrow's dishes, photo by tapping the dish picture (MAINT-009, 013) · 🔲 decision: AI in the planner (FOOD-020) |

Release 2.0 overview: [`docs/release-2.0/README.md`](docs/release-2.0/README.md) · Changelog: [`CHANGELOG.md`](CHANGELOG.md) · The app calls no AI; dish creation uses a chat AI of your choice by copy and paste.

## 💰 Cost Overview

**AI spend:** ⚪ **Not tracked.** No AI in the product (the dish prompt runs in your own chat AI); no token or cost data is recorded in the repository.

| Users | Monthly cost | Note |
|---|---|---|
| 2 (today, one household) | **< $0.30** | free tiers; up to 11 alarms (~$0.10 beyond the free 10) |
| 100 / 10,000 | n/a | would need multi-household support, which is not planned |
| Release 2.0 | **+ < $0.10** | one table, small photo bucket (~30 MB), no AI |

🛡 Budget: **$5 / month** with e-mail alerts. Throttling caps abuse at about **$2–3 per day**.

## 🧱 Technical Debt

| Level | Count | What matters |
|---|---|---|
| 🚨 High | **1** | Anyone with a Google account can claim a newly added member until that person signs in (TD-020) |
| ⚠ Medium | **14** | Backup restore never tested (TD-039) · production only (TD-040) · deploy role for PR plans · Google secret in state · global rate limit · Alexa link rights (TD-035) · unverified Amazon API shapes (TD-036) · 🆕 calendar token in the API access log (TD-047) · others |
| ✅ Low | **26** | Tidiness, bundle size, analytics simplifications · dish rules in app and server (TD-044) · unattached photo uploads (TD-045) · number fields in the rules dialog (TD-046) · editor photo button opens only the camera on phones (TD-048) · others |

41 open, 7 resolved. Each item can come back as a maintenance ticket. Details: [`docs/technical-debt.md`](docs/technical-debt.md).

## 🔐 Security

🟢 **No critical findings.** New in this PR: zod updated to 4.6.7 (high advisory GHSA-mrhx-c7xc-m3w5, MAINT-016). The dish prompt you paste into a chat AI contains only ingredient names (no people, allergies or plans). Photos in a private bucket behind CloudFront (OAC), uploads limited by signed type, size and household key; the API may only write photos. One new public route: the calendar feed, authorized by a 256-bit token stored as a hash and revocable. Allergies never leave the profile (no logs, notifications, calendar or Alexa). New dependencies: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (Apache-2.0, pinned, 0 audit findings).

⚠ Worth your attention: calendar link = read access to dish names for whoever has it · open Google sign-up (TD-020) · linked Alexa account has your full rights (TD-035) · manual checks still open ([`docs/security.md`](docs/security.md#manual-verifications)).

## 🏛 Architecture Health

| | |
|---|---|
| **ADRs** | 8 accepted, **1 proposed** ([`docs/decisions/`](docs/decisions/)): 0009 AI for meal planning; 0008 decided: category placeholders stay |
| **Pending decisions (yours)** | 1. ADR 0009: recheck with 8 weeks of data on 2026-12-07 · 2. Keep open Google sign-up? (TD-020) |
| **Open risks** | Backup restore untested (TD-039) · production only (TD-040) |

## 🎯 Recommended Next Actions

1. **Merge** this pull request, then test on the Echo: „Alexa, sag Mary Poppins Milch und Eier“, „Alexa, sag Mary Poppins Einkauf“ → „Butter“ → „fertig“. Optional routine „Alexa, Einkauf“ (alexa README).
2. **Tag `v2.0.0`** and the GitHub release (FOOD-025; also `v1.0.0` is still open).
3. **Recheck ADR 0009** on 2026-12-07 with Auswertung → Essen.
4. **Later:** log the route key instead of the path, then renew the calendar link (TD-047).

---

## ℹ About this dashboard

- **Sources:** the ticket files in `docs/release-1.0/` (frozen), `docs/release-2.0/` and `docs/backlog/` (a ticket counts as done when it has an "Implementation Status" section and its acceptance criteria are checked), [`CHANGELOG.md`](CHANGELOG.md), [`docs/roadmap.md`](docs/roadmap.md), [`docs/technical-debt.md`](docs/technical-debt.md), [`docs/security.md`](docs/security.md), [`docs/decisions/`](docs/decisions/) and GitHub Actions (45 deploy runs; runs 34, 35 and 37 – 45 green, run 36 cancelled by the next push).
- **Counting:** release 2.0: 26 of 28 FOOD tickets done (FOOD-024 closed with ADR 0008); FOOD-025 is prepared (status section) but counts as in progress until the tag exists; FOOD-020 has an evaluation section only. The epic EPIC-FOOD-001 is done. Maintenance: MAINT-001 – 020 done (device checks of MAINT-002, 005 and 006 open); REC-001 and REC-002 done; owner hotfix tickets HOTFIX-006 and UI-001 done. Release 1.0: 104 done = 91 product tickets + 6 hotfixes + 7 housekeeping tickets. Debt levels are an assessment for this dashboard.
- **Updates:** every pull request refreshes the dashboard (rule in `CLAUDE.md`). Between pull requests it can lag behind the branch (TD-032).
