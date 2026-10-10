# 🧭 Zentrale (formerly Tenner) — Executive Dashboard

> Snapshot of **2026-10-10**. Updated with every pull request (see *About this dashboard* at the end).

## 📌 Executive Summary

| | |
|---|---|
| **Project health** | 🟢 **Live**; all 1,933 automated tests pass (backend 1,145, frontend 498, alexa 160, Terraform 82, scripts 48) |
| **Current phase** | **Release 2.0.0 — Family Meal Planning, ready to ship.** Release 1.0 is in maintenance |
| **Current focus** | This pull request: the whole food block — photos, nutrition, cost, morning notification, Alexa „Was gibt es heute?“, calendar feed, history and feedback, food analytics, release 2.0.0 (FOOD-011 – 013, 015 – 017, 019, 023, 025) |
| **Biggest blocker** | 🚨 **Before merging:** the deploy role needs rights on the new photo bucket `tenner-meal-images-prod` (README → „CI Permissions“), otherwise the deploy fails |
| **Recommended next action** | Extend the deploy role, merge, then set tag `v2.0.0` |

## 📈 Progress

```text
Release 1.0  ████████████████████ 100%  104 / 104 tickets done (tag v1.0.0 still to set)
Release 2.0  ██████████████████░░  89%   25 /  28 FOOD tickets (all features; FOOD-025 waits for the tag, FOOD-020/024 for decisions)
Maintenance   6 done (MAINT-001 – 006; device checks open) · REC 2 done (REC-001, 002) · owner hotfixes 2 done (HOTFIX-006, UI-001)
```

✅ Completed: **140** (104 + EPIC-FOOD-001 + 25 FOOD + 6 MAINT + 2 REC + 2 owner hotfixes) · 🚧 In progress: **1** (FOOD-025, tag after merge) · 📋 Open: **2** (FOOD-020, FOOD-024: evaluations)

## 🧩 Feature Status

| ✅ Live in 1.0 | ✅ Release 2.0 — Essen |
|---|---|
| ✅ Google login, one household, private data | ✅ Dishes and ingredients: 105 ingredients, 61-dish catalog, 🆕 editor with photos, nutrition and cost (FOOD-001 – 004, 010 – 013, 021) |
| ✅ Aufgaben (formerly Tenner), scheduling, household, task catalog, analytics; missed ones count as „Nicht erledigt“ (REC-001), start date (HOTFIX-006), dashboard shows the day (UI-001) | ✅ Weekly plan with rules R1 – R13; replace, choose, swap, lock, regenerate; 🆕 cooked / skipped, 👍 / 👎, favorites the planner learns from (FOOD-005 – 009, 022, 023) |
| ✅ Phone app with offline use | ✅ Shopping list: own order, counts, offline, by voice and as Echo Show widget (FOOD-014, 026 – 028) |
| ✅ Push per Aufgabe with „Erledigt“/„Später“ | ✅ Meal widget (FOOD-018) · 🆕 „Essensplan am Morgen“, „Alexa, frag Familien Zentrale, was es heute gibt“, calendar feed (FOOD-016, 017, 015) |
| ✅ Alexa by voice, widgets on the Echo Show (MAINT-006) | ✅ 🆕 Auswertung „Essen“ (FOOD-019) · 🔲 decisions: AI (FOOD-020), stock/AI images (FOOD-024) |

Release 2.0 overview: [`docs/release-2.0/README.md`](docs/release-2.0/README.md) · Changelog: [`CHANGELOG.md`](CHANGELOG.md) · AI stays out of 2.0.

## 💰 Cost Overview

**AI spend:** ⚪ **Not tracked.** No AI in the product; no token or cost data is recorded in the repository.

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
| ✅ Low | **25** | Tidiness, bundle size, analytics simplifications · dish rules in app and server (TD-044) · 🆕 unattached photo uploads (TD-045) · 🆕 number fields in the rules dialog (TD-046) · others |

40 open, 7 resolved. Each item can come back as a maintenance ticket. Details: [`docs/technical-debt.md`](docs/technical-debt.md).

## 🔐 Security

🟢 **No critical findings.** Photos in a private bucket behind CloudFront (OAC), uploads limited by signed type, size and household key; the API may only write photos. One new public route: the calendar feed, authorized by a 256-bit token stored as a hash and revocable. Allergies never leave the profile (no logs, notifications, calendar or Alexa). New dependencies: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (Apache-2.0, pinned, 0 audit findings).

⚠ Worth your attention: calendar link = read access to dish names for whoever has it · open Google sign-up (TD-020) · linked Alexa account has your full rights (TD-035) · manual checks still open ([`docs/security.md`](docs/security.md#manual-verifications)).

## 🏛 Architecture Health

| | |
|---|---|
| **ADRs** | 7 accepted, **2 proposed** ([`docs/decisions/`](docs/decisions/)): 0008 images for dishes without a photo, 0009 AI for meal planning |
| **Pending decisions (yours)** | 1. ADR 0008: keep placeholders (recommended) or stock/AI images · 2. ADR 0009: recheck with 8 weeks of data on 2026-12-07 · 3. Keep open Google sign-up? (TD-020) |
| **Open risks** | Backup restore untested (TD-039) · production only (TD-040) · new photo bucket needs deploy-role rights before the merge |

## 🎯 Recommended Next Actions

1. **Your step before merging:** give `GitHubActionsDeployRole` the bucket rights for `tenner-meal-images-prod` incl. CORS (README → „CI Permissions“).
2. **Merge**, then follow „Getting Started“ in the release notes: catalog, profile, notification, calendar, widgets.
3. **Tag `v2.0.0`** and the GitHub release (FOOD-025; also `v1.0.0` is still open).
4. **Decide ADR 0008** (images); **recheck ADR 0009** on 2026-12-07 with Auswertung → Essen.
5. **Later:** log the route key instead of the path, then renew the calendar link (TD-047).

---

## ℹ About this dashboard

- **Sources:** the ticket files in `docs/release-1.0/` (frozen), `docs/release-2.0/` and `docs/backlog/` (a ticket counts as done when it has an "Implementation Status" section and its acceptance criteria are checked), [`CHANGELOG.md`](CHANGELOG.md), [`docs/roadmap.md`](docs/roadmap.md), [`docs/technical-debt.md`](docs/technical-debt.md), [`docs/security.md`](docs/security.md), [`docs/decisions/`](docs/decisions/) and GitHub Actions (41 deploy runs; runs 34, 35 and 37 – 41 green, run 36 cancelled by the next push).
- **Counting:** release 2.0: 25 of 28 FOOD tickets done; FOOD-025 is prepared (status section) but counts as in progress until the tag exists; FOOD-020 and FOOD-024 have evaluation sections only. The epic EPIC-FOOD-001 is done. Maintenance: MAINT-001 – 006 done (device checks of MAINT-002, 005 and 006 open); REC-001 and REC-002 done; owner hotfix tickets HOTFIX-006 and UI-001 done. Release 1.0: 104 done = 91 product tickets + 6 hotfixes + 7 housekeeping tickets. Debt levels are an assessment for this dashboard.
- **Updates:** every pull request refreshes the dashboard (rule in `CLAUDE.md`). Between pull requests it can lag behind the branch (TD-032).
