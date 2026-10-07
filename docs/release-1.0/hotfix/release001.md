# RELEASE-001 - Release Tenner 1.0

## Goal

Close the project with a clean release 1.0: archive everything that was built, set the version, document the
release for people, and prepare the repository for maintenance and user recommendations.

## Context

On 2026-10-07 the owner declared the project 10-minute Tenner complete: "pack alles was bisher passiert ist im
backlog in einen neuen ordner "release 1.0" und tu alles was nötig ist, um hier nen sauberen release abzuschließen.
dokumentier den release 1.0 irgendwo sauber als übersicht für menschen mit schönen grafiken, marketing slogan und
weiteren in der branche üblichen daten, die man bei einem release veröffentlicht."

BACKLOG-003 removed the open tickets first, so the archive holds only implemented work.

## Requirements

- Move the backlog (`docs/backlog/`), the hotfix and housekeeping tickets (`docs/hotfix/`), the owner inputs
  (`docs/human/`) and META-001 (`docs/meta-ticket.md`) into `docs/release-1.0/`.
- Start a new, empty maintenance backlog in `docs/backlog/` for maintenance (`MAINT`) and user recommendations
  (`REC`), with the intake process.
- Set version 1.0.0 in the backend, frontend and Alexa packages; add `CHANGELOG.md` (Keep a Changelog, SemVer).
- Write release notes for people (`docs/release-1.0/README.md`): slogan, release facts, highlights, features,
  architecture, figures with diagrams, timeline, system requirements, security, known limitations, upgrade and
  rollback, maintenance policy, credits.
- Update links and references (`README.md`, `CLAUDE.md`, `alexa/README.md`, roadmap, technical debt) to the new paths.
- Document the release process (tag, GitHub release) for later releases.

## Acceptance Criteria

- [x] `docs/release-1.0/` contains `backlog/`, `hotfix/`, `human/`, `meta-ticket.md` and the release notes; `git mv`
  keeps the history of every file
- [x] `docs/backlog/README.md` describes maintenance mode, the `MAINT` and `REC` ticket types and how a
  recommendation is decided
- [x] `backend`, `frontend` and `alexa` are version 1.0.0 (package and lock files)
- [x] `CHANGELOG.md` has the 1.0.0 entry with Added, Fixed, Removed and Known Limitations
- [x] The release notes contain a slogan, release facts, six Mermaid diagrams (day journey, architecture, tickets by
  area, tests by component, commits per day, timeline) and the industry-usual sections; all diagrams parse with
  Mermaid 11
- [x] Every figure in the release notes is computed from the repository (tickets, tests, commits, lines, routes)
- [x] No broken relative Markdown link in the repository (link check over all tracked `.md` files)
- [x] `README.md` links the release and changelog and describes the release process; `CLAUDE.md` names the new
  ticket locations and dashboard sources
- [x] TD-002 (inconsistent backlog layout) resolved by the archive and the new convention

## Definition of Done

- [x] Implementation completed
- [x] Tests completed (backend 924, frontend 407, Alexa 147, Terraform 76, scripts 45 — all passing; Mermaid parse
  check; Markdown link check)
- [x] Documentation updated
- [x] Technical debt documented (TD-002 resolved; no new debt)
- [x] Acceptance criteria verified
- [x] Git commit created

## Owner Steps after the Merge

Tagging needs the merged commit on `main`, so it is done after the merge (by the owner, or on request):

```bash
git fetch origin main
git tag -a v1.0.0 -m "Tenner 1.0.0 — Grundstein" origin/main
git push origin v1.0.0
```

Then GitHub → Releases → "Draft a new release" → tag `v1.0.0`, title "Tenner 1.0 — Grundstein", text: the 1.0.0
entry from `CHANGELOG.md` and a link to `docs/release-1.0/README.md`.

## Assumptions

- The folder is named `docs/release-1.0/` (no space, under `docs/` next to the other documentation) for the owner's
  "release 1.0".
- `docs/roadmap.md`, `docs/architecture.md`, `docs/technical-debt.md`, `docs/security.md`, ADRs and runbooks are
  living documents and stay in `docs/`; only ticket-type files move.
- The release notes are in German, like the app and the owner's requests; the changelog is in English like the
  other repository documentation.
- The codename "Grundstein" and the slogan are proposals and can be changed by the owner.
- The version is not shown in the app; adding it would be a code change outside this release's scope.

## Out of Scope

- Creating the Git tag and the GitHub release (needs the merge; see Owner Steps).
- Any change to application behavior.

## Implementation Status

Done (2026-10-07). Tag and GitHub release follow after the merge.
