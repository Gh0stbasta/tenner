# 🧭 Tenner — Executive Dashboard

> Snapshot of **2026-10-05**. Updated by hand after each completed block (see *About this dashboard* at the end).

## 📌 Executive Summary

| | |
|---|---|
| **Project health** | 🟢 **Healthy**: every deploy to `main` is green and all automated tests pass |
| **Current phase** | Phase 2 (V2, "daily usefulness"). Phase 1 (MVP) is live |
| **Current focus** | Nothing in progress. Last finished: *Household setup* (members, categories, shared and rotating Tenners, handover) |
| **Biggest blocker** | **Reminders need your decision:** where to store secrets (ADR for SSM Parameter Store vs. Secrets Manager) |
| **Recommended next action** | Make the secrets decision, then start the *Reminders* block (SECURITY-006 → NOTIFICATION-001 → 002 → 003) |

## 📈 Progress

```text
Overall   ████████░░░░░░░░░░░░  38%   58 / 153 tickets
Phase 1   ████████████████████ 100%   45 / 45   MVP + hotfixes (live since 2026-10-02)
Phase 2   ███░░░░░░░░░░░░░░░░░  16%   13 / 79   V2 (2 of 12 themes done)
Phase 3   ░░░░░░░░░░░░░░░░░░░░   0%    0 / 29   Long-Term
```

✅ Completed: **58** · 🚧 In progress: **0** · 📋 Open: **95** · Total: **153**

## 🧩 Feature Status

| ✅ Live | 🔲 Missing (in roadmap order) |
|---|---|
| ✅ Google login, one household, private data | 🔲 **Reminders** (daily digest, Telegram, overdue alerts) |
| ✅ Create, edit, complete, undo, archive, restore Tenners | 🔲 **Analytics page** (trends, fairness, neglected Tenners) |
| ✅ Dashboard, Quick Add, history, settings (German web app) | 🔲 **Phone app** (installable PWA, push) |
| ✅ Calendar scheduling: weekdays, months, snooze, skip, pause, vacation | 🔲 **"I have 10 minutes"** suggestions |
| ✅ Household setup: members, categories, shared and rotating Tenners, handover | 🔲 **Alarms, backups tested, runbooks** |
| ✅ CI/CD, Terraform, cost alerts, smoke tests, security baseline | 🔲 Data export, integrations (Strava, calendar), AI (opt-in) |

## 💰 Cost Overview

**AI spend:** ⚪ **Not tracked.** No token or cost data is recorded in the repository, so the token count and cost are unknown.

**Infrastructure** (AWS, `eu-central-1`; order of magnitude):

| Users | Monthly cost | Note |
|---|---|---|
| 2 (today, one household) | **< $0.10** | almost everything inside the free tiers |
| 100 (~50 households) | **~ $1–2** | needs multi-household support first |
| 10,000 (~5,000 households) | **~ $150–200** | needs multi-household support and higher API limits |

🛡 Budget: **$5 / month** with e-mail alerts. Under abuse, throttling caps the worst case at about **$2–3 per day**.

## 🧱 Technical Debt

| Level | Count | What matters |
|---|---|---|
| 🚨 High | **1** | Anyone with a Google account can claim a newly added member until that person signs in (TD-020) |
| ⚠ Medium | **8** | Deploy role used for PR plans · Google secret in Terraform state · API can change login groups · global rate limit (429 for everyone under a flood) · handover give-back only when the app is opened · pause edge cases · smoke tests without login · planned services lack ADRs |
| ✅ Low | **19** | Tidiness and size issues; no user impact |

28 open, 4 resolved. Details: [`docs/technical-debt.md`](docs/technical-debt.md).

## 🔐 Security

🟢 **No critical findings.**

⚠ Worth your attention:

1. **Open Google sign-up:** a member you add in the app can be claimed by a stranger until the real person signs in. Add members right before they sign in (TD-020).
2. **Manual checks still open:** the AWS account-wide S3 public-access block and the throttling burst test ([`docs/security.md`](docs/security.md#manual-verifications)).

## 🏛 Architecture Health

| | |
|---|---|
| **ADRs** | 3 accepted, **0 open** ([`docs/decisions/`](docs/decisions/)) |
| **Pending decisions (yours)** | 1. Secrets storage for reminders (blocks the next block) · 2. Whether to keep open Google sign-up now that members are added in the app · 3. Delete the duplicate TICKET-003 file (TD-001) |
| **Open risks** | Production is the only environment (TICKET-021) · no alarm on API errors (OBSERVABILITY-002) · backup restore never tested (OPERATIONS-003) |

## 🎯 Recommended Next Actions

1. **10 minutes:** run the two manual security checks and confirm the AWS cost-alert e-mail.
2. **Decide secrets storage** (SSM Parameter Store recommended: free and simple), then build the **Reminders** block.
3. **Decide on sign-up exposure** (TD-020): keep it as is, or close sign-up once the household is complete.
4. **Make it safe to run:** alarms (OBSERVABILITY-002) and a tested backup restore (OPERATIONS-003).
5. **Phone app:** an installable PWA (MOBILE-001).

---

## ℹ About this dashboard

- **Sources:** the ticket files in `docs/backlog/` and `docs/hotfix/` (a ticket counts as done when it has an "Implementation Status" section), [`docs/roadmap.md`](docs/roadmap.md), [`docs/technical-debt.md`](docs/technical-debt.md), [`docs/security.md`](docs/security.md), [`docs/architecture.md`](docs/architecture.md) and GitHub Actions.
- **Counting:** 154 ticket files minus one duplicate (TD-001) gives 153 tickets. The debt levels (High, Medium, Low) are an assessment made for this dashboard; the debt file itself has no severity field.
- **Updates:** the dashboard is refreshed by hand after each completed block of tickets, so it can lag behind the repository (TD-032).
