# Tenner Backlog — Release 1.0 Archive

The backlog as it stood at release 1.0 (2026-10-07): only implemented tickets; open feature tickets were removed
(BACKLOG-003). Until the release this folder was `docs/backlog/`; new work goes to the maintenance backlog in
[`../../backlog/`](../../backlog/README.md). Release overview: [`../README.md`](../README.md).

Every ticket is self-contained: it states its goal, background, dependencies, scope,
deliverables, validation commands, acceptance criteria, definition of done and
out-of-scope items, so that work can be picked up from the backlog alone.

The phased roadmap and the gap analysis that produced most domains are in
[`../../roadmap.md`](../../roadmap.md).

---

## Structure

```text
docs/backlog/
├── ticket001.md        TICKET-001  CI/CD foundation (historical location)
├── infra/              TICKET-0xx  infrastructure and backend API tickets
├── frontend/           FRONTEND-0xx
├── analytics/          ANALYTICS-0xx
├── notifications/      NOTIFICATION-0xx
├── scheduling/         SCHEDULING-0xx
├── household/          HOUSEHOLD-0xx
├── household-admin/    HOUSEHOLD-ADMIN-0xx
├── ux/                 UX-0xx
├── security/           SECURITY-0xx
├── observability/      OBSERVABILITY-0xx
├── operations/         OPERATIONS-0xx
├── data-management/    DATA-0xx
├── mobile/             MOBILE-0xx
├── alexa/              ALEXA-0xx  (Alexa skill and Echo Show)
├── alexaSkill/         Alexa backlog generation ticket (alexaFoundation.md)
└── future/             FUTURE-0xx
```

---

## Conventions

- **File name:** `ticketNNN.md`, numbered sequentially per folder.
- **Ticket ID:** `<PREFIX>-NNN` in the first heading, matching the file number.
- **Backend tickets** stay in `infra/` with the `TICKET-` prefix so they keep the
  existing numbering (TICKET-008 to TICKET-016 are backend tickets).
- **Sections:** Type, Priority, Phase, Goal, Background, Dependencies, Scope,
  Deliverables, Validation, Acceptance Criteria, Definition of Done, Out of Scope.
  Evaluation-only tickets (mostly in `future/`) skip Validation.
- **Phase:** `MVP`, `V2` or `Long-Term`. Tickets from before the phase field was
  added are MVP tickets.
- **Existing tickets are not changed** by backlog extensions. Tickets that came
  later refer to them by ID.

### Why these domains exist

| Folder | Reason |
|---|---|
| `scheduling/` | Recurrence rules go beyond the core completion workflow and change one central calculation |
| `household/` vs `household-admin/` | Shared-work features for everyday use vs. configuration done once by an admin |
| `observability/` vs `operations/` | Signals (metrics, logs, alarms) vs. procedures (cost, backups, releases, runbooks) |
| `data-management/` | Export, import, retention, migrations and history correction affect all domains |
| `future/` | Ideas we are deliberately postponing; most are evaluations that end in a go/no-go decision |

---

## Index
### Infrastructure & Backend (`infra/`, prefix `TICKET-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [TICKET-001](ticket001.md) | Establish CI/CD Pipeline and AWS Deployment Foundation | High | MVP (existing) |
| [TICKET-001A](infra/ticket001.md) | Establish Tagging and Resource Governance Standards | Critical | MVP (existing) |
| [TICKET-002](infra/ticket002.md) | Bootstrap Terraform Foundation | Critical | MVP (existing) |
| [TICKET-003](infra/ticket003.md) | Create Remote Terraform State Backend | Critical | MVP (existing) |
| [TICKET-005](infra/ticket005.md) | Create API Foundation Infrastructure | High | MVP (existing) |
| [TICKET-006](infra/ticket006.md) | Create DynamoDB Persistence Layer | High | MVP (existing) |
| [TICKET-007](infra/ticket007.md) | Integrate Lambda with DynamoDB | High | MVP (existing) |
| [TICKET-008](infra/ticket008.md) | Establish Backend Domain Foundation | High | MVP (existing) |
| [TICKET-009](infra/ticket009.md) | Implement Create Tenner API | High | MVP (existing) |
| [TICKET-010](infra/ticket010.md) | Implement List Tenners API | High | MVP (existing) |
| [TICKET-011](infra/ticket011.md) | Implement Update Tenner API | High | MVP (existing) |
| [TICKET-012](infra/ticket012.md) | Implement Delete Tenner API | Medium | MVP (existing) |
| [TICKET-013](infra/ticket013.md) | Implement Complete Tenner Workflow | Critical | MVP (existing) |
| [TICKET-014](infra/ticket014.md) | Implement Undo Completion Workflow | High | MVP (existing) |
| [TICKET-015](infra/ticket015.md) | Implement Restore Tenner API | Medium | MVP (existing) |
| [TICKET-016](infra/ticket016.md) | Implement Due & Dashboard API | Critical | MVP (existing) |
| [TICKET-017](infra/ticket017.md) | Provision Frontend Hosting Infrastructure | Critical | MVP |
| [TICKET-018](infra/ticket018.md) | Automate Frontend Deployment | Critical | MVP |
| [TICKET-019](infra/ticket019.md) | Implement Get Tenner API | High | MVP |
| [TICKET-020](infra/ticket020.md) | Implement Completion History API | High | MVP |
| [TICKET-023](infra/ticket023.md) | Fix Invalid Characters in AWS Tags and Descriptions | Critical | MVP |
| [TICKET-024](infra/ticket024.md) | List Archived (Soft-Deleted) Tenners | High | MVP |

### Frontend (`frontend/`, prefix `FRONTEND-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [FRONTEND-001](frontend/ticket001.md) | Establish Frontend Foundation | Critical | MVP (existing) |
| [FRONTEND-002](frontend/ticket002.md) | Implement Dashboard Page | Critical | MVP (existing) |
| [FRONTEND-003](frontend/ticket003.md) | Implement Tenner Management Page | Critical | MVP (existing) |
| [FRONTEND-004](frontend/ticket004.md) | Implement Create Tenner Dialog | Critical | MVP (existing) |
| [FRONTEND-005](frontend/ticket005.md) | Implement Edit Tenner Dialog | High | MVP (existing) |
| [FRONTEND-006](frontend/ticket006.md) | Implement Quick Add Tenner Experience | High | MVP (existing) |
| [FRONTEND-007](frontend/ticket007.md) | Implement Complete & Undo Completion Experience | Critical | MVP (existing) |
| [FRONTEND-008](frontend/ticket008.md) | Implement Settings & User Preferences | High | MVP (existing) |
| [FRONTEND-009](frontend/ticket009.md) | Implement Tenner Detail & History View | High | MVP |

### Analytics (`analytics/`, prefix `ANALYTICS-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [ANALYTICS-001](analytics/ticket001.md) | Establish Analytics API Foundation | High | V2 |
| [ANALYTICS-002](analytics/ticket002.md) | Implement Completion Trends | Medium | V2 |
| [ANALYTICS-003](analytics/ticket003.md) | Implement User Metrics | Medium | V2 |
| [ANALYTICS-004](analytics/ticket004.md) | Implement Category Metrics | Medium | V2 |
| [ANALYTICS-005](analytics/ticket005.md) | Implement Time Investment Metrics | Low | V2 |
| [ANALYTICS-006](analytics/ticket006.md) | Implement Neglected Tenners Analysis | High | V2 |
| [ANALYTICS-007](analytics/ticket007.md) | Implement Household Balance Metrics | Medium | V2 |
| [ANALYTICS-008](analytics/ticket008.md) | Implement Habit & Consistency Analytics | Medium | V2 |
| [ANALYTICS-009](analytics/ticket009.md) | Implement Analytics Page | High | V2 |

### Notifications (`notifications/`, prefix `NOTIFICATION-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [NOTIFICATION-001](notifications/ticket001.md) | Establish Notification Foundation | High | V2 |
| [NOTIFICATION-002](notifications/ticket002.md) | Implement Reminder Preferences | High | V2 |
| [NOTIFICATION-003](notifications/ticket003.md) | Implement Daily Digest | High | V2 |
| [NOTIFICATION-004](notifications/ticket004.md) | Implement Overdue Alerts | Medium | V2 |
| [NOTIFICATION-009](notifications/ticket009.md) | Implement Browser Push Channel | High | V2 |
| [NOTIFICATION-010](notifications/ticket010.md) | Implement Per-Tenner Push Reminders | High | V2 |
| [NOTIFICATION-011](notifications/ticket011.md) | Implement Push Notification Actions | High | V2 |

### Scheduling (`scheduling/`, prefix `SCHEDULING-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [SCHEDULING-001](scheduling/ticket001.md) | Support Calendar-Based Frequencies | High | V2 |
| [SCHEDULING-002](scheduling/ticket002.md) | Support Weekday-Based Scheduling | Medium | V2 |
| [SCHEDULING-003](scheduling/ticket003.md) | Implement Snooze / Postpone Tenner | High | V2 |
| [SCHEDULING-004](scheduling/ticket004.md) | Implement Skip Occurrence | Low | V2 |
| [SCHEDULING-005](scheduling/ticket005.md) | Implement Pause & Vacation Mode | Medium | V2 |
| [SCHEDULING-008](scheduling/ticket008.md) | Implement Timezone-Aware Due Dates | High | V2 |

### Household Features (`household/`, prefix `HOUSEHOLD-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [HOUSEHOLD-001](household/ticket001.md) | Implement Rotating Assignment | Medium | V2 |
| [HOUSEHOLD-002](household/ticket002.md) | Support Shared (Unassigned) Tenners | Medium | V2 |
| [HOUSEHOLD-004](household/ticket004.md) | Implement Temporary Handover | Low | V2 |

### Household Administration (`household-admin/`, prefix `HOUSEHOLD-ADMIN-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [HOUSEHOLD-ADMIN-001](household-admin/ticket001.md) | Implement Household Member Management | High | V2 |
| [HOUSEHOLD-ADMIN-002](household-admin/ticket002.md) | Implement Category Management | Medium | V2 |
| [HOUSEHOLD-ADMIN-003](household-admin/ticket003.md) | Implement Household Settings | Medium | V2 |
| [HOUSEHOLD-ADMIN-004](household-admin/ticket004.md) | Implement Member Deactivation | Low | V2 |
| [HOUSEHOLD-ADMIN-006](household-admin/ticket006.md) | Members Without Login | High | V2 |

### User Experience (`ux/`, prefix `UX-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [UX-005](ux/ticket005.md) | Implement Global Error Handling and Network Feedback | High | MVP |

### Security (`security/`, prefix `SECURITY-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [SECURITY-001](security/ticket001.md) | Decide Authentication Approach (ADR) | Critical | MVP |
| [SECURITY-002](security/ticket002.md) | Implement Cognito User Pool and API Authorizer | Critical | MVP |
| [SECURITY-003](security/ticket003.md) | Integrate Login in the Frontend | Critical | MVP |
| [SECURITY-004](security/ticket004.md) | Enforce Identity-Based Authorization in the Backend | High | MVP |
| [SECURITY-005](security/ticket005.md) | Harden AWS Resources | High | MVP |
| [SECURITY-006](security/ticket006.md) | Implement Secrets Management | High | V2 |
| [SECURITY-007](security/ticket007.md) | Implement Dependency Scanning | High | MVP |
| [SECURITY-014](security/ticket014.md) | Cap API Cost with Stage Throttling | Critical | MVP |

### Observability (`observability/`, prefix `OBSERVABILITY-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [OBSERVABILITY-001](observability/ticket001.md) | Create CloudWatch Operational Dashboard | Medium | V2 |
| [OBSERVABILITY-002](observability/ticket002.md) | Implement Alarms and Alert Routing | High | V2 |

### Operations (`operations/`, prefix `OPERATIONS-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [OPERATIONS-001](operations/ticket001.md) | Implement Cost Monitoring and Budgets | High | MVP |
| [OPERATIONS-006](operations/ticket006.md) | Implement Post-Deployment Smoke Tests | High | MVP |

### Data Management (`data-management/`, prefix `DATA-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [DATA-008](data-management/ticket008.md) | Import the Household Task Catalog | High | V2 |

### Mobile Experience (`mobile/`, prefix `MOBILE-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [MOBILE-001](mobile/ticket001.md) | Make Tenner an Installable Progressive Web App | High | V2 |
| [MOBILE-002](mobile/ticket002.md) | Implement Service Worker and App Shell Caching | Medium | V2 |
| [MOBILE-003](mobile/ticket003.md) | Implement Offline Read Support | Low | V2 |
| [MOBILE-004](mobile/ticket004.md) | Implement Offline Completion Queue | Low | Long-Term |
| [MOBILE-005](mobile/ticket005.md) | Optimize Mobile Navigation and Touch Interaction | Medium | V2 |

### Alexa & Echo Show (`alexa/`, prefix `ALEXA-`)

Generated from the owner's Alexa backlog ticket (`alexaSkill/alexaFoundation.md`, 2026-10-05). German (de-DE)
custom skill in development stage; skill Lambda in eu-west-1 calling the Tenner API with the linked user's token.

| ID | Title | Priority | Phase |
|---|---|---|---|
| [ALEXA-001](alexa/ticket001.md) | Establish Alexa Platform Foundation | High | V2 |
| [ALEXA-002](alexa/ticket002.md) | Implement Account Linking and Household Authorization | High | V2 |
| [ALEXA-003](alexa/ticket003.md) | Implement Today's Tenners Voice Experience | High | V2 |
| [ALEXA-004](alexa/ticket004.md) | Implement Voice Completion Workflow | High | V2 |
| [ALEXA-005](alexa/ticket005.md) | Implement Daily Briefing | Medium | V2 |
| [ALEXA-006](alexa/ticket006.md) | Implement Echo Show Dashboard (APL) | High | V2 |
| [ALEXA-007](alexa/ticket007.md) | Implement Echo Show Home Screen Widget (Flagship) | High | V2 |
| [ALEXA-008](alexa/ticket008.md) | Implement Alexa Notifications and Reminders | Medium | V2 |
| [ALEXA-009](alexa/ticket009.md) | Implement Alexa Operations and Monitoring | Medium | V2 |
| [ALEXA-010](alexa/ticket010.md) | Use the Invocation Name "tenner board" and Keep the Skill Private | High | V2 |

### Future / Postponed (`future/`, prefix `FUTURE-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [FUTURE-011](future/ticket011.md) | Add Social Login (Google) | High | MVP (pulled forward) |

### Hotfix

Urgent changes and project housekeeping outside the regular backlog are in [`../hotfix/`](../hotfix/) (owner
decision 2026-10-05; until release 1.0 the folder was `docs/hotfix/`).

| ID | Title | Priority | Phase |
|---|---|---|---|
| [HOTFIX-001](../hotfix/ticket001.md) | First Login & Household Assignment Flow | High | MVP |
| [HOTFIX-002](../hotfix/ticket002.md) | Make Dependabot Pull Requests Pass Validation | High | MVP |
| [HOTFIX-003](../hotfix/ticket003.md) | CloudWatch Dashboard Metrics Format | High | V2 |
| [HOTFIX-004](../hotfix/ticket004.md) | Alexa Manifest Notifications Permission | High | V2 |
| [HOTFIX-005](../hotfix/ticket005.md) | Enable Alexa Skill Testing in the Deployment | High | V2 |
| [HOTFIX-006](../hotfix/ticket006.md) | Alexa Health Check Tolerates Simulator Outages | High | V2 |

Project housekeeping: [REPORTING-001](../hotfix/reporting001.md), [REPORTING-002](../hotfix/reporting002.md)
(executive dashboard), [BACKLOG-001](../hotfix/backlog001.md), [BACKLOG-002](../hotfix/backlog002.md),
[BACKLOG-003](../hotfix/backlog003.md) (backlog removals), [CLEANUP-001](../hotfix/cleanup001.md) (dropped channels
in the code), [RELEASE-001](../hotfix/release001.md) (release 1.0).

---

## Removed Tickets

Dropped by the owner on 2026-10-06 (BACKLOG-001, `../hotfix/backlog001.md`); the files are deleted and remain in
the Git history. Their numbers are not reused.

| ID | Title | Reason |
|---|---|---|
| MOBILE-006 | Implement Push Notification Subscription | Not wanted: no phone push notifications |
| NOTIFICATION-005 | Implement Email Notification Channel | Not wanted: reminders stay in Tenner and on Alexa |
| NOTIFICATION-006 | Implement Telegram Notification Channel | Not wanted: reminders stay in Tenner and on Alexa |
| NOTIFICATION-007 | Implement Web Push Notification Channel | Not wanted: no push notifications. Push was re-requested by the owner on 2026-10-07 (`../human/mobileReminder.md`) and is built as NOTIFICATION-009 – 011 |
| PRODUCTIVITY-001 | Implement "I Have X Minutes" Suggestions | Not wanted |
| INTEGRATION-002 | Implement Interactive Telegram Bot | Not wanted: needs the dropped Telegram channel (BACKLOG-002, `../hotfix/backlog002.md`) |

Closed by the owner on 2026-10-07 after release 1.0 (BACKLOG-003, `../hotfix/backlog003.md`): every open feature
ticket was removed, Tenner moves to maintenance and user recommendations. The duplicate TICKET-003 file
(`infra/ticket004.md`, TD-001) was deleted as well. Risks these tickets would have closed are technical debt
(TD-039, TD-040 and the entries that name them).

| ID | Title | Reason |
|---|---|---|
| TICKET-021 | Introduce Environment Separation | Not planned after release 1.0 (BACKLOG-003) |
| TICKET-022 | Configure Custom Domain and TLS | Not planned after release 1.0 (BACKLOG-003) |
| FRONTEND-010 | Implement Household Activity History Page | Not planned after release 1.0 (BACKLOG-003) |
| ANALYTICS-010 | Introduce Analytics Pre-Aggregation | Not planned after release 1.0 (BACKLOG-003) |
| NOTIFICATION-008 | Implement Weekly Summary | Not planned after release 1.0 (BACKLOG-003) |
| SCHEDULING-006 | Support Seasonal Tenners | Not planned after release 1.0 (BACKLOG-003) |
| SCHEDULING-007 | Implement Preferred Days (Rule-Based Smart Scheduling) | Not planned after release 1.0 (BACKLOG-003) |
| PRODUCTIVITY-002 | Introduce Tenner Importance | Not planned after release 1.0 (BACKLOG-003) |
| PRODUCTIVITY-003 | Implement Tenner Checklists | Not planned after release 1.0 (BACKLOG-003) |
| PRODUCTIVITY-004 | Implement Completion Notes | Not planned after release 1.0 (BACKLOG-003) |
| PRODUCTIVITY-005 | Implement Bulk Actions | Not planned after release 1.0 (BACKLOG-003) |
| HOUSEHOLD-003 | Implement Household Activity Acknowledgements | Not planned after release 1.0 (BACKLOG-003) |
| HOUSEHOLD-ADMIN-005 | Introduce Household Roles | Not planned after release 1.0 (BACKLOG-003) |
| UX-001 | Implement First-Run Onboarding | Not planned after release 1.0 (BACKLOG-003) |
| UX-002 | Implement Keyboard Shortcuts | Not planned after release 1.0 (BACKLOG-003) |
| UX-003 | Conduct Accessibility Audit (WCAG 2.1 AA) | Not planned after release 1.0 (BACKLOG-003) |
| UX-004 | Implement Internationalization (German and English) | Not planned after release 1.0 (BACKLOG-003) |
| UX-006 | Implement Week Calendar View | Not planned after release 1.0 (BACKLOG-003) |
| UX-007 | Establish Frontend Performance Budget | Not planned after release 1.0 (BACKLOG-003) |
| SECURITY-008 | Harden Software Supply Chain | Not planned after release 1.0 (BACKLOG-003) |
| SECURITY-009 | Add Infrastructure-as-Code Security Scanning | Not planned after release 1.0 (BACKLOG-003) |
| SECURITY-010 | Add Static Code Analysis and Secret Scanning | Not planned after release 1.0 (BACKLOG-003) |
| SECURITY-011 | Enable Multi-Factor Authentication | Not planned after release 1.0 (BACKLOG-003) |
| SECURITY-012 | Implement Security Event Logging and Audit Trail | Not planned after release 1.0 (BACKLOG-003) |
| SECURITY-013 | Create Threat Model and Privacy Review | Not planned after release 1.0 (BACKLOG-003) |
| OBSERVABILITY-003 | Publish Business and Performance Metrics | Not planned after release 1.0 (BACKLOG-003) |
| OBSERVABILITY-004 | Enable Distributed Tracing | Not planned after release 1.0 (BACKLOG-003) |
| OBSERVABILITY-005 | Implement Frontend Error Reporting | Not planned after release 1.0 (BACKLOG-003) |
| OBSERVABILITY-006 | Define Logging Standards and Saved Queries | Not planned after release 1.0 (BACKLOG-003) |
| OPERATIONS-002 | Write Operational Runbooks | Not planned after release 1.0 (BACKLOG-003) |
| OPERATIONS-003 | Validate Backup and Restore | Not planned after release 1.0 (BACKLOG-003) |
| OPERATIONS-004 | Implement Release Versioning and Fast Rollback | Not planned after release 1.0 (BACKLOG-003) |
| OPERATIONS-005 | Detect Terraform Drift | Not planned after release 1.0 (BACKLOG-003) |
| OPERATIONS-007 | Provide Maintenance Script Framework | Not planned after release 1.0 (BACKLOG-003) |
| DATA-001 | Implement Data Export | Not planned after release 1.0 (BACKLOG-003) |
| DATA-002 | Implement Data Import | Not planned after release 1.0 (BACKLOG-003) |
| DATA-003 | Implement Scheduled Data Archive to S3 | Not planned after release 1.0 (BACKLOG-003) |
| DATA-004 | Define Data Retention Policy | Not planned after release 1.0 (BACKLOG-003) |
| DATA-005 | Implement Member Data Erasure | Not planned after release 1.0 (BACKLOG-003) |
| DATA-006 | Establish Schema Versioning and Data Migrations | Not planned after release 1.0 (BACKLOG-003) |
| DATA-007 | Implement Completion Correction | Not planned after release 1.0 (BACKLOG-003) |
| INTEGRATION-001 | Establish Integration Foundation | Not planned after release 1.0 (BACKLOG-003) |
| INTEGRATION-003 | Implement Strava Activity Auto-Completion | Not planned after release 1.0 (BACKLOG-003) |
| INTEGRATION-004 | Evaluate and Implement Garmin Connect Integration | Not planned after release 1.0 (BACKLOG-003) |
| INTEGRATION-005 | Support Zwift Rides via Strava | Not planned after release 1.0 (BACKLOG-003) |
| INTEGRATION-006 | Provide ICS Calendar Feed | Not planned after release 1.0 (BACKLOG-003) |
| INTEGRATION-007 | Implement Google Calendar Two-Way Integration | Not planned after release 1.0 (BACKLOG-003) |
| INTEGRATION-008 | Implement Outlook Calendar Integration | Not planned after release 1.0 (BACKLOG-003) |
| INTEGRATION-009 | Provide Personal Access Tokens for Automations | Not planned after release 1.0 (BACKLOG-003) |
| AI-001 | Establish AI Foundation | Not planned after release 1.0 (BACKLOG-003) |
| AI-002 | Implement Natural Language Tenner Entry | Not planned after release 1.0 (BACKLOG-003) |
| AI-003 | Implement Suggested Tenners | Not planned after release 1.0 (BACKLOG-003) |
| AI-004 | Implement Missed Responsibility Detection | Not planned after release 1.0 (BACKLOG-003) |
| AI-005 | Implement Smart Scheduling Suggestions | Not planned after release 1.0 (BACKLOG-003) |
| AI-006 | Implement Workload Balancing Recommendations | Not planned after release 1.0 (BACKLOG-003) |
| AI-007 | Implement Weekly AI Insights | Not planned after release 1.0 (BACKLOG-003) |
| AI-008 | Implement Tenner Assistant (Q&A) | Not planned after release 1.0 (BACKLOG-003) |
| AI-009 | Implement Tenner Splitting Assistant | Not planned after release 1.0 (BACKLOG-003) |
| FUTURE-001 | Support Multiple Households per User | Not planned after release 1.0 (BACKLOG-003) |
| FUTURE-002 | Harden Multi-Tenant Architecture | Not planned after release 1.0 (BACKLOG-003) |
| FUTURE-003 | Evaluate Public SaaS Offering | Not planned after release 1.0 (BACKLOG-003) |
| FUTURE-004 | Implement Tenner Templates | Not planned after release 1.0 (BACKLOG-003) |
| FUTURE-005 | Evaluate Template Marketplace | Not planned after release 1.0 (BACKLOG-003) |
| FUTURE-006 | Evaluate Gamification | Not planned after release 1.0 (BACKLOG-003) |
| FUTURE-007 | Evaluate Native Mobile App | Not planned after release 1.0 (BACKLOG-003) |
| FUTURE-008 | Evaluate Billing and Subscriptions | Not planned after release 1.0 (BACKLOG-003) |
| FUTURE-009 | Evaluate WhatsApp Notifications | Not planned after release 1.0 (BACKLOG-003) |
| FUTURE-010 | Evaluate Voice Assistant Integration | Not planned after release 1.0 (BACKLOG-003) |
