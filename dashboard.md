# 🧭 Tenner — Executive Dashboard

> Snapshot of **2026-10-07**. Updated with every pull request (see *About this dashboard* at the end).

## 📌 Executive Summary

| | |
|---|---|
| **Project health** | 🟢 **1.0.0 live**: the last five deploys are green (incl. PR #31); all 1,599 automated tests pass (backend 924, frontend 407, alexa 147, Terraform 76, scripts 45) |
| **Current phase** | **Release 2.0 planning — Family Meal Planning.** Release 1.0 is in maintenance |
| **Current focus** | This pull request: your release 2.0 meta ticket in ticket form (EPIC-FOOD-001), 25 FOOD tickets with order, and your six planning decisions |
| **Biggest blocker** | None. Your six decisions are answered and applied to the tickets (2026-10-07) |
| **Recommended next action** | Merge, then start FOOD-001 (architecture, ADR 0007) |

## 📈 Progress

```text
Release 1.0  ████████████████████ 100%  104 / 104 tickets done (tag v1.0.0 still to set)
Release 2.0  ░░░░░░░░░░░░░░░░░░░░   0%    0 /  25 FOOD tickets (epic planned)
Maintenance   0 open (MAINT 0 · REC 0)
```

✅ Completed: **105** (104 + EPIC-FOOD-001) · 🚧 In progress: **0** · 📋 Open: **25** (release 2.0)

## 🧩 Feature Status

| ✅ Live in 1.0 | 🔲 Release 2.0 — Essen (in order) |
|---|---|
| ✅ Google login, one household, private data | 🔲 Foundation: architecture, dishes, ingredients, family profile, 57-dish catalog (FOOD-001 – 004, 021) |
| ✅ Tenners, scheduling, household, task catalog, analytics | 🔲 Weekly plan with rules, replace, choose/swap/lock, regenerate (FOOD-005 – 009, 022) |
| ✅ Phone app with offline use | 🔲 Shopping list, dish editor, nutrition, cost, photos (FOOD-014, 010 – 013) |
| ✅ Push per Tenner with „Erledigt“/„Später“ | 🔲 Morning push, „Was gibt es heute?“, Echo Show widget, calendar feed (FOOD-016 – 018, 015) |
| ✅ Alexa „Tenner Board“ with Echo Show | 🔲 History, feedback, food analytics (FOOD-023, 019); release (FOOD-025) |

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

🟢 **No critical findings in the code.** This PR changes documentation only.

⚠ Worth your attention: family details from the original meta ticket stay in the public Git history (your decision: not sensitive; current files make them unrecognizable) · open Google sign-up (TD-020) · linked Alexa account has your full rights (TD-035) · push buttons work for 24 h for whoever sees the notification · manual checks still open (S3 public-access block, throttling burst test, [`docs/security.md`](docs/security.md#manual-verifications)).

## 🏛 Architecture Health

| | |
|---|---|
| **ADRs** | 6 accepted, **0 open** ([`docs/decisions/`](docs/decisions/)) |
| **Pending decisions (yours)** | 1. Keep open Google sign-up? (TD-020) · 2. ADR 0007 meal planning comes with FOOD-001 |
| **Open risks** | Backup restore untested (TD-039) · production only (TD-040) · Alexa widget/notification shapes unverified until first use (TD-036) |

## 🎯 Recommended Next Actions

1. **Merge this PR.**
2. **Start FOOD-001** (architecture and ADR 0007), then the foundation block.
3. **Still open from 1.0:** tag `v1.0.0` and GitHub release (`docs/release-1.0/hotfix/release001.md`).

---

## ℹ About this dashboard

- **Sources:** the ticket files in `docs/release-1.0/` (frozen), `docs/release-2.0/` and `docs/backlog/` (maintenance; a ticket counts as done when it has an "Implementation Status" section), [`CHANGELOG.md`](CHANGELOG.md), [`docs/roadmap.md`](docs/roadmap.md), [`docs/technical-debt.md`](docs/technical-debt.md), [`docs/security.md`](docs/security.md), [`docs/decisions/`](docs/decisions/) and GitHub Actions (30 deploy runs, the last five green, incl. the merge of PR #31).
- **Counting:** release 2.0: 25 FOOD tickets open, the epic EPIC-FOOD-001 done (backlog generated). Release 1.0: 104 done = 91 product tickets + 6 hotfixes + 7 housekeeping tickets (REPORTING-001/002, BACKLOG-001 – 003, CLEANUP-001, RELEASE-001); owner inputs in `docs/release-1.0/human/` and planning files with other names are not counted. Debt levels are an assessment for this dashboard.
- **Updates:** every pull request refreshes the dashboard (rule in `CLAUDE.md`). Between pull requests it can lag behind the branch (TD-032).
