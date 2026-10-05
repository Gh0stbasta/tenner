# REPORTING-001 - Create Executive Dashboard

## Business Goal

As the human owner of an agent-driven project

I want a single executive dashboard

So that I can understand project progress, costs, risks and priorities within seconds without reading tickets, architecture documents or implementation details.

---

## Context

The project already contains:

- Human strategy documents
- Agent definitions
- Architecture documentation
- Tickets
- Technical decisions
- Backlog

There is currently no centralized high-level overview.

The dashboard should become the primary interface for humans.

The dashboard is not a developer tool.

The dashboard is the cockpit for steering an AI-driven project.

---

## Deliverable

Create:

dashboard.md

in the repository root.

The dashboard must remain readable inside GitHub directly.

No HTML.

No React.

No external tooling.

Use markdown, emojis, progress bars and ASCII visualizations.

---

## Dashboard Sections

### Executive Summary

Show:

- Current project phase
- Overall project health
- Current focus area
- Current biggest blocker
- Recommended next action

Example:

🟢 Project Health: Healthy

Current Phase:
MVP Development

Current Focus:
Authentication

Biggest Blocker:
Missing payment provider decision

Recommended Next Action:
Implement user onboarding

---

### Progress Overview

Display:

- Total tickets
- Completed tickets
- In progress tickets
- Open tickets

Example:

Progress

██████████░░░░░░░░░░ 52%

Tickets:
✅ Completed: 26
🚧 In Progress: 4
📋 Open: 20

Total: 50

---

### Feature Status

List completed and missing capabilities.

Example:

Completed Features

✅ Authentication
✅ User Management
✅ CI/CD
✅ Terraform

Remaining Features

🔲 Billing
🔲 Reporting API
🔲 Notifications
🔲 Admin Dashboard

---

### Cost Overview

Show:

#### AI Cost

Estimated accumulated token spend

Example:

AI Spend

Estimated Tokens:
15,200,000

Estimated Cost:
$42.50

---

#### Infrastructure Cost Forecast

Display:

Monthly cost estimate

| Users | Monthly Cost |
|---------|---------|
| 1 | $3 |
| 100 | $15 |
| 10,000 | $220 |

Focus on order of magnitude.

Perfect accuracy is not required.

---

### Technical Debt

Show:

✅ Low
⚠ Medium
🚨 High

Example:

Technical Debt

🚨 High: 1

- Hardcoded configuration values

⚠ Medium: 3

- Missing test coverage
- Legacy deployment script
- Incomplete observability

✅ Low: 6

---

### Security Overview

Only display meaningful issues.

Do not show informational findings.

Example:

Security Status

🟢 No critical findings

OR

🚨 Critical Findings

1. Public S3 bucket exposure
2. Missing encryption on customer data

---

### Architecture Health

Show:

- Open ADRs
- Pending human decisions
- Open architectural risks

Example:

Architecture

Open ADRs: 2

Pending Decisions:
- Database strategy
- Multi-region support

Open Risks:
- Vendor lock-in assessment missing

---

### Recommended Next Actions

Automatically generated top 5 actions.

Example:

Next Recommended Actions

1. Complete Authentication
2. Reduce high-priority technical debt
3. Resolve payment provider decision
4. Increase test coverage
5. Prepare MVP release

---

## Visual Design Rules

- GitHub markdown only
- Highly scannable
- Maximum one screen scroll
- No implementation details
- No code
- Focus on executive-level decisions
- Every section should answer:

"What should I care about right now?"

---

## Acceptance Criteria

- dashboard.md exists in repository root
- dashboard can be read directly in GitHub
- progress section exists
- feature section exists
- cost section exists
- security section exists
- technical debt section exists
- architecture section exists
- next actions section exists
- information density is high but not overwhelming

---

## Future Enhancements

Not part of this ticket:

- dashboard.html
- Charts
- Multi-project portfolio reporting
- Marketing reporting
- Finance reporting
- Investor reporting
- Real-time metrics
