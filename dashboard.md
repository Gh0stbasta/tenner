# 🧭 Zentrale (formerly Tenner) — Executive Dashboard

> Snapshot of **2026-10-08**. Updated with every pull request (see *About this dashboard* at the end).

## 📌 Executive Summary

| | |
|---|---|
| **Project health** | 🟢 **Live**: widgets on the Echo Show work; all 1,789 automated tests pass (backend 1,078, frontend 445, alexa 141, Terraform 77, scripts 48) |
| **Current phase** | **Release 2.0 — Family Meal Planning, in progress.** Release 1.0 is in maintenance |
| **Current focus** | This pull request: owner hotfixes — shopping list as its own menu entry (FOOD-027), missed tasks disappear and count as „nicht erledigt“ (REC-001), rename to „Zentrale“ / „Aufgaben“ (REC-002) |
| **Biggest blocker** | None |
| **Recommended next action** | Merge, then say „Alexa, öffne Familien Zentrale“ and check the widgets update their names |

## 📈 Progress

```text
Release 1.0  ████████████████████ 100%  104 / 104 tickets done (tag v1.0.0 still to set)
Release 2.0  ██████████░░░░░░░░░░  52%   14 /  27 FOOD tickets (foundation, planning, shopping list, meal widget)
Maintenance   6 done (MAINT-001 – 006; device checks open) · REC 2 accepted and done (REC-001, 002)
```

✅ Completed: **127** (104 + EPIC-FOOD-001 + 14 FOOD + 6 MAINT + 2 REC) · 🚧 In progress: **0** · 📋 Open: **13** (release 2.0)

## 🧩 Feature Status

| ✅ Live in 1.0 | 🔲 Release 2.0 — Essen (in order) |
|---|---|
| ✅ Google login, one household, private data | ✅ Foundation: meals table, 105 ingredients, dishes, family profile and rules, 61-dish catalog (FOOD-001 – 004, 021) |
| ✅ Aufgaben (formerly Tenner), scheduling, household, task catalog, analytics — 🆕 missed ones disappear and count as „Nicht erledigt“ (REC-001) | ✅ Weekly plan with rules R1 – R13, made automatically; replace, choose, swap, lock, regenerate (FOOD-005 – 009, 022) |
| ✅ Phone app with offline use | ✅ Shopping list: own order by drag and drop, ticked items struck through, offline in the shop (FOOD-014), 🆕 own menu entry (FOOD-027) · 🔲 dish editor, nutrition, cost, photos (FOOD-010 – 013) |
| ✅ Push per Tenner with „Erledigt“/„Später“ | ✅ Meal widget „Zentrale Essen“: today's lunch and dinner, from 20:00 tomorrow's (FOOD-018) · 🔲 morning push, „Was gibt es heute?“, shopping list via Alexa, calendar feed (FOOD-016, 017, 026, 015) |
| ✅ Alexa by voice, widget on the Echo Show, no screen views (MAINT-006) — 🆕 „Alexa, öffne Familien Zentrale“ (REC-002) | 🔲 History, feedback, food analytics (FOOD-023, 019); release (FOOD-025) |

Not built in 1.0: [list in the release notes](docs/release-1.0/README.md). Release 2.0 plan: [`docs/release-2.0/README.md`](docs/release-2.0/README.md) · AI stays out of 2.0 (FOOD-020, FOOD-024 are evaluations).

## 💰 Cost Overview

**AI spend:** ⚪ **Not tracked.** No token or cost data is recorded in the repository.

| Users | Monthly cost | Note |
|---|---|---|
| 2 (today, one household) | **< $0.20** | free tiers; up to 11 alarms (~$0.10 beyond the free 10) |
| 100 / 10,000 | n/a | would need multi-household support, which is not planned |
| Release 2.0 | **+ < $0.10** | one more table, small image bucket; no AI |

🛡 Budget: **$5 / month** with e-mail alerts. Throttling caps abuse at about **$2–3 per day**.

## 🧱 Technical Debt

| Level | Count | What matters |
|---|---|---|
| 🚨 High | **1** | Anyone with a Google account can claim a newly added member until that person signs in (TD-020) |
| ⚠ Medium | **13** | 🆕 Backup restore never tested (TD-039) · 🆕 production is the only environment (TD-040) · deploy role for PR plans · Google secret in Terraform state · global rate limit · Alexa link rights (TD-035) and unverified Amazon API shapes (TD-036) · others |
| ✅ Low | **21** | Tidiness, bundle size, analytics simplifications, offline edge case (TD-038) · 🆕 overdue features now mostly empty (TD-041) · 🆕 internal name „Tenner“ vs. „Zentrale“ (TD-042) |

35 open, 7 resolved. Each item can come back as a maintenance ticket. Details: [`docs/technical-debt.md`](docs/technical-debt.md).

## 🔐 Security

🟢 **No critical findings.** Meal and shopping list routes behind the same login; allergies and own shopping items are never logged. The Alexa skill stays private (development stage only, checked by tests). New dependency: dnd-kit (MIT, pinned, 0 audit findings).

⚠ Worth your attention: family details from the original meta ticket stay in the public Git history (your decision: not sensitive; current files make them unrecognizable) · open Google sign-up (TD-020) · linked Alexa account has your full rights (TD-035) · push buttons work for 24 h for whoever sees the notification · manual checks still open (S3 public-access block, throttling burst test, [`docs/security.md`](docs/security.md#manual-verifications)).

## 🏛 Architecture Health

| | |
|---|---|
| **ADRs** | 7 accepted, **0 open** ([`docs/decisions/`](docs/decisions/)): new 0007 meal planning (one table, no new service) |
| **Pending decisions (yours)** | 1. Keep open Google sign-up? (TD-020) · 2. Check the dish classification ([review sheet](docs/release-2.0/food-catalog-review.md); active times confirmed by you on 2026-10-07) |
| **Open risks** | Backup restore untested (TD-039) · production only (TD-040) · Alexa widget import and Data Store shapes unverified until the device check (TD-036, narrowed) |

## 🎯 Recommended Next Actions

1. **Merge this PR**, then: „Alexa, öffne Familien Zentrale“; the widgets should be called „Zentrale“ and „Zentrale Essen“ after their update (otherwise remove and add them); install the phone app again if its name stays „Tenner“.
2. **Your step:** rename the app in the Google sign-in screen (Google Auth Platform → Branding → app name „Zentrale“).
3. **Tomorrow morning:** yesterday's undone tasks should be gone; „Auswertung“ shows them under „Nicht erledigt“.
4. **Next:** rest of the kitchen block (FOOD-010 dish editor → 012 nutrition → 013 cost → 011 photos).
5. **Still open from 1.0:** tag `v1.0.0` and GitHub release (`docs/release-1.0/hotfix/release001.md`).

---

## ℹ About this dashboard

- **Sources:** the ticket files in `docs/release-1.0/` (frozen), `docs/release-2.0/` and `docs/backlog/` (maintenance; a ticket counts as done when it has an "Implementation Status" section), [`CHANGELOG.md`](CHANGELOG.md), [`docs/roadmap.md`](docs/roadmap.md), [`docs/technical-debt.md`](docs/technical-debt.md), [`docs/security.md`](docs/security.md), [`docs/decisions/`](docs/decisions/) and GitHub Actions (38 deploy runs; runs 34, 35, 37 and 38 green, run 36 cancelled by the next push).
- **Counting:** release 2.0: 14 of 27 FOOD tickets done (FOOD-026 added 2026-10-07; FOOD-003 with the owner's review still open counts as done), the epic EPIC-FOOD-001 done. Maintenance: MAINT-001 – 006 done (device checks of MAINT-002, 005 and 006 open); recommendations REC-001 and REC-002 accepted and done. Release 1.0: 104 done = 91 product tickets + 6 hotfixes + 7 housekeeping tickets (REPORTING-001/002, BACKLOG-001 – 003, CLEANUP-001, RELEASE-001); owner inputs in `docs/release-1.0/human/` and planning files with other names are not counted. Debt levels are an assessment for this dashboard.
- **Updates:** every pull request refreshes the dashboard (rule in `CLAUDE.md`). Between pull requests it can lag behind the branch (TD-032).
