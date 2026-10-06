# 🧭 Tenner — Executive Dashboard

> Snapshot of **2026-10-06**. Updated with every pull request (see *About this dashboard* at the end).

## 📌 Executive Summary

| | |
|---|---|
| **Project health** | 🟢 **Healthy**: the last deploy (HOTFIX-006) is green, the Alexa health check is skipped only when Amazon's simulator fails; all automated tests pass (backend 863, alexa 147, frontend 385, Terraform 74, scripts 45) |
| **Current phase** | Phase 2 (V2, "daily usefulness"). Phase 1 (MVP) is live |
| **Current focus** | This pull request: backlog and code cleanup (push, e-mail/Telegram reminders, Telegram bot and "I have X minutes" removed) and offline use of the app: read the last state and complete Tenners without a connection |
| **Biggest blocker** | None in the code. Alexa still needs your remaining activation steps (Parameter Store values, SNS confirmations, Alexa app permissions) |
| **Recommended next action** | Merge, then test offline on your phone: open Tenner in flight mode, complete a Tenner, switch the connection back on |

## 📈 Progress

```text
Overall   ████████████░░░░░░░░  59%   97 / 165 tickets
Phase 1   ████████████████████ 100%   53 / 53   MVP + hotfixes (live since 2026-10-02)
Phase 2   ██████████░░░░░░░░░░  52%   44 / 84   V2 (Alexa, analytics, household, admin, scheduling, offline complete)
Phase 3   ░░░░░░░░░░░░░░░░░░░░   0%    0 / 28   Long-Term
```

✅ Completed: **97** · 🚧 In progress: **0** · 📋 Open: **68** · Total: **165**

## 🧩 Feature Status

| ✅ Live or ready with this PR | 🔲 Missing (in roadmap order) |
|---|---|
| ✅ Google login, one household, private data | 🔲 Weekly summary (NOTIFICATION-008) |
| ✅ Create, edit, complete, undo, archive, restore Tenners | 🔲 Importance, checklists, completion notes, bulk actions (PRODUCTIVITY-002 – 005) |
| ✅ Dashboard, Quick Add, history, settings (German web app) | 🔲 Backups tested, runbooks for the rest (OPERATIONS) |
| ✅ Calendar scheduling: weekdays, months, snooze, skip, pause, vacation | 🔲 Data export, integrations (Strava, calendar), AI (opt-in) |
| ✅ Household setup: members, categories, shared and rotating Tenners, handover | |
| ✅ Analytics page and phone app (installable, swipe to complete) | |
| ✅ Alexa „Tenner Board“, reminders via Alexa, monitoring and alarms | |
| 🆕 **Offline:** last known Tenners without a connection (up to 7 days) and completing offline with automatic transfer | |

🗑 Dropped by you (2026-10-06): phone push, e-mail and Telegram reminders, the Telegram bot, "I have X minutes" suggestions — removed from backlog and code.

## 💰 Cost Overview

**AI spend:** ⚪ **Not tracked.** No token or cost data is recorded in the repository, so the token count and cost are unknown.

**Infrastructure** (AWS, `eu-central-1` + Alexa skill in `eu-west-1`; order of magnitude):

| Users | Monthly cost | Note |
|---|---|---|
| 2 (today, one household) | **< $0.20** | free tiers; up to 11 alarms (~$0.10 beyond the free 10) |
| 100 (~50 households) | **~ $1–2** | needs multi-household support first |
| 10,000 (~5,000 households) | **~ $150–200** | needs multi-household support and higher API limits |

The notifier runs every 15 minutes (~2,900 runs/month, free); Alexa APIs and Parameter Store are free.

🛡 Budget: **$5 / month** with e-mail alerts. Under abuse, throttling caps the worst case at about **$2–3 per day**.

## 🧱 Technical Debt

| Level | Count | What matters |
|---|---|---|
| 🚨 High | **1** | Anyone with a Google account can claim a newly added member until that person signs in (TD-020) |
| ⚠ Medium | **11** | Deploy role used for PR plans · Google secret in Terraform state · API can change login groups · global rate limit · handover give-back only on app open · pause edge cases · smoke tests without login · planned services lack ADRs · Alexa deploy script and Amazon API shapes not yet run against Amazon (TD-034, TD-036) · Alexa link has full member rights for 10 years (TD-035) |
| ✅ Low | **21** | Tidiness, bundle size, analytics simplifications, offline completion lost if completed later online (TD-038) |

33 open, 5 resolved. Details: [`docs/technical-debt.md`](docs/technical-debt.md).

## 🔐 Security

🟢 **No critical findings.**

⚠ Worth your attention:

1. **Open Google sign-up:** a member you add in the app can be claimed by a stranger until the real person signs in (TD-020).
2. **Alexa:** the skill stays private (development stage, never submitted — a test enforces it); a linked Alexa account acts with your full rights (TD-035). Secrets live only in Parameter Store, never in Terraform state.
3. **Offline data:** household Tenner data stays in the phone's browser for up to 7 days or until logout (MOBILE-003).
4. **Manual checks still open:** the AWS account-wide S3 public-access block and the throttling burst test ([`docs/security.md`](docs/security.md#manual-verifications)).

## 🏛 Architecture Health

| | |
|---|---|
| **ADRs** | 6 accepted, **0 open** ([`docs/decisions/`](docs/decisions/)): new are 0004 secrets (Parameter Store), 0005 Alexa platform, 0006 alarm e-mails (SNS) |
| **Pending decisions (yours)** | 1. Keep open Google sign-up? (TD-020) · 2. Delete the duplicate TICKET-003 file (TD-001) · 3. Widget go/no-go after the Echo Show test (ALEXA-007) |
| **Open risks** | Production is the only environment (TICKET-021) · backup restore never tested (OPERATIONS-003) · Alexa widget/notification request shapes unverified until first use (TD-036) |

## 🎯 Recommended Next Actions

1. **Merge this PR** and check that the deploy is green.
2. **Test offline on the phone:** flight mode → open Tenner (last state shown) → complete a Tenner → connection on → „✅ … übertragen“.
3. **Finish Alexa activation:** LWA parameters in Parameter Store, SNS e-mails, reminders/notifications in the Alexa app, then choose Alexa in Einstellungen → Benachrichtigungen.
4. **Next block:** weekly summary (NOTIFICATION-008) or importance/checklists (PRODUCTIVITY-002 – 005).

---

## ℹ About this dashboard

- **Sources:** the ticket files in `docs/backlog/` and `docs/hotfix/` (a ticket counts as done when it has an "Implementation Status" section), [`docs/roadmap.md`](docs/roadmap.md), [`docs/technical-debt.md`](docs/technical-debt.md), [`docs/security.md`](docs/security.md), [`docs/architecture.md`](docs/architecture.md) and GitHub Actions (latest deploy after PR #28 green with the Alexa health check skipped; the four before it failed and were fixed by HOTFIX-003 – 006).
- **Counting:** 166 ticket files minus one duplicate (TD-001) gives 165 tickets (6 tickets removed by BACKLOG-001/002); planning tickets with other file names (e.g. `alexaSkill/alexaFoundation.md`) are not counted. Tickets with open manual checks (e.g. device tests) count as done once implemented. The debt levels (High, Medium, Low) are an assessment made for this dashboard; the debt file itself has no severity field.
- **Updates:** every pull request refreshes the dashboard (rule in `CLAUDE.md`). Between pull requests it can lag behind the branch (TD-032).
