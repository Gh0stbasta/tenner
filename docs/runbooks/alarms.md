# Runbook: Alarms

Alarms (OBSERVABILITY-002, ADR 0006) arrive by e-mail from SNS topic `tenner-alarms`. Each alarm description links
to its section here. First look: CloudWatch dashboard `tenner-prod` (Terraform output `cloudwatch_dashboard_url`),
then the log group named below (CloudWatch Logs Insights, newest first).

```text
fields @timestamp, level, message, errorCode, statusCode, correlationId
| filter level in ["ERROR", "WARN"]
| sort @timestamp desc
| limit 50
```

## API 5xx rate

More than 5 % of API requests failed with 5xx for 5 minutes.

1. Logs `/tenner/api`: `Request failed` entries name the route and error (`PersistenceError`, timeouts).
2. Smoke test: `curl https://<api>/prod/health` — `database: misconfigured/unavailable` points to DynamoDB or IAM.
3. If a deployment just ran: compare with the previous commit; roll back by reverting the commit on `main`
   (README → "Rollback").

## Lambda errors

A function (`tenner-api`, `tenner-notifier`) had errors in 2 of 3 five-minute periods.

1. Logs `/tenner/api` or `/tenner/notifier`: errors with stack-free `error` field.
2. `tenner-notifier`: `NotifierNotConfiguredError` → missing environment variable (Terraform); `secret unavailable`
   → set the parameter (README → "Secrets").
3. Fix forward or revert the last deployment.

## Lambda throttles

A function was throttled (account concurrency limit, TD-014). Check the dashboard's concurrent executions; a
traffic spike or a loop is the usual cause. API throttling (10 req/s) limits external load; raise the account
limit with AWS support if legitimate.

## DynamoDB system errors

AWS-side errors on a Tenner table. Usually transient; the SDK retries. If it persists, check the AWS Health
Dashboard for eu-central-1. No action in the repository.

## DynamoDB throttles

Throttled requests on an on-demand table: a sudden burst (e.g. a loop). Check which Lambda caused it (dashboard
capacity widgets) and its logs.

## Notifier no successful run

`tenner-notifier` had no successful run for 2 hours (it runs every 15 minutes).

1. Is the EventBridge rule `tenner-notifier-schedule` enabled? (`aws events describe-rule --name tenner-notifier-schedule`)
2. Logs `/tenner/notifier`: `NotifierRun` entries per run; errors before that point to configuration or IAM.
3. Missing notifications are not re-sent for past days; today's digest/alerts follow on the next run.

## Alexa skill

See [`alexa.md`](alexa.md) (ALEXA-009).
