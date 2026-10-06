# Alexa operations (ALEXA-009): metrics from log lines (metric filters on event names; no personal data in logs),
# alarms on the skill Lambda in eu-west-1 (own SNS topic: alarms can only notify topics in their region) and on
# widget/notification failures in eu-central-1. Created with observability_enabled and the respective component.

locals {
  alexa_monitoring_enabled    = var.observability_enabled && local.alexa_enabled
  alexa_notifier_monitoring   = var.observability_enabled && local.alexa_notifier_enabled
  alexa_metrics_namespace     = "Tenner/Alexa"
  alexa_skill_alarm_threshold = { error_rate_percent = 5, p95_duration_ms = 5000 }
}

# Skill: outcome ERROR (handler or API failure) and Tenner API errors seen by the skill.
resource "aws_cloudwatch_log_metric_filter" "alexa_skill_errors" {
  count    = local.alexa_monitoring_enabled ? 1 : 0
  provider = aws.alexa

  name           = "${local.alexa_function_name}-errors"
  log_group_name = aws_cloudwatch_log_group.alexa_skill[0].name
  pattern        = "\"skill_request\" \"ERROR\""

  metric_transformation {
    name          = "SkillRequestErrors"
    namespace     = local.alexa_metrics_namespace
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "alexa_skill_requests" {
  count    = local.alexa_monitoring_enabled ? 1 : 0
  provider = aws.alexa

  name           = "${local.alexa_function_name}-requests"
  log_group_name = aws_cloudwatch_log_group.alexa_skill[0].name
  pattern        = "\"skill_request\""

  metric_transformation {
    name          = "SkillRequests"
    namespace     = local.alexa_metrics_namespace
    value         = "1"
    default_value = "0"
  }
}

# Notifier: Data Store push failures (widget) and failed Alexa notification deliveries.
resource "aws_cloudwatch_log_metric_filter" "alexa_push_failures" {
  for_each = local.alexa_notifier_monitoring ? {
    WidgetPushFailures        = "\"WidgetPushFailed\""
    AlexaNotificationFailures = "\"NotificationDelivery\" \"FAILED\" \"ALEXA\""
  } : {}

  name           = "${local.notifier_function_name}-${lower(each.key)}"
  log_group_name = aws_cloudwatch_log_group.notifier[0].name
  pattern        = each.value

  metric_transformation {
    name          = each.key
    namespace     = local.alexa_metrics_namespace
    value         = "1"
    default_value = "0"
  }
}

resource "aws_sns_topic" "alexa_alarms" {
  count    = local.alexa_monitoring_enabled ? 1 : 0
  provider = aws.alexa

  name = local.alarm_topic

  tags = {
    Name        = local.alarm_topic
    Purpose     = "Alarm notifications."
    Description = "Sends Tenner Alexa skill alarms to the owner by e-mail."
  }
}

resource "aws_sns_topic_subscription" "alexa_alarms_email" {
  count    = local.alexa_monitoring_enabled ? 1 : 0
  provider = aws.alexa

  topic_arn = aws_sns_topic.alexa_alarms[0].arn
  protocol  = "email"
  endpoint  = var.budget_alert_email
}

# Skill errors above 5 % of requests in 15 minutes.
resource "aws_cloudwatch_metric_alarm" "alexa_skill_error_rate" {
  count    = local.alexa_monitoring_enabled ? 1 : 0
  provider = aws.alexa

  alarm_name          = "${local.alexa_function_name}-error-rate"
  alarm_description   = "Alexa skill: more than ${local.alexa_skill_alarm_threshold.error_rate_percent} % of requests failed in 15 minutes. Runbook: https://github.com/${local.common_tags.Repository}/blob/main/docs/runbooks/alexa.md#skill-lambda-errors--timeouts"
  comparison_operator = "GreaterThanThreshold"
  threshold           = local.alexa_skill_alarm_threshold.error_rate_percent
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alexa_alarms[0].arn]
  ok_actions          = [aws_sns_topic.alexa_alarms[0].arn]

  metric_query {
    id          = "rate"
    expression  = "IF(requests > 0, 100 * (errors + lambdaErrors) / requests, 0)"
    label       = "Skill error rate (%)"
    return_data = true
  }

  metric_query {
    id = "errors"
    metric {
      namespace   = local.alexa_metrics_namespace
      metric_name = "SkillRequestErrors"
      period      = 900
      stat        = "Sum"
    }
  }

  metric_query {
    id = "requests"
    metric {
      namespace   = local.alexa_metrics_namespace
      metric_name = "SkillRequests"
      period      = 900
      stat        = "Sum"
    }
  }

  metric_query {
    id = "lambdaErrors"
    metric {
      namespace   = "AWS/Lambda"
      metric_name = "Errors"
      period      = 900
      stat        = "Sum"
      dimensions  = { FunctionName = local.alexa_function_name }
    }
  }

  tags = {
    Name        = "${local.alexa_function_name}-error-rate"
    Purpose     = "Alarm."
    Description = "Alexa skill error rate."
  }
}

# p95 duration above 5 s (Alexa waits at most 8 s).
resource "aws_cloudwatch_metric_alarm" "alexa_skill_duration" {
  count    = local.alexa_monitoring_enabled ? 1 : 0
  provider = aws.alexa

  alarm_name          = "${local.alexa_function_name}-p95-duration"
  alarm_description   = "Alexa skill p95 duration above ${local.alexa_skill_alarm_threshold.p95_duration_ms} ms (Alexa limit 8 s). Runbook: https://github.com/${local.common_tags.Repository}/blob/main/docs/runbooks/alexa.md#skill-lambda-errors--timeouts"
  namespace           = "AWS/Lambda"
  metric_name         = "Duration"
  dimensions          = { FunctionName = local.alexa_function_name }
  extended_statistic  = "p95"
  period              = 900
  evaluation_periods  = 1
  comparison_operator = "GreaterThanThreshold"
  threshold           = local.alexa_skill_alarm_threshold.p95_duration_ms
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alexa_alarms[0].arn]

  tags = {
    Name        = "${local.alexa_function_name}-p95-duration"
    Purpose     = "Alarm."
    Description = "Alexa skill latency."
  }
}

# Widget pushes or Alexa notifications failing (one alarm for both keeps the alarm count low).
resource "aws_cloudwatch_metric_alarm" "alexa_delivery_failures" {
  count = local.alexa_notifier_monitoring ? 1 : 0

  alarm_name          = "${local.name_prefix}-alexa-delivery-failures"
  alarm_description   = "Echo Show widget pushes or Alexa notifications failed. Runbook: ${local.runbook_url}#alexa-skill and https://github.com/${local.common_tags.Repository}/blob/main/docs/runbooks/alexa.md#widget-not-updating"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms[0].arn]

  metric_query {
    id          = "failures"
    expression  = "FILL(widget, 0) + FILL(notifications, 0)"
    label       = "Alexa delivery failures"
    return_data = true
  }

  metric_query {
    id = "widget"
    metric {
      namespace   = local.alexa_metrics_namespace
      metric_name = "WidgetPushFailures"
      period      = 3600
      stat        = "Sum"
    }
  }

  metric_query {
    id = "notifications"
    metric {
      namespace   = local.alexa_metrics_namespace
      metric_name = "AlexaNotificationFailures"
      period      = 3600
      stat        = "Sum"
    }
  }

  tags = {
    Name        = "${local.name_prefix}-alexa-delivery-failures"
    Purpose     = "Alarm."
    Description = "Alexa widget and notification failures."
  }
}
