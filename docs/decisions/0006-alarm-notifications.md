# ADR 0006: Alarm Notifications with Amazon SNS E-Mail

- **Status:** Accepted (2026-10-06)
- **Ticket:** OBSERVABILITY-002
- **Deciders:** repository owner (Stefan), by asking to implement the Alexa blockers including OBSERVABILITY-002
  („mach die blocker und die nächsten tickets für alexa feature“); the option is the ticket's simplest one.

## Context

CloudWatch alarms need an action target to reach the owner. Amazon SNS is the standard target but is not on the
allowed-services list. No chat channel (NOTIFICATION-006 Telegram) exists yet.

## Considered Options

| Option | Cost | Assessment |
|---|---|---|
| A: SNS topic with an e-mail subscription | free tier: 1,000 e-mails per month | simplest, no code; one confirmation click |
| B: SNS → Lambda → Telegram | free tier | needs NOTIFICATION-006 and a bot token; more moving parts |
| C: EventBridge rule on alarm state change → Lambda | free tier | custom code for formatting and delivery |

## Decision

**Option A.** Add "SNS (alarm notifications only)" to the allowed services. One standard topic
`tenner-alarms` per region that has alarms (eu-central-1; eu-west-1 for the Alexa skill, ALEXA-009), each with an
e-mail subscription to the owner address already used for cost alerts (`BUDGET_ALERT_EMAIL`).

## Consequences

- The owner confirms each subscription once from the e-mail AWS sends after the first deploy.
- Topics are not encrypted with a KMS key: CloudWatch cannot publish to topics encrypted with the AWS managed SNS
  key, and a customer key would cost 1 USD per month; alarm messages contain no personal or secret data.
- The deploy role needs SNS permissions for `tenner-alarms` (README → "Monitoring").
- Option B can be added later as a second subscription without changing the alarms.
- Cost: alarms and topic stay within the free tier (≤ 10 standard alarms, a few e-mails per month).
