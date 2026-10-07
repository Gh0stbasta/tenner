# 🧭 Tenner — Executive Dashboard

> Snapshot of **2026-10-07**. Updated with every pull request (see *About this dashboard* at the end).

## 📌 Executive Summary

| | |
|---|---|
| **Project health** | 🟢 **Released**: Tenner **1.0.0** is complete; the last five deploys are green; all 1,599 automated tests pass (backend 924, frontend 407, alexa 147, Terraform 76, scripts 45) |
| **Current phase** | **Maintenance and user recommendations.** The feature roadmap is closed (BACKLOG-003) |
| **Current focus** | This pull request: release 1.0 — open tickets removed, all tickets archived in `docs/release-1.0/`, version 1.0.0, changelog and release notes |
| **Biggest blocker** | None. Tag `v1.0.0` and the GitHub release need the merge first |
| **Recommended next action** | Merge, tag `v1.0.0`, publish the GitHub release; then finish the push setup and the catalog import if still open |

## 📈 Progress

```text
Release 1.0  ████████████████████ 100%  104 / 104 tickets done
Removed      74 tickets (6 on 2026-10-06, 68 at release)
Maintenance   0 open (MAINT 0 · REC 0)
```

✅ Completed: **104** · 🚧 In progress: **0** · 📋 Open: **0**

## 🧩 Feature Status

| ✅ Live in 1.0 | 🗑 Not built (removed) |
|---|---|
| ✅ Google login, one household, private data | Weekly summary, importance, checklists, notes, bulk actions |
| ✅ Tenners: create, edit, Quick Add, complete, undo, archive, restore, history | Data export/import, archive, retention |
| ✅ Scheduling: calendar, weekdays, snooze, skip, pause, vacation | Second environment, custom domain, extra security scans, MFA |
| ✅ Household: members (also without login), categories, shared, rotating, handover | Onboarding, accessibility audit, English UI, week view |
| ✅ Task catalog (34 Tenners), analytics page | Calendar, Strava, Garmin, automations |
| ✅ Phone app: installable, swipe, offline read and complete | AI features, multiple households, SaaS, e-mail/Telegram |
| ✅ Push per Tenner with „Erledigt“/„Später“; Alexa „Tenner Board“ with Echo Show | |

Release overview with figures and diagrams: [`docs/release-1.0/README.md`](docs/release-1.0/README.md) · [`CHANGELOG.md`](CHANGELOG.md)

## 💰 Cost Overview

**AI spend:** ⚪ **Not tracked.** No token or cost data is recorded in the repository.

| Users | Monthly cost | Note |
|---|---|---|
| 2 (today, one household) | **< $0.20** | free tiers; up to 11 alarms (~$0.10 beyond the free 10) |
| 100 / 10,000 | n/a | would need multi-household support, which is not planned |

🛡 Budget: **$5 / month** with e-mail alerts. Throttling caps abuse at about **$2–3 per day**.

## 🧱 Technical Debt

| Level | Count | What matters |
|---|---|---|
| 🚨 High | **1** | Anyone with a Google account can claim a newly added member until that person signs in (TD-020) |
| ⚠ Medium | **13** | 🆕 Backup restore never tested (TD-039) · 🆕 production is the only environment (TD-040) · deploy role for PR plans · Google secret in Terraform state · global rate limit · Alexa link rights (TD-035) and unverified Amazon API shapes (TD-036) · others |
| ✅ Low | **19** | Tidiness, bundle size, analytics simplifications, offline edge case (TD-038) |

33 open, 7 resolved (TD-001 and TD-002 resolved by this release). Each item can come back as a maintenance ticket. Details: [`docs/technical-debt.md`](docs/technical-debt.md).

## 🔐 Security

🟢 **No critical findings.** Unchanged by this release (documentation and version only).

⚠ Worth your attention: open Google sign-up (TD-020) · linked Alexa account has your full rights (TD-035) · push buttons work for 24 h for whoever sees the notification · manual checks still open (S3 public-access block, throttling burst test, [`docs/security.md`](docs/security.md#manual-verifications)).

## 🏛 Architecture Health

| | |
|---|---|
| **ADRs** | 6 accepted, **0 open** ([`docs/decisions/`](docs/decisions/)) |
| **Pending decisions (yours)** | 1. Keep open Google sign-up? (TD-020) · 2. Accept or change the codename „Grundstein“ and the slogan |
| **Open risks** | Backup restore untested (TD-039) · production only (TD-040) · Alexa widget/notification shapes unverified until first use (TD-036) |

## 🎯 Recommended Next Actions

1. **Merge this PR** and check that the deploy is green.
2. **Tag and publish:** `v1.0.0` on `main` and a GitHub release (commands in `docs/release-1.0/hotfix/release001.md`), or ask me to do it.
3. **If still open:** push setup (README → Browser push), catalog import, „Push aktivieren“ on each phone.
4. **Consider one maintenance ticket:** a one-hour restore test (TD-039) is the cheapest way to remove the biggest operational risk.

---

## ℹ About this dashboard

- **Sources:** the ticket files in `docs/release-1.0/` (frozen) and `docs/backlog/` (maintenance; a ticket counts as done when it has an "Implementation Status" section), [`CHANGELOG.md`](CHANGELOG.md), [`docs/roadmap.md`](docs/roadmap.md), [`docs/technical-debt.md`](docs/technical-debt.md), [`docs/security.md`](docs/security.md), [`docs/decisions/`](docs/decisions/) and GitHub Actions (28 deploy runs, the last five green, incl. the merge of PR #30).
- **Counting:** 104 done = 91 product tickets + 6 hotfixes + 7 housekeeping tickets (REPORTING-001/002, BACKLOG-001 – 003, CLEANUP-001, RELEASE-001); owner inputs in `docs/release-1.0/human/` and planning files with other names are not counted. Debt levels are an assessment for this dashboard.
- **Updates:** every pull request refreshes the dashboard (rule in `CLAUDE.md`). Between pull requests it can lag behind the branch (TD-032).
