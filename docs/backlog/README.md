# Tenner Backlog — Maintenance

Tenner 1.0 (2026-10-07) is in maintenance: this backlog holds maintenance work and recommendations from the people
who use Tenner. New features are planned as releases with their own folder: **release 2.0 (meal planning)** is in
[`../release-2.0/`](../release-2.0/README.md).

- Release 1.0 overview: [`../release-1.0/README.md`](../release-1.0/README.md)
- Everything built for release 1.0 (tickets, hotfixes, owner inputs): [`../release-1.0/`](../release-1.0/)
- Known limitations and their possible fixes: [`../technical-debt.md`](../technical-debt.md)

---

## Structure

```text
docs/backlog/
├── maintenance/        MAINT-NNN  bugs, failing deploys, dependency and security updates, technical debt
└── recommendations/    REC-NNN    ideas and wishes from users, collected and decided on
```

The folders are created with their first ticket.

## Ticket Types

| Type | Prefix | When | Before work starts |
|---|---|---|---|
| Maintenance | `MAINT-NNN` | Something is broken, insecure, outdated or a technical-debt item should be fixed | Nothing: maintenance is done when it is needed; urgent fixes first |
| Recommendation | `REC-NNN` | A user wishes for a change or a new feature | The owner decides: **accepted** (it becomes work), **declined** or **parked** |

File names: `maintenance/ticketNNN.md` and `recommendations/ticketNNN.md`, numbered per folder. Each ticket uses the
ticket template from `CLAUDE.md` and gets an "Implementation Status" section when it is done.

## How a Recommendation Is Handled

```text
User wish  →  REC ticket (status: proposed)  →  owner decision  →  accepted → implemented, released as 1.x
                                                               →  declined / parked → stays as record
```

A recommendation records who asked (role, not name), the problem behind the wish and the owner's decision with its
date.

## Releases After 1.0

Maintenance and accepted recommendations ship as patch and minor releases (`1.0.x`, `1.x.0`, see
[`../../CHANGELOG.md`](../../CHANGELOG.md)). Every merge to `main` deploys to production; a release is a Git tag
and a changelog entry on top of that.

## Index

### Maintenance

| Ticket | Title | Status |
|---|---|---|
| [MAINT-001](maintenance/ticket001.md) | Alexa skill — time budget instead of a fixed 2 s per API call | Done |
| [MAINT-002](maintenance/ticket002.md) | Deliver the Echo Show home-screen widget | Done (device check by the owner open) |
| [MAINT-003](maintenance/ticket003.md) | Widget icon and preview for the skill package import | Done |
| [MAINT-004](maintenance/ticket004.md) | Widget system messages counted as skill errors | Done (alarm quiet since the deploy) |
| [MAINT-005](maintenance/ticket005.md) | Widget tap rejected by Alexa (interaction mode) | Done (device check open) |
| [MAINT-006](maintenance/ticket006.md) | Alexa skill without Echo Show views (widget only) | Done (device check open) |
| [MAINT-007](maintenance/ticket007.md) | Meal plan always Monday to Sunday | Done |

### Owner hotfix tickets (`../hotfix/`)

| Ticket | Title | Status |
|---|---|---|
| [HOTFIX-006](../hotfix/setDateOnTask.md) | Startdatum für Aufgaben | Done |
| [UI-001](../hotfix/redesignDashboard.md) | Dashboard-Redesign: Fokus auf den heutigen Tag | Done |

### Recommendations

| Ticket | Title | Decision | Status |
|---|---|---|---|
| [REC-001](recommendations/ticket001.md) | Missed Tenners disappear and count as not done | Accepted (2026-10-08) | Done |
| [REC-002](recommendations/ticket002.md) | Rename the app to „Zentrale“ and Tenners to „Aufgaben“ | Accepted (2026-10-08) | Done (device check open) |
