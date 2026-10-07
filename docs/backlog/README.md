# Tenner Backlog — Maintenance

Tenner is feature-complete with **release 1.0** (2026-10-07). From now on this backlog holds only maintenance work
and recommendations from the people who use Tenner. There is no feature roadmap.

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

None yet.

### Recommendations

None yet.
