# Tenner Backlog

This folder is the single source of truth for planned work on Tenner.

Every ticket is self-contained: it states its goal, background, dependencies, scope,
deliverables, validation commands, acceptance criteria, definition of done and
out-of-scope items, so that work can be picked up from the backlog alone.

The phased roadmap and the gap analysis that produced most domains are in
[`../roadmap.md`](../roadmap.md).

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
├── productivity/       PRODUCTIVITY-0xx
├── household/          HOUSEHOLD-0xx
├── household-admin/    HOUSEHOLD-ADMIN-0xx
├── ux/                 UX-0xx
├── security/           SECURITY-0xx
├── observability/      OBSERVABILITY-0xx
├── operations/         OPERATIONS-0xx
├── data-management/    DATA-0xx
├── mobile/             MOBILE-0xx
├── integrations/       INTEGRATION-0xx
├── ai/                 AI-0xx
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
| `productivity/` | Features that help people decide what to do next and finish it quickly |
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
| [TICKET-003](infra/ticket004.md) | Create Remote Terraform State Backend | Critical | MVP (existing) |
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
| [TICKET-021](infra/ticket021.md) | Introduce Environment Separation | Medium | V2 |
| [TICKET-022](infra/ticket022.md) | Configure Custom Domain and TLS | Low | V2 |
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
| [FRONTEND-010](frontend/ticket010.md) | Implement Household Activity History Page | Medium | V2 |

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
| [ANALYTICS-010](analytics/ticket010.md) | Introduce Analytics Pre-Aggregation | Low | Long-Term |

### Notifications (`notifications/`, prefix `NOTIFICATION-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [NOTIFICATION-001](notifications/ticket001.md) | Establish Notification Foundation | High | V2 |
| [NOTIFICATION-002](notifications/ticket002.md) | Implement Reminder Preferences | High | V2 |
| [NOTIFICATION-003](notifications/ticket003.md) | Implement Daily Digest | High | V2 |
| [NOTIFICATION-004](notifications/ticket004.md) | Implement Overdue Alerts | Medium | V2 |
| [NOTIFICATION-005](notifications/ticket005.md) | Implement Email Notification Channel | Medium | V2 |
| [NOTIFICATION-006](notifications/ticket006.md) | Implement Telegram Notification Channel | High | V2 |
| [NOTIFICATION-007](notifications/ticket007.md) | Implement Web Push Notification Channel | Medium | V2 |
| [NOTIFICATION-008](notifications/ticket008.md) | Implement Weekly Summary | Low | V2 |

### Scheduling (`scheduling/`, prefix `SCHEDULING-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [SCHEDULING-001](scheduling/ticket001.md) | Support Calendar-Based Frequencies | High | V2 |
| [SCHEDULING-002](scheduling/ticket002.md) | Support Weekday-Based Scheduling | Medium | V2 |
| [SCHEDULING-003](scheduling/ticket003.md) | Implement Snooze / Postpone Tenner | High | V2 |
| [SCHEDULING-004](scheduling/ticket004.md) | Implement Skip Occurrence | Low | V2 |
| [SCHEDULING-005](scheduling/ticket005.md) | Implement Pause & Vacation Mode | Medium | V2 |
| [SCHEDULING-006](scheduling/ticket006.md) | Support Seasonal Tenners | Low | Long-Term |
| [SCHEDULING-007](scheduling/ticket007.md) | Implement Preferred Days (Rule-Based Smart Scheduling) | Low | Long-Term |
| [SCHEDULING-008](scheduling/ticket008.md) | Implement Timezone-Aware Due Dates | High | V2 |

### Productivity (`productivity/`, prefix `PRODUCTIVITY-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [PRODUCTIVITY-001](productivity/ticket001.md) | Implement "I Have X Minutes" Suggestions | High | V2 |
| [PRODUCTIVITY-002](productivity/ticket002.md) | Introduce Tenner Importance | Medium | V2 |
| [PRODUCTIVITY-003](productivity/ticket003.md) | Implement Tenner Checklists | Low | V2 |
| [PRODUCTIVITY-004](productivity/ticket004.md) | Implement Completion Notes | Low | V2 |
| [PRODUCTIVITY-005](productivity/ticket005.md) | Implement Bulk Actions | Low | V2 |

### Household Features (`household/`, prefix `HOUSEHOLD-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [HOUSEHOLD-001](household/ticket001.md) | Implement Rotating Assignment | Medium | V2 |
| [HOUSEHOLD-002](household/ticket002.md) | Support Shared (Unassigned) Tenners | Medium | V2 |
| [HOUSEHOLD-003](household/ticket003.md) | Implement Household Activity Acknowledgements | Low | Long-Term |
| [HOUSEHOLD-004](household/ticket004.md) | Implement Temporary Handover | Low | V2 |

### Household Administration (`household-admin/`, prefix `HOUSEHOLD-ADMIN-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [HOUSEHOLD-ADMIN-001](household-admin/ticket001.md) | Implement Household Member Management | High | V2 |
| [HOUSEHOLD-ADMIN-002](household-admin/ticket002.md) | Implement Category Management | Medium | V2 |
| [HOUSEHOLD-ADMIN-003](household-admin/ticket003.md) | Implement Household Settings | Medium | V2 |
| [HOUSEHOLD-ADMIN-004](household-admin/ticket004.md) | Implement Member Deactivation | Low | V2 |
| [HOUSEHOLD-ADMIN-005](household-admin/ticket005.md) | Introduce Household Roles | Low | Long-Term |

### User Experience (`ux/`, prefix `UX-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [UX-001](ux/ticket001.md) | Implement First-Run Onboarding | Medium | V2 |
| [UX-002](ux/ticket002.md) | Implement Keyboard Shortcuts | Low | V2 |
| [UX-003](ux/ticket003.md) | Conduct Accessibility Audit (WCAG 2.1 AA) | Medium | V2 |
| [UX-004](ux/ticket004.md) | Implement Internationalization (German and English) | Medium | V2 |
| [UX-005](ux/ticket005.md) | Implement Global Error Handling and Network Feedback | High | MVP |
| [UX-006](ux/ticket006.md) | Implement Week Calendar View | Low | V2 |
| [UX-007](ux/ticket007.md) | Establish Frontend Performance Budget | Medium | V2 |

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
| [SECURITY-008](security/ticket008.md) | Harden Software Supply Chain | Medium | V2 |
| [SECURITY-009](security/ticket009.md) | Add Infrastructure-as-Code Security Scanning | Medium | V2 |
| [SECURITY-010](security/ticket010.md) | Add Static Code Analysis and Secret Scanning | Medium | V2 |
| [SECURITY-011](security/ticket011.md) | Enable Multi-Factor Authentication | Low | V2 |
| [SECURITY-012](security/ticket012.md) | Implement Security Event Logging and Audit Trail | Medium | V2 |
| [SECURITY-013](security/ticket013.md) | Create Threat Model and Privacy Review | Medium | V2 |
| [SECURITY-014](security/ticket014.md) | Cap API Cost with Stage Throttling | Critical | MVP |

### Observability (`observability/`, prefix `OBSERVABILITY-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [OBSERVABILITY-001](observability/ticket001.md) | Create CloudWatch Operational Dashboard | Medium | V2 |
| [OBSERVABILITY-002](observability/ticket002.md) | Implement Alarms and Alert Routing | High | V2 |
| [OBSERVABILITY-003](observability/ticket003.md) | Publish Business and Performance Metrics | Medium | V2 |
| [OBSERVABILITY-004](observability/ticket004.md) | Enable Distributed Tracing | Low | Long-Term |
| [OBSERVABILITY-005](observability/ticket005.md) | Implement Frontend Error Reporting | Medium | V2 |
| [OBSERVABILITY-006](observability/ticket006.md) | Define Logging Standards and Saved Queries | Low | V2 |

### Operations (`operations/`, prefix `OPERATIONS-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [OPERATIONS-001](operations/ticket001.md) | Implement Cost Monitoring and Budgets | High | MVP |
| [OPERATIONS-002](operations/ticket002.md) | Write Operational Runbooks | Medium | V2 |
| [OPERATIONS-003](operations/ticket003.md) | Validate Backup and Restore | High | V2 |
| [OPERATIONS-004](operations/ticket004.md) | Implement Release Versioning and Fast Rollback | Medium | V2 |
| [OPERATIONS-005](operations/ticket005.md) | Detect Terraform Drift | Low | V2 |
| [OPERATIONS-006](operations/ticket006.md) | Implement Post-Deployment Smoke Tests | High | MVP |
| [OPERATIONS-007](operations/ticket007.md) | Provide Maintenance Script Framework | Low | V2 |

### Data Management (`data-management/`, prefix `DATA-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [DATA-001](data-management/ticket001.md) | Implement Data Export | Medium | V2 |
| [DATA-002](data-management/ticket002.md) | Implement Data Import | Low | V2 |
| [DATA-003](data-management/ticket003.md) | Implement Scheduled Data Archive to S3 | Low | V2 |
| [DATA-004](data-management/ticket004.md) | Define Data Retention Policy | Low | V2 |
| [DATA-005](data-management/ticket005.md) | Implement Member Data Erasure | Low | Long-Term |
| [DATA-006](data-management/ticket006.md) | Establish Schema Versioning and Data Migrations | Medium | V2 |
| [DATA-007](data-management/ticket007.md) | Implement Completion Correction | Low | V2 |

### Mobile Experience (`mobile/`, prefix `MOBILE-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [MOBILE-001](mobile/ticket001.md) | Make Tenner an Installable Progressive Web App | High | V2 |
| [MOBILE-002](mobile/ticket002.md) | Implement Service Worker and App Shell Caching | Medium | V2 |
| [MOBILE-003](mobile/ticket003.md) | Implement Offline Read Support | Low | V2 |
| [MOBILE-004](mobile/ticket004.md) | Implement Offline Completion Queue | Low | Long-Term |
| [MOBILE-005](mobile/ticket005.md) | Optimize Mobile Navigation and Touch Interaction | Medium | V2 |
| [MOBILE-006](mobile/ticket006.md) | Implement Push Notification Subscription | Medium | V2 |

### Integrations (`integrations/`, prefix `INTEGRATION-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [INTEGRATION-001](integrations/ticket001.md) | Establish Integration Foundation | Medium | V2 |
| [INTEGRATION-002](integrations/ticket002.md) | Implement Interactive Telegram Bot | Medium | V2 |
| [INTEGRATION-003](integrations/ticket003.md) | Implement Strava Activity Auto-Completion | Medium | V2 |
| [INTEGRATION-004](integrations/ticket004.md) | Evaluate and Implement Garmin Connect Integration | Low | Long-Term |
| [INTEGRATION-005](integrations/ticket005.md) | Support Zwift Rides via Strava | Low | Long-Term |
| [INTEGRATION-006](integrations/ticket006.md) | Provide ICS Calendar Feed | Medium | V2 |
| [INTEGRATION-007](integrations/ticket007.md) | Implement Google Calendar Two-Way Integration | Low | Long-Term |
| [INTEGRATION-008](integrations/ticket008.md) | Implement Outlook Calendar Integration | Low | Long-Term |
| [INTEGRATION-009](integrations/ticket009.md) | Provide Personal Access Tokens for Automations | Low | Long-Term |

### AI Features (`ai/`, prefix `AI-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [AI-001](ai/ticket001.md) | Establish AI Foundation | Medium | V2 |
| [AI-002](ai/ticket002.md) | Implement Natural Language Tenner Entry | Medium | V2 |
| [AI-003](ai/ticket003.md) | Implement Suggested Tenners | Low | V2 |
| [AI-004](ai/ticket004.md) | Implement Missed Responsibility Detection | Low | Long-Term |
| [AI-005](ai/ticket005.md) | Implement Smart Scheduling Suggestions | Low | Long-Term |
| [AI-006](ai/ticket006.md) | Implement Workload Balancing Recommendations | Low | Long-Term |
| [AI-007](ai/ticket007.md) | Implement Weekly AI Insights | Low | Long-Term |
| [AI-008](ai/ticket008.md) | Implement Tenner Assistant (Q&A) | Low | Long-Term |
| [AI-009](ai/ticket009.md) | Implement Tenner Splitting Assistant | Low | Long-Term |

### Future / Postponed (`future/`, prefix `FUTURE-`)

| ID | Title | Priority | Phase |
|---|---|---|---|
| [FUTURE-001](future/ticket001.md) | Support Multiple Households per User | Low | Long-Term |
| [FUTURE-002](future/ticket002.md) | Harden Multi-Tenant Architecture | Low | Long-Term |
| [FUTURE-003](future/ticket003.md) | Evaluate Public SaaS Offering | Low | Long-Term |
| [FUTURE-004](future/ticket004.md) | Implement Tenner Templates | Low | Long-Term |
| [FUTURE-005](future/ticket005.md) | Evaluate Template Marketplace | Low | Long-Term |
| [FUTURE-006](future/ticket006.md) | Evaluate Gamification | Low | Long-Term |
| [FUTURE-007](future/ticket007.md) | Evaluate Native Mobile App | Low | Long-Term |
| [FUTURE-008](future/ticket008.md) | Evaluate Billing and Subscriptions | Low | Long-Term |
| [FUTURE-009](future/ticket009.md) | Evaluate WhatsApp Notifications | Low | Long-Term |
| [FUTURE-010](future/ticket010.md) | Evaluate Voice Assistant Integration | Low | Long-Term |
| [FUTURE-011](future/ticket011.md) | Add Social Login (Google) | High | MVP (pulled forward) |

### Hotfix

Urgent changes outside the regular backlog live in `docs/hotfix/` (owner decision 2026-10-05).

| ID | Title | Priority | Phase |
|---|---|---|---|
| [HOTFIX-001](../hotfix/ticket001.md) | First Login & Household Assignment Flow | High | MVP |
