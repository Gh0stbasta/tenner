# 🧭 Tenner — Executive Dashboard

> Snapshot of **2026-10-05**. Updated with every pull request (see *About this dashboard* at the end).

## 📌 Executive Summary

| | |
|---|---|
| **Project health** | 🟢 **Healthy**: every deploy to `main` is green and all automated tests pass |
| **Current phase** | Phase 2 (V2, "daily usefulness"). Phase 1 (MVP) is live |
| **Current focus** | Nothing in progress. Phone app is live; the *Alexa & Echo Show* platform is planned (9 tickets, `docs/backlog/alexa/`) |
| **Biggest blocker** | None. Secrets storage is decided (SSM Parameter Store); building it needs SSM permissions on the deploy role, which you add in AWS |
| **Recommended next action** | Test the app on your phones, then start the *Reminders* block (SECURITY-006 → NOTIFICATION-001 → 002 → 003) |

## 📈 Progress

```text
Overall   █████████░░░░░░░░░░░  44%   71 / 163 tickets
Phase 1   ████████████████████ 100%   46 / 46   MVP + hotfixes (live since 2026-10-02)
Phase 2   ██████░░░░░░░░░░░░░░  28%   25 / 88   V2 (3 of 13 themes done, Mobile 3 of 5, Alexa planned)
Phase 3   ░░░░░░░░░░░░░░░░░░░░   0%    0 / 29   Long-Term
```

✅ Completed: **71** · 🚧 In progress: **0** · 📋 Open: **92** · Total: **163**

## 🧩 Feature Status

| ✅ Live | 🔲 Missing (in roadmap order) |
|---|---|
| ✅ Google login, one household, private data | 🔲 **Reminders** (daily digest, Telegram, overdue alerts) |
| ✅ Create, edit, complete, undo, archive, restore Tenners | 🔲 **Push notifications** on the phone (with the reminders) |
| ✅ Dashboard, Quick Add, history, settings (German web app) | 🔲 **"I have 10 minutes"** suggestions |
| ✅ Calendar scheduling: weekdays, months, snooze, skip, pause, vacation | 🔲 **Alarms, backups tested, runbooks** |
| ✅ Household setup: members, categories, shared and rotating Tenners, handover | 🔲 Data export, integrations (Strava, calendar), AI (opt-in) |
| ✅ **Analytics page:** trends, life areas, household balance, neglected Tenners, habits, time | 🔲 Offline reading and completing |
| ✅ **Phone app:** installable, starts from cache, bottom navigation, swipe to complete | 🔲 **Alexa & Echo Show:** voice, Echo Show dashboard, home-screen widget (planned) |
| ✅ CI/CD, Terraform, cost alerts, smoke tests, security baseline | |

## 💰 Cost Overview

**AI spend:** ⚪ **Not tracked.** No token or cost data is recorded in the repository, so the token count and cost are unknown.

**Infrastructure** (AWS, `eu-central-1`; order of magnitude):

| Users | Monthly cost | Note |
|---|---|---|
| 2 (today, one household) | **< $0.10** | almost everything inside the free tiers |
| 100 (~50 households) | **~ $1–2** | needs multi-household support first |
| 10,000 (~5,000 households) | **~ $150–200** | needs multi-household support and higher API limits |

Opening the analytics page runs 7 small history queries; at household volume this stays within cents. The planned Alexa skill (Lambda in eu-west-1, free Alexa APIs) adds no fixed cost.

🛡 Budget: **$5 / month** with e-mail alerts. Under abuse, throttling caps the worst case at about **$2–3 per day**.

## 🧱 Technical Debt

| Level | Count | What matters |
|---|---|---|
| 🚨 High | **1** | Anyone with a Google account can claim a newly added member until that person signs in (TD-020) |
| ⚠ Medium | **8** | Deploy role used for PR plans · Google secret in Terraform state · API can change login groups · global rate limit (429 for everyone under a flood) · handover give-back only when the app is opened · pause edge cases · smoke tests without login · planned services lack ADRs |
| ✅ Low | **20** | Tidiness, bundle size, analytics simplifications (e.g. no input for actual minutes yet); no user impact |

29 open, 4 resolved. Details: [`docs/technical-debt.md`](docs/technical-debt.md).

## 🔐 Security

🟢 **No critical findings.**

⚠ Worth your attention:

1. **Open Google sign-up:** a member you add in the app can be claimed by a stranger until the real person signs in. Add members right before they sign in (TD-020).
2. **Manual checks still open:** the AWS account-wide S3 public-access block and the throttling burst test ([`docs/security.md`](docs/security.md#manual-verifications)).

## 🏛 Architecture Health

| | |
|---|---|
| **ADRs** | 3 accepted, **0 open** ([`docs/decisions/`](docs/decisions/)); smaller decisions (e.g. charts without a chart library) are recorded in `docs/architecture.md` |
| **Pending decisions (yours)** | 1. Whether to keep open Google sign-up now that members are added in the app · 2. Delete the duplicate TICKET-003 file (TD-001) · 3. Accept the Alexa ADR when ALEXA-001 starts (skill Lambda in eu-west-1, development-stage skill). Decided: secrets in SSM Parameter Store (2026-10-05, ADR follows with SECURITY-006) |
| **Open risks** | Production is the only environment (TICKET-021) · no alarm on API errors (OBSERVABILITY-002) · backup restore never tested (OPERATIONS-003) |

## 🎯 Recommended Next Actions

1. **Test the app on your phones** after the deploy: install it, swipe to complete, start it offline (Android and iPhone).
2. **Build the Reminders block:** SECURITY-006 (Parameter Store) → NOTIFICATION-001 → 002 → 003; then push (MOBILE-006).
3. **Alexa:** create an Amazon developer account and the "Tenner" skill, then build ALEXA-001 → 002 → 003 → 004 → 006 → 005; the Echo Show widget (ALEXA-007) follows the Reminders block.
4. **10 minutes:** run the two manual security checks and confirm the AWS cost-alert e-mail.
5. **Decide on sign-up exposure** (TD-020): keep it as is, or close sign-up once the household is complete.

---

## ℹ About this dashboard

- **Sources:** the ticket files in `docs/backlog/` and `docs/hotfix/` (a ticket counts as done when it has an "Implementation Status" section), [`docs/roadmap.md`](docs/roadmap.md), [`docs/technical-debt.md`](docs/technical-debt.md), [`docs/security.md`](docs/security.md), [`docs/architecture.md`](docs/architecture.md) and GitHub Actions.
- **Counting:** 164 ticket files minus one duplicate (TD-001) gives 163 tickets; planning tickets with other file names (e.g. `alexaSkill/alexaFoundation.md`) are not counted. The debt levels (High, Medium, Low) are an assessment made for this dashboard; the debt file itself has no severity field.
- **Updates:** every pull request refreshes the dashboard (rule in `CLAUDE.md`). Between pull requests it can lag behind the branch (TD-032).
