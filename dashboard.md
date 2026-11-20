# 🧭 Zentrale (formerly Tenner) — Executive Dashboard

> Snapshot of **2026-11-20**. Updated with every pull request (see *About this dashboard* at the end).

## 📌 Executive Summary

| | |
|---|---|
| **Project health** | 🟢 **Live**; all 1,971 automated tests pass (backend 1,151, frontend 519, alexa 172, Terraform 82, scripts 48) |
| **Current phase** | **Release 2.0.0 — Family Meal Planning, live.** Owner feedback is coming in as maintenance tickets |
| **Current focus** | This pull request: the Alexa skill is called „Butler Bruno“; „Zimmer Service“ (MAINT-025) was not found reliably on either Echo, probably because of Amazon's built-in hotel „Zimmerservice“ (MAINT-026) |
| **Biggest blocker** | Unknown whether both Echos, above all the Echo Show 21 with Alexa+, find „Butler Bruno“; owner test after the deploy |
| **Recommended next action** | Merge; then „Alexa, öffne Butler Bruno“ on both Echos, check the voice history if it fails, and rename Alexa routines |

## 📈 Progress

```text
Release 1.0  ████████████████████ 100%  104 / 104 tickets done (tag v1.0.0 still to set)
Release 2.0  ███████████████████░  93%   26 /  28 FOOD tickets (all features; FOOD-025 waits for the tag, FOOD-020 for data)
Maintenance  26 done (MAINT-001 – 026; device checks open) · REC 2 done (REC-001, 002) · owner hotfixes 2 done (HOTFIX-006, UI-001)
```

✅ Completed: **161** (104 + EPIC-FOOD-001 + 26 FOOD + 26 MAINT + 2 REC + 2 owner hotfixes) · 🚧 In progress: **1** (FOOD-025, tag) · 📋 Open: **1** (FOOD-020: AI evaluation, recheck 2026-12-07)

## 🧩 Feature Status

| ✅ Live in 1.0 | ✅ Release 2.0 — Essen |
|---|---|
| ✅ Google login, one household, private data | ✅ Dishes and ingredients: 105 ingredients, 61-dish catalog, editor with photos, nutrition and cost; 🆕 create a dish via chat-AI prompt and JSON (FOOD-001 – 004, 010 – 013, 021, MAINT-012) |
| ✅ Aufgaben (formerly Tenner), scheduling, household, task catalog, analytics; missed ones count as „Nicht erledigt“ (REC-001), start date (HOTFIX-006), dashboard shows the day (UI-001) | ✅ Weekly plan with rules R1 – R14 (🆕 R14: fish at most once a day), always Monday – Sunday; replace, choose, swap, lock, regenerate; cooked / skipped, 👍 / 👎, favorites (FOOD-005 – 009, 022, 023, MAINT-007, 015) |
| ✅ Phone app with offline use; 🆕 plus button creates Aufgabe, dish or shopping item by page (MAINT-008, 010) | ✅ Shopping list: own order, counts, offline, by voice, Echo Show widget, „Kopieren“, plus button adds items, pantry items in the list; 🆕 ticked items stay „vorhanden“ for the week, „Abgehakte Einträge löschen“ (FOOD-014, 026 – 028, MAINT-010, 011, 014, 019, 020) |
| ✅ Push per Aufgabe with „Erledigt“/„Später“ | ✅ Meal widget (FOOD-018) · 🆕 „Essensplan am Morgen“, „Alexa, frag Butler Bruno, was es heute gibt“, calendar feed (FOOD-016, 017, 015) |
| ✅ Alexa by voice (🆕 „Butler Bruno“), widgets, „sag Butler Bruno Milch und Eier“, shopping mode, „Tafel“ in the Echo Show browser via „Butler Bruno Übersicht“ (MAINT-006, 017, 018, 022, 023, 025, 026) | ✅ Auswertung „Essen“ (FOOD-019) · 🆕 dashboard names tomorrow's dishes, photo by tapping the dish picture (MAINT-009, 013) · 🔲 decision: AI in the planner (FOOD-020) |

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
| ✅ Low | **27** | Tidiness, bundle size, analytics simplifications · dish rules in app and server (TD-044) · unattached photo uploads (TD-045) · number fields in the rules dialog (TD-046) · editor photo button opens only the camera on phones (TD-048) · 🆕 only two items per voice sentence (TD-049) · others |

42 open, 7 resolved. Each item can come back as a maintenance ticket. Details: [`docs/technical-debt.md`](docs/technical-debt.md).

## 🔐 Security

🟢 **No critical findings.** Nothing security-relevant in this PR (only the Alexa invocation name). zod 4.6.7 since MAINT-016 (GHSA-mrhx-c7xc-m3w5). The dish prompt you paste into a chat AI contains only ingredient names (no people, allergies or plans). Photos in a private bucket behind CloudFront (OAC), uploads limited by signed type, size and household key; the API may only write photos. One new public route: the calendar feed, authorized by a 256-bit token stored as a hash and revocable. Allergies never leave the profile (no logs, notifications, calendar or Alexa). New dependencies: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (Apache-2.0, pinned, 0 audit findings).

⚠ Worth your attention: calendar link = read access to dish names for whoever has it · open Google sign-up (TD-020) · linked Alexa account has your full rights (TD-035) · manual checks still open ([`docs/security.md`](docs/security.md#manual-verifications)).

## 🏛 Architecture Health

| | |
|---|---|
| **ADRs** | 8 accepted, **1 proposed** ([`docs/decisions/`](docs/decisions/)): 0009 AI for meal planning; 0008 decided: category placeholders stay |
| **Pending decisions (yours)** | 1. ADR 0009: recheck with 8 weeks of data on 2026-12-07 · 2. Keep open Google sign-up? (TD-020) |
| **Open risks** | Backup restore untested (TD-039) · production only (TD-040) |

## 🎯 Recommended Next Actions

1. **Merge** this pull request; then test „Alexa, öffne Butler Bruno“ (or „starte den Skill Butler Bruno“) on the Echo Dot and the Echo Show 21, and rename Alexa routines. If only the Echo Show 21 fails: routines with fixed phrases or Alexa+ off on that device, not another rename.
2. **Tag `v2.0.0`** and the GitHub release (FOOD-025; also `v1.0.0` is still open).
3. **Recheck ADR 0009** on 2026-12-07 with Auswertung → Essen.
4. **Later:** log the route key instead of the path, then renew the calendar link (TD-047).

---

## ℹ About this dashboard

- **Sources:** the ticket files in `docs/release-1.0/` (frozen), `docs/release-2.0/` and `docs/backlog/` (a ticket counts as done when it has an "Implementation Status" section and its acceptance criteria are checked), [`CHANGELOG.md`](CHANGELOG.md), [`docs/roadmap.md`](docs/roadmap.md), [`docs/technical-debt.md`](docs/technical-debt.md), [`docs/security.md`](docs/security.md), [`docs/decisions/`](docs/decisions/) and GitHub Actions (50 deploy runs; runs 34, 35, 37 – 45 and 47 – 50 green, run 46 failed at the Alexa skill upload, run 36 cancelled by the next push).
- **Counting:** release 2.0: 26 of 28 FOOD tickets done (FOOD-024 closed with ADR 0008); FOOD-025 is prepared (status section) but counts as in progress until the tag exists; FOOD-020 has an evaluation section only. The epic EPIC-FOOD-001 is done. Maintenance: MAINT-001 – 026 done (device checks of MAINT-002, 005 and 006 open); REC-001 and REC-002 done; owner hotfix tickets HOTFIX-006 and UI-001 done. Release 1.0: 104 done = 91 product tickets + 6 hotfixes + 7 housekeeping tickets. Debt levels are an assessment for this dashboard.
- **Updates:** every pull request refreshes the dashboard (rule in `CLAUDE.md`). Between pull requests it can lag behind the branch (TD-032).
