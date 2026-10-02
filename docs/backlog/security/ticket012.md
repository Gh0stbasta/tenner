# SECURITY-012: Implement Security Event Logging and Audit Trail

## Type

Infrastructure / Security

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Make security-relevant events traceable:

```text
Who changed infrastructure?
Who logged in, and did logins fail repeatedly?
Who deleted or restored a Tenner?
```

---

# Background

Application logs contain operational events. There is no defined audit trail for
security-relevant actions, and AWS API activity logging is not configured by Terraform.

---

# Dependencies

```text
SECURITY-002
SECURITY-004
```

---

# Scope

## AWS API Activity

- Verify that CloudTrail management events are recorded (account default event history: 90 days).
- If a trail is required for longer retention, create it with an S3 bucket and lifecycle
  policy (cost evaluation in the ticket). CloudTrail is not in the allowed-service list → ADR required.

## Application Audit Events

Emit structured `AUDIT` log events for:

```text
Tenner deleted / restored
Member created / deactivated
Household settings changed
Integration connected / disconnected
Notification channel linked / unlinked
```

Fields: `actorUserId`, `tenantId`, `action`, `targetId`, `timestamp`, `correlationId`.
No personal content (titles may be included; notes and addresses must not).

## Authentication Events

Document how to review Cognito sign-in events; enable Cognito log export
if available at acceptable cost.

## Retention

Audit log group retention: 365 days (document cost).

---

# Deliverables

```text
Audit logging helper
Audit events in services
CloudTrail decision and configuration
Log Insights saved query for audit events
docs/security.md update
```

---

# Validation

```bash
terraform fmt -check

terraform validate

npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- Audit events emitted for listed actions
- Audit logs retained per policy
- Infrastructure change trail available
- Documentation updated
- Tests passing

---

# Definition of Done

- Security-relevant activity is traceable

---

# Out of Scope

- SIEM integration
- Real-time intrusion detection
