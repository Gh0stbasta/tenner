# REPORTING-002 - Update the Executive Dashboard with Every Pull Request

## Goal

Every pull request keeps `dashboard.md` (REPORTING-001) current, so the owner can steer from the dashboard alone.

## Context

The dashboard is maintained by hand (TD-032) and drifts when work is merged without refreshing it. The owner asked
(2026-10-05) for a dashboard update in every pull request, recorded as a standing rule in the root `CLAUDE.md`.

## Requirements

- Add a rule to the root `CLAUDE.md`: every pull request includes an update of `dashboard.md` in the repository root.
- Define what the update covers and how it is committed.
- Align `dashboard.md` and TD-032 with the new rule.

## Acceptance Criteria

- [x] `CLAUDE.md` contains an "Executive Dashboard" section requiring a `dashboard.md` update in every pull request
- [x] The rule states the content to refresh, the sources, the commit convention and the exceptions
- [x] The Definition of Done and the Git workflow in `CLAUDE.md` refer to the rule
- [x] `dashboard.md` and TD-032 describe the new update cadence

## Definition of Done

- [x] Implementation completed
- [x] Tests completed (documentation only; links and wording checked)
- [x] Documentation updated
- [x] Technical debt documented (TD-032 updated)
- [x] Acceptance criteria verified
- [x] Git commit created

## Assumptions

- The rule applies to pull requests created by the agent. Dependabot pull requests are automated and exempt.
- The dashboard refresh is its own commit (`docs(dashboard): ...`) on the pull request branch, as an explicit
  exception to "one commit per ticket" and without its own ticket.
- When nothing on the dashboard changes, the snapshot date is still updated.

## Out of Scope

- Automating the dashboard (script or CI job), see TD-032.

## Implementation Status

Implemented 2026-10-05: rule added to `CLAUDE.md` ("Executive Dashboard" section, Git workflow, Definition of
Done); `dashboard.md` and TD-032 updated. Documentation only, no tests to run.
