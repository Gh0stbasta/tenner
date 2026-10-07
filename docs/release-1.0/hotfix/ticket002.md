# HOTFIX-002: Make Dependabot Pull Requests Pass Validation

## Type

CI/CD

---

## Priority

High

---

## Goal

Dependabot pull requests (SECURITY-007) get a meaningful, green PR validation, and Dependabot no longer proposes
updates that cannot work with the current toolchain.

---

# Background

After PR #7 (SECURITY-007) Dependabot opened four PRs (#8 – #11). All failed on 2026-10-05:

```text
Terraform Validate & Plan   "Credentials could not be loaded" - workflows triggered by Dependabot get no
                            repository secrets, so AWS_ROLE_ARN is empty and the OIDC login fails
Build backend/frontend      typescript 7.0.2: npm ERESOLVE, typescript-eslint 8.71 requires typescript < 6.1
@types/node 26              type definitions for Node 26; the Lambda and CI run Node 22
```

---

# Requirements

- PR validation skips all AWS-dependent steps (OIDC, `terraform init` with backend, plan, tag check on the plan)
  for pull requests opened by Dependabot and reports that with a notice. Offline checks (fmt, validate, mocked
  `terraform test`, script tests) and the frontend/backend builds still run.
- Dependabot ignores major updates of `typescript` (until `typescript-eslint` supports it) and of `@types/node`
  (must match the Node.js runtime, 22).
- Do not give Dependabot the deploy role (TD-008: PR plans already run with deploy permissions).

---

# Acceptance Criteria

- [ ] Dependabot PRs no longer fail on AWS credentials (verified by the next Dependabot PR run)
- [x] Dependabot does not propose typescript or @types/node major updates
- [x] Human PRs still run the full Terraform plan
- [x] `actionlint` passes; README documents the behaviour

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed (actionlint, YAML parse)
- [x] Documentation updated
- [x] Technical debt documented
- [ ] Acceptance criteria verified (live Dependabot run)
- [x] Git commit created

---

# Assumptions

- Infrastructure changes from dependency bumps are covered by the plan in the deploy workflow after the merge.
  Terraform provider updates from Dependabot get no plan before the merge; review them with extra care.

---

# Out of Scope

- The failed deploy of PR #7 (existing cost anomaly monitor): fixed by setting the GitHub variable
  `COST_ANOMALY_MONITOR_ARN` (README → "Cost Monitoring"), no code change.
- Upgrading to TypeScript 7 (needs a typescript-eslint release that supports it).

---

# Implementation Status

Implemented 2026-10-05.

- `.github/workflows/pr.yml`: all AWS-dependent steps run only if the pull request author is not
  `dependabot[bot]`; a notice step explains the skip. Offline Terraform checks and the builds still run.
- `.github/dependabot.yml`: ignore `typescript` and `@types/node` major updates for frontend and backend.
- Validation: `actionlint`, YAML parse. The live check is the next Dependabot PR run.
- Docs: README "Dependency Scanning", backlog index. No new technical debt; the trade-off (no plan before merging
  Dependabot PRs) is documented in the README and relates to TD-008.

Follow-up for the owner: close PRs #8 – #11 (typescript 7 and @types/node 26 cannot be merged); Dependabot will
not reopen them because of the new ignore rules.
