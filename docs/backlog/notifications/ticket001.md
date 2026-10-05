# NOTIFICATION-001: Establish Notification Foundation

## Type

Backend / Infrastructure

---

## Priority

High

---

## Phase

V2

---

## Goal

Create the channel-independent foundation for sending notifications.

After completion of this ticket Tenner can run scheduled notification jobs,
determine recipients and content, and dispatch messages through a pluggable
channel interface with deduplication and delivery logging.

No real external channel is connected in this ticket.

---

# Background

The architecture lists Notifications (Telegram, WhatsApp, Email, Push) as future ideas.

Tenner currently works only when a user actively opens the app. Reminders are
needed so that due and overdue Tenners are not forgotten.

EventBridge is an allowed service according to the architecture.

---

# Dependencies

```text
TICKET-005
TICKET-016
```

---

# Scope

## Infrastructure

```text
Notifier Lambda (separate from API Lambda)
EventBridge Scheduler schedule(s)
DynamoDB table: tenner-notifications (delivery log)
CloudWatch log group with retention
IAM role with least privilege
```

A separate Lambda is justified because notification jobs are scheduled,
not request-driven, and need different permissions.

---

## Scheduling

Run the notifier every 15 minutes:

```text
rate(15 minutes)
```

Each run determines which notification jobs are due for which user,
based on preferences (NOTIFICATION-002, defaults until then).

Cost estimate: ~2,900 invocations/month → within free tier.

---

## Channel Interface

```typescript
interface NotificationChannel {
  readonly type: ChannelType;          // LOG | EMAIL | TELEGRAM | WEB_PUSH
  send(message: NotificationMessage, recipient: Recipient): Promise<DeliveryResult>;
}
```

Implement only:

```text
LogChannel   (writes structured log, used for testing and dry runs)
```

---

## Message Model

```typescript
NotificationMessage {
  type: "DAILY_DIGEST" | "OVERDUE_ALERT" | "WEEKLY_SUMMARY";
  userId: string;
  subject: string;
  textBody: string;
  deepLink?: string;
}
```

Rendering must be separated from delivery so every channel can reuse it.

---

## Deduplication

Each notification has a deterministic key:

```text
<tenantId>#<userId>#<type>#<channel>#<yyyy-mm-dd>
```

Use a conditional `PutItem` on `tenner-notifications` to ensure a notification
is sent at most once per key, even if the notifier runs twice.

Records expire via DynamoDB TTL after 90 days.

---

## Delivery Log

Record:

```text
notificationKey
type
channel
userId
status (SENT | FAILED | SKIPPED)
attempts
createdAt
expiresAt (TTL)
```

Do not log message bodies containing personal data beyond Tenner titles.

---

## Failure Handling

- A failing channel must not block other users or channels.
- Retries: up to 3 attempts with exponential backoff within one run.
- Failures are logged with error codes (no secrets, no tokens).

---

## Shared Tenners (added by HOUSEHOLD-002)

Tenners with `assignedTo = "HOUSEHOLD"` belong to everyone: notify all active members, deduplicated per user.

## Paused Tenners (added by SCHEDULING-005)

Suppress notifications for paused Tenners: individually paused (`pausedAt` set and `pausedUntil` null or ≥ today)
or covered by the household vacation (`tenner-households.vacation`: today within `from`–`until` and category
listed, or all categories). Use the same rules as `backend/src/utils/pause.ts`.

---

# Testing Requirements

```text
Job Selection By Time
Deduplication (double run)
Channel Failure Isolation
Retry Behavior
Log Channel Output
TTL Attribute Set
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Notifier Lambda
EventBridge schedule (Terraform)
tenner-notifications table (Terraform)
Channel interface + LogChannel
Message model and renderer
Tests
docs/architecture.md (notification architecture)
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

- Notifier Lambda runs on schedule
- Channel interface exists with LogChannel
- Deduplication prevents duplicate sends
- Delivery log written with TTL
- Failures isolated per user and channel
- IAM follows least privilege
- Architecture documented
- Tests passing

---

# Definition of Done

- Notification pipeline exists end to end with a test channel
- Infrastructure deploys through GitHub Actions

---

# Out of Scope

- Real channels (NOTIFICATION-005, 006, 007)
- Preferences UI (NOTIFICATION-002)
- Notification content types (NOTIFICATION-003, 004, 008)
