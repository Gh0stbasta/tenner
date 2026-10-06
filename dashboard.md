# 🧭 Tenner — Executive Dashboard

> Snapshot of **2026-10-06**. Updated with every pull request (see *About this dashboard* at the end).

## 📌 Executive Summary

| | |
|---|---|
| **Project health** | 🟢 **Healthy**: every deploy to `main` is green and all automated tests pass (backend 863, alexa 146, frontend 356, Terraform 74, scripts 43) |
| **Current phase** | Phase 2 (V2, "daily usefulness"). Phase 1 (MVP) is live |
| **Current focus** | This pull request: the whole Alexa & Echo Show feature, reminders (daily digest, overdue alerts), secrets, monitoring and alarms |
| **Biggest blocker** | None in the code. Going live needs your activation steps after the merge (account linking, Parameter Store values, SNS confirmations) |
| **Recommended next action** | Merge, watch the deploy, then follow the activation list (`alexa/README.md`) and say „Alexa, öffne Tenner Board“ |

## 📈 Progress

```text
Overall   ███████████░░░░░░░░░  54%   88 / 164 tickets
Phase 1   ████████████████████ 100%   46 / 46   MVP + hotfixes (live since 2026-10-02)
Phase 2   █████████░░░░░░░░░░░  47%   42 / 89   V2 (Alexa, analytics, household, admin, scheduling complete)
Phase 3   ░░░░░░░░░░░░░░░░░░░░   0%    0 / 29   Long-Term
```

✅ Completed: **88** · 🚧 In progress: **0** · 📋 Open: **76** · Total: **164**

## 🧩 Feature Status

| ✅ Live or ready with this PR | 🔲 Missing (in roadmap order) |
|---|---|
| ✅ Google login, one household, private data | 🔲 **Push notifications** on the phone (MOBILE-006) |
| ✅ Create, edit, complete, undo, archive, restore Tenners | 🔲 Telegram / e-mail as reminder channels (NOTIFICATION-005 – 007) |
| ✅ Dashboard, Quick Add, history, settings (German web app) | 🔲 **"I have 10 minutes"** suggestions |
| ✅ Calendar scheduling: weekdays, months, snooze, skip, pause, vacation | 🔲 Backups tested, runbooks for the rest (OPERATIONS) |
| ✅ Household setup: members, categories, shared and rotating Tenners, handover | 🔲 Data export, integrations (Strava, calendar), AI (opt-in) |
| ✅ Analytics page and phone app (installable, swipe to complete) | 🔲 Offline completing |
| 🆕 **Alexa „Tenner Board“:** voice questions, complete by voice, briefing, Echo Show dashboard and widget, Alexa reminders (private skill, needs activation) | |
| 🆕 **Reminders:** daily digest and overdue alerts with personal settings (sent to Alexa or the log until more channels exist) | |
| 🆕 **Monitoring:** CloudWatch dashboard, alarms by e-mail, secrets in Parameter Store | |

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
| ✅ Low | **20** | Tidiness, bundle size, analytics simplifications; no user impact |

32 open, 4 resolved. Details: [`docs/technical-debt.md`](docs/technical-debt.md).

## 🔐 Security

🟢 **No critical findings.**

⚠ Worth your attention:

1. **Open Google sign-up:** a member you add in the app can be claimed by a stranger until the real person signs in (TD-020).
2. **Alexa:** the skill stays private (development stage, never submitted — a test enforces it); a linked Alexa account acts with your full rights (TD-035). Secrets live only in Parameter Store, never in Terraform state.
3. **Manual checks still open:** the AWS account-wide S3 public-access block and the throttling burst test ([`docs/security.md`](docs/security.md#manual-verifications)).

## 🏛 Architecture Health

| | |
|---|---|
| **ADRs** | 6 accepted, **0 open** ([`docs/decisions/`](docs/decisions/)): new are 0004 secrets (Parameter Store), 0005 Alexa platform, 0006 alarm e-mails (SNS) |
| **Pending decisions (yours)** | 1. Keep open Google sign-up? (TD-020) · 2. Delete the duplicate TICKET-003 file (TD-001) · 3. Widget go/no-go after the Echo Show test (ALEXA-007) |
| **Open risks** | Production is the only environment (TICKET-021) · backup restore never tested (OPERATIONS-003) · Alexa widget/notification request shapes unverified until first use (TD-036) |

## 🎯 Recommended Next Actions

1. **Merge this PR** and check that the deploy, „Deploy Alexa skill package“ and „Alexa health check“ are green.
2. **Activate Alexa:** confirm the SNS e-mails, enter the account-linking values in the developer console, link in the Alexa app, set the two LWA parameters in Parameter Store, then „Alexa, öffne Tenner Board“.
3. **Choose Alexa** for the daily digest / overdue alerts in Einstellungen → Benachrichtigungen and allow reminders.
4. **Echo Show widget test** (1 day) and record the result in `docs/backlog/alexa/ticket007.md`.
5. **Next block:** phone push notifications (MOBILE-006) or Telegram (NOTIFICATION-006) as a second reminder channel.

---

## ℹ About this dashboard

- **Sources:** the ticket files in `docs/backlog/` and `docs/hotfix/` (a ticket counts as done when it has an "Implementation Status" section), [`docs/roadmap.md`](docs/roadmap.md), [`docs/technical-debt.md`](docs/technical-debt.md), [`docs/security.md`](docs/security.md), [`docs/architecture.md`](docs/architecture.md) and GitHub Actions (last 5 deploys green).
- **Counting:** 165 ticket files minus one duplicate (TD-001) gives 164 tickets; planning tickets with other file names (e.g. `alexaSkill/alexaFoundation.md`) are not counted. Tickets with open manual checks (e.g. device tests) count as done once implemented. The debt levels (High, Medium, Low) are an assessment made for this dashboard; the debt file itself has no severity field.
- **Updates:** every pull request refreshes the dashboard (rule in `CLAUDE.md`). Between pull requests it can lag behind the branch (TD-032).
