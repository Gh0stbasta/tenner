# Alarms (OBSERVABILITY-002, ADR 0006): sustained failure conditions only, sent by e-mail through SNS topic
# tenner-alarms. Each description links to its runbook section in docs/runbooks/alarms.md. Created with the
# dashboard (var.observability_enabled). Low-traffic metrics treat missing data as not breaching.

locals {
  alarms_enabled  = var.observability_enabled
  alarm_topic     = "${local.name_prefix}-alarms"
  runbook_url     = "https://github.com/${local.common_tags.Repository}/blob/main/docs/runbooks/alarms.md"
  alarm_functions = concat([local.api_function_name], var.notifications_enabled ? [local.notifier_function_name] : [])
  alarm_tables    = local.dashboard_tables
}

resource "aws_sns_topic" "alarms" {
  count = local.alarms_enabled ? 1 : 0

  name = local.alarm_topic

  tags = {
    Name        = local.alarm_topic
    Purpose     = "Alarm notifications."
    Description = "Sends Tenner CloudWatch alarms to the owner by e-mail."
  }
}

# Confirmed once by the owner from the e-mail AWS sends (ADR 0006).
resource "aws_sns_topic_subscription" "alarms_email" {
  count = local.alarms_enabled ? 1 : 0

  topic_arn = aws_sns_topic.alarms[0].arn
  protocol  = "email"
  endpoint  = var.budget_alert_email
}

resource "aws_cloudwatch_metric_alarm" "api_5xx_rate" {
  count = local.alarms_enabled ? 1 : 0

  alarm_name          = "${local.name_prefix}-api-5xx-rate"
  alarm_description   = "API 5xx responses above ${var.alarm_thresholds.api_5xx_rate_percent} % for 5 minutes. Runbook: ${local.runbook_url}#api-5xx-rate"
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.alarm_thresholds.api_5xx_rate_percent
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms[0].arn]
  ok_actions          = [aws_sns_topic.alarms[0].arn]

  metric_query {
    id          = "rate"
    expression  = "IF(requests > 0, 100 * errors / requests, 0)"
    label       = "5xx rate (%)"
    return_data = true
  }

  metric_query {
    id = "errors"
    metric {
      namespace   = "AWS/ApiGateway"
      metric_name = "5xx"
      period      = 300
      stat        = "Sum"
      dimensions  = { ApiId = aws_apigatewayv2_api.api.id, Stage = aws_apigatewayv2_stage.api.name }
    }
  }

  metric_query {
    id = "requests"
    metric {
      namespace   = "AWS/ApiGateway"
      metric_name = "Count"
      period      = 300
      stat        = "Sum"
      dimensions  = { ApiId = aws_apigatewayv2_api.api.id, Stage = aws_apigatewayv2_stage.api.name }
    }
  }

  tags = {
    Name        = "${local.name_prefix}-api-5xx-rate"
    Purpose     = "Alarm."
    Description = "API server error rate."
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = local.alarms_enabled ? toset(local.alarm_functions) : toset([])

  alarm_name          = "${each.key}-errors"
  alarm_description   = "Lambda ${each.key} errors in 2 of 3 five-minute periods. Runbook: ${local.runbook_url}#lambda-errors"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = each.key }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.alarm_thresholds.lambda_errors
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms[0].arn]
  ok_actions          = [aws_sns_topic.alarms[0].arn]

  tags = {
    Name        = "${each.key}-errors"
    Purpose     = "Alarm."
    Description = "Lambda errors."
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  for_each = local.alarms_enabled ? toset(local.alarm_functions) : toset([])

  alarm_name          = "${each.key}-throttles"
  alarm_description   = "Lambda ${each.key} was throttled. Runbook: ${local.runbook_url}#lambda-throttles"
  namespace           = "AWS/Lambda"
  metric_name         = "Throttles"
  dimensions          = { FunctionName = each.key }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms[0].arn]

  tags = {
    Name        = "${each.key}-throttles"
    Purpose     = "Alarm."
    Description = "Lambda throttles."
  }
}

# One alarm per DynamoDB failure kind across all tables (metric math) keeps the alarm count in the free tier.
resource "aws_cloudwatch_metric_alarm" "dynamodb" {
  for_each = local.alarms_enabled ? { system-errors = "SystemErrors", throttles = "ThrottledRequests" } : {}

  alarm_name          = "${local.name_prefix}-dynamodb-${each.key}"
  alarm_description   = "DynamoDB ${each.value} > 0 on a Tenner table. Runbook: ${local.runbook_url}#dynamodb-${each.key}"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms[0].arn]

  metric_query {
    id          = "total"
    expression  = join(" + ", [for index, _ in local.alarm_tables : "FILL(t${index}, 0)"])
    label       = "${each.value} (all tables)"
    return_data = true
  }

  dynamic "metric_query" {
    for_each = local.alarm_tables
    content {
      id = "t${metric_query.key}"
      metric {
        namespace   = "AWS/DynamoDB"
        metric_name = each.value
        period      = 300
        stat        = "Sum"
        dimensions  = { TableName = metric_query.value }
      }
    }
  }

  tags = {
    Name        = "${local.name_prefix}-dynamodb-${each.key}"
    Purpose     = "Alarm."
    Description = "DynamoDB ${each.value}."
  }
}

# Notifier job failed: no successful run (invocations without errors) for notifier_silence_hours.
resource "aws_cloudwatch_metric_alarm" "notifier_silent" {
  count = local.alarms_enabled && var.notifications_enabled ? 1 : 0

  alarm_name          = "${local.notifier_function_name}-no-successful-run"
  alarm_description   = "No successful notifier run in ${var.alarm_thresholds.notifier_silence_hours} hours. Runbook: ${local.runbook_url}#notifier-no-successful-run"
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  evaluation_periods  = var.alarm_thresholds.notifier_silence_hours
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alarms[0].arn]
  ok_actions          = [aws_sns_topic.alarms[0].arn]

  metric_query {
    id          = "successful"
    expression  = "FILL(invocations, 0) - FILL(errors, 0)"
    label       = "Successful runs per hour"
    return_data = true
  }

  metric_query {
    id = "invocations"
    metric {
      namespace   = "AWS/Lambda"
      metric_name = "Invocations"
      period      = 3600
      stat        = "Sum"
      dimensions  = { FunctionName = local.notifier_function_name }
    }
  }

  metric_query {
    id = "errors"
    metric {
      namespace   = "AWS/Lambda"
      metric_name = "Errors"
      period      = 3600
      stat        = "Sum"
      dimensions  = { FunctionName = local.notifier_function_name }
    }
  }

  tags = {
    Name        = "${local.notifier_function_name}-no-successful-run"
    Purpose     = "Alarm."
    Description = "Notifier stopped running successfully."
  }
}
