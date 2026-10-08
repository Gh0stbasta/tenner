# 🧭 Tenner — Executive Dashboard

> Snapshot of **2026-10-07**. Updated with every pull request (see *About this dashboard* at the end).

## 📌 Executive Summary

| | |
|---|---|
| **Project health** | 🟡 **Live, alarm on the widget**: the last deploy (PR #35) is green and the Echo Show widget can be added, but loading it sets off `tenner-alexa-skill-error-rate` — this PR fixes it; all 1,784 automated tests pass (backend 1,057, frontend 443, alexa 160, Terraform 76, scripts 48) |
| **Current phase** | **Release 2.0 — Family Meal Planning, in progress.** Release 1.0 is in maintenance |
| **Current focus** | This pull request: widget system messages no longer count as skill errors (MAINT-004) |
| **Biggest blocker** | None; until this PR is deployed the widget sets off false skill-error alarms |
| **Recommended next action** | Merge, reload the widget on the Echo Show 21 and check that the alarm stays quiet |

## 📈 Progress

```text
Release 1.0  ████████████████████ 100%  104 / 104 tickets done (tag v1.0.0 still to set)
Release 2.0  █████████░░░░░░░░░░░  46%   12 /  26 FOOD tickets (foundation, planning, shopping list)
Maintenance   4 done (MAINT-001 – 004; device checks open) · REC 0
```

✅ Completed: **121** (104 + EPIC-FOOD-001 + 12 FOOD + 4 MAINT) · 🚧 In progress: **0** · 📋 Open: **14** (release 2.0)

## 🧩 Feature Status

| ✅ Live in 1.0 | 🔲 Release 2.0 — Essen (in order) |
|---|---|
| ✅ Google login, one household, private data | ✅ Foundation: meals table, 105 ingredients, dishes, family profile and rules, 61-dish catalog (FOOD-001 – 004, 021) |
| ✅ Tenners, scheduling, household, task catalog, analytics | ✅ Weekly plan with rules R1 – R13, made automatically; replace, choose, swap, lock, regenerate (FOOD-005 – 009, 022) |
| ✅ Phone app with offline use | 🆕 Shopping list: own order by drag and drop, ticked items struck through, offline in the shop (FOOD-014) · 🔲 dish editor, nutrition, cost, photos (FOOD-010 – 013) |
| ✅ Push per Tenner with „Erledigt“/„Später“ | 🔲 Morning push, „Was gibt es heute?“, shopping list via Alexa, meal widget, calendar feed (FOOD-016, 017, 026, 018, 015) |
| ✅ Alexa „Tenner Board“ with Echo Show — 🆕 widget live (MAINT-002 – 004) | 🔲 History, feedback, food analytics (FOOD-023, 019); release (FOOD-025) |

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
| ✅ Low | **19** | Tidiness, bundle size, analytics simplifications, offline edge case (TD-038) |

33 open, 7 resolved (TD-001 and TD-002 resolved by this release). Each item can come back as a maintenance ticket. Details: [`docs/technical-debt.md`](docs/technical-debt.md).

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

1. **Merge this PR**, then load the widget again; if an alarm comes, send me the skill log line (`apl_runtime_error`, `datastore_error` or `unhandled_request`).
2. **Echo Show 21:** check that the widget shows today's numbers; after a longer pause „Alexa, öffne Tenner Board“ (cold start fix).
3. **Essen → Einkaufsliste:** try sorting by drag and drop on the phone; if not done yet: family profile and dish catalog in Einstellungen, [review sheet](docs/release-2.0/food-catalog-review.md).
4. **Next:** rest of the kitchen block (FOOD-010 dish editor → 012 nutrition → 013 cost → 011 photos).
5. **Still open from 1.0:** tag `v1.0.0` and GitHub release (`docs/release-1.0/hotfix/release001.md`).

---

## ℹ About this dashboard

- **Sources:** the ticket files in `docs/release-1.0/` (frozen), `docs/release-2.0/` and `docs/backlog/` (maintenance; a ticket counts as done when it has an "Implementation Status" section), [`CHANGELOG.md`](CHANGELOG.md), [`docs/roadmap.md`](docs/roadmap.md), [`docs/technical-debt.md`](docs/technical-debt.md), [`docs/security.md`](docs/security.md), [`docs/decisions/`](docs/decisions/) and GitHub Actions (34 deploy runs; run 34 for PR #35 green incl. the skill package import, run 33 red at that step).
- **Counting:** release 2.0: 12 of 26 FOOD tickets done (FOOD-026 added 2026-10-07; FOOD-003 with the owner's review still open counts as done), the epic EPIC-FOOD-001 done. Maintenance: MAINT-001 – 004 done (device checks of MAINT-002 and MAINT-004 open). Release 1.0: 104 done = 91 product tickets + 6 hotfixes + 7 housekeeping tickets (REPORTING-001/002, BACKLOG-001 – 003, CLEANUP-001, RELEASE-001); owner inputs in `docs/release-1.0/human/` and planning files with other names are not counted. Debt levels are an assessment for this dashboard.
- **Updates:** every pull request refreshes the dashboard (rule in `CLAUDE.md`). Between pull requests it can lag behind the branch (TD-032).
