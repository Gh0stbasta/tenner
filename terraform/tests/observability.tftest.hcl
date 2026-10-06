# Offline tests for monitoring (OBSERVABILITY-001/002).

# Placeholder Google OAuth client (FUTURE-011); the real values come from GitHub in CI.
variables {
  google_client_id     = "123456789012-abcdefghijklmnop.apps.googleusercontent.com"
  google_client_secret = "placeholder-secret"
  budget_alert_email   = "owner@example.com"
}


mock_provider "archive" {
  mock_data "archive_file" {
    defaults = {
      output_path         = "tenner-api.zip"
      output_base64sha256 = "bW9jaw=="
    }
  }
}

mock_provider "aws" {
  mock_data "aws_region" {
    defaults = {
      region = "eu-central-1"
    }
  }

  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
}

override_resource {
  target          = aws_cognito_user_pool.users
  override_during = plan
  values = {
    id = "eu-central-1_TEST"
  }
}

# Alexa skill region (ALEXA-001): mocked like the default provider.
mock_provider "aws" {
  alias = "alexa"
}


# Known IDs at plan time so the dashboard body can be checked.
override_resource {
  target          = aws_apigatewayv2_api.api
  override_during = plan
  values = {
    id            = "api123"
    execution_arn = "arn:aws:execute-api:eu-central-1:123456789012:api123"
    api_endpoint  = "https://api123.execute-api.eu-central-1.amazonaws.com"
  }
}

override_resource {
  target          = aws_cloudfront_distribution.frontend
  override_during = plan
  values = {
    id          = "E123"
    arn         = "arn:aws:cloudfront::123456789012:distribution/E123"
    domain_name = "d111111abcdef8.cloudfront.net"
  }
}

run "no_dashboard_by_default" {
  command = plan

  assert {
    condition     = length(aws_cloudwatch_dashboard.tenner) == 0 && output.cloudwatch_dashboard_url == ""
    error_message = "Monitoring stays off until observability_enabled is set."
  }
}

run "dashboard_shows_all_components" {
  command = plan

  variables {
    observability_enabled = true
  }

  assert {
    condition     = aws_cloudwatch_dashboard.tenner[0].dashboard_name == "tenner-prod"
    error_message = "The dashboard must be named tenner-<environment>."
  }

  assert {
    condition = alltrue([for metric in ["\"Count\"", "\"5xx\"", "\"Latency\"", "\"Throttles\"", "\"ConcurrentExecutions\"", "\"ThrottledRequests\"", "\"SystemErrors\"", "\"5xxErrorRate\"", "tenner-api"] :
    strcontains(aws_cloudwatch_dashboard.tenner[0].dashboard_body, metric)])
    error_message = "The dashboard must show API, Lambda, DynamoDB and CloudFront metrics."
  }

  assert {
    condition     = !strcontains(aws_cloudwatch_dashboard.tenner[0].dashboard_body, "tenner-notifier") && !strcontains(aws_cloudwatch_dashboard.tenner[0].dashboard_body, "tenner-alexa-skill")
    error_message = "Disabled components must not appear on the dashboard."
  }
}

run "dashboard_adds_optional_components" {
  command = plan

  variables {
    observability_enabled = true
    notifications_enabled = true
    alexa_skill_id        = "amzn1.ask.skill.12345678-90ab-cdef-1234-567890abcdef"
  }

  assert {
    condition     = strcontains(aws_cloudwatch_dashboard.tenner[0].dashboard_body, "tenner-notifier") && strcontains(aws_cloudwatch_dashboard.tenner[0].dashboard_body, "tenner-notifications")
    error_message = "The notifier and its table must appear when enabled."
  }

  assert {
    condition     = strcontains(aws_cloudwatch_dashboard.tenner[0].dashboard_body, "tenner-alexa-skill") && strcontains(aws_cloudwatch_dashboard.tenner[0].dashboard_body, "eu-west-1")
    error_message = "The Alexa skill Lambda must appear with its own region."
  }

  assert {
    condition = alltrue([for widget in jsondecode(aws_cloudwatch_dashboard.tenner[0].dashboard_body).widgets :
      alltrue([for metric in try(widget.properties.metrics, []) : can(length(metric)) && !can(tostring(metric))])
    ])
    error_message = "Every dashboard metrics entry must be an array (CloudWatch rejects flattened metric lists)."
  }
}

run "alarms_reach_the_owner_by_email" {
  command = plan

  variables {
    observability_enabled = true
    notifications_enabled = true
  }

  assert {
    condition     = aws_sns_topic.alarms[0].name == "tenner-alarms" && aws_sns_topic_subscription.alarms_email[0].protocol == "email" && aws_sns_topic_subscription.alarms_email[0].endpoint == "owner@example.com"
    error_message = "Alarms must go to the owner by e-mail through tenner-alarms."
  }

  assert {
    condition     = toset(keys(aws_cloudwatch_metric_alarm.lambda_errors)) == toset(["tenner-api", "tenner-notifier"]) && aws_cloudwatch_metric_alarm.lambda_errors["tenner-api"].datapoints_to_alarm == 2 && aws_cloudwatch_metric_alarm.lambda_errors["tenner-api"].evaluation_periods == 3
    error_message = "Lambda errors must alarm on 2 of 3 periods per function."
  }

  assert {
    condition     = aws_cloudwatch_metric_alarm.api_5xx_rate[0].threshold == 5 && aws_cloudwatch_metric_alarm.api_5xx_rate[0].treat_missing_data == "notBreaching"
    error_message = "API 5xx rate alarm must use 5 % and ignore missing data."
  }

  assert {
    condition     = length(aws_cloudwatch_metric_alarm.dynamodb) == 2 && length(aws_cloudwatch_metric_alarm.notifier_silent) == 1 && aws_cloudwatch_metric_alarm.notifier_silent[0].treat_missing_data == "breaching"
    error_message = "DynamoDB and notifier alarms must exist; a silent notifier is breaching."
  }

  assert {
    condition = alltrue(concat(
      [for alarm in values(aws_cloudwatch_metric_alarm.lambda_errors) : strcontains(alarm.alarm_description, "docs/runbooks/alarms.md#")],
      [for alarm in values(aws_cloudwatch_metric_alarm.dynamodb) : strcontains(alarm.alarm_description, "docs/runbooks/alarms.md#")],
      [strcontains(aws_cloudwatch_metric_alarm.api_5xx_rate[0].alarm_description, "#api-5xx-rate")],
    ))
    error_message = "Every alarm must link its runbook."
  }

  assert {
    condition     = 1 + length(aws_cloudwatch_metric_alarm.lambda_errors) + length(aws_cloudwatch_metric_alarm.lambda_throttles) + length(aws_cloudwatch_metric_alarm.dynamodb) + length(aws_cloudwatch_metric_alarm.notifier_silent) <= 10
    error_message = "Keep the alarms within the 10 free standard alarms."
  }
}

run "no_notifier_alarm_without_notifier" {
  command = plan

  variables {
    observability_enabled = true
  }

  assert {
    condition     = length(aws_cloudwatch_metric_alarm.notifier_silent) == 0 && toset(keys(aws_cloudwatch_metric_alarm.lambda_errors)) == toset(["tenner-api"])
    error_message = "Notifier alarms only exist with the notifier."
  }
}

run "alexa_monitoring" {
  command = plan

  variables {
    observability_enabled = true
    notifications_enabled = true
    alexa_skill_id        = "amzn1.ask.skill.12345678-90ab-cdef-1234-567890abcdef"
  }

  assert {
    condition     = aws_cloudwatch_metric_alarm.alexa_skill_error_rate[0].threshold == 5 && aws_cloudwatch_metric_alarm.alexa_skill_duration[0].threshold == 5000 && aws_cloudwatch_metric_alarm.alexa_skill_duration[0].extended_statistic == "p95"
    error_message = "Skill alarms: error rate > 5 % in 15 minutes and p95 duration > 5 s."
  }

  assert {
    condition     = aws_sns_topic_subscription.alexa_alarms_email[0].protocol == "email" && aws_cloudwatch_log_metric_filter.alexa_skill_errors[0].pattern == "\"skill_request\" \"ERROR\""
    error_message = "Skill alarms go to an eu-west-1 topic by e-mail; errors are counted from the request log."
  }

  assert {
    condition     = toset(keys(aws_cloudwatch_log_metric_filter.alexa_push_failures)) == toset(["WidgetPushFailures", "AlexaNotificationFailures"]) && length(aws_cloudwatch_metric_alarm.alexa_delivery_failures) == 1
    error_message = "Widget push and Alexa notification failures must be measured and alarmed."
  }

  assert {
    condition     = strcontains(aws_cloudwatch_dashboard.tenner[0].dashboard_body, "Alexa skill: requests per intent") && strcontains(aws_cloudwatch_dashboard.tenner[0].dashboard_body, "WidgetPushFailures")
    error_message = "The dashboard needs an Alexa section."
  }

  assert {
    condition     = strcontains(aws_cloudwatch_metric_alarm.alexa_skill_error_rate[0].alarm_description, "docs/runbooks/alexa.md#")
    error_message = "Alexa alarms link the Alexa runbook."
  }
}

run "no_alexa_monitoring_without_skill" {
  command = plan

  variables {
    observability_enabled = true
  }

  assert {
    condition     = length(aws_cloudwatch_metric_alarm.alexa_skill_error_rate) == 0 && length(aws_sns_topic.alexa_alarms) == 0 && length(aws_cloudwatch_metric_alarm.alexa_delivery_failures) == 0
    error_message = "Alexa monitoring exists only with the skill."
  }
}
