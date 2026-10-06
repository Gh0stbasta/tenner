# Observability (OBSERVABILITY-001): one CloudWatch dashboard tenner-<environment> with the health of every
# component. Widgets for optional components (notifier, Alexa skill) appear when those are enabled.
# Created only when var.observability_enabled is true (deploy role needs cloudwatch:PutDashboard first).

locals {
  dashboard_name = "${local.name_prefix}-${var.environment}"

  # Lambda functions on the dashboard: [function name, region].
  dashboard_functions = concat(
    [[local.api_function_name, var.aws_region]],
    var.notifications_enabled ? [[local.notifier_function_name, var.aws_region]] : [],
    local.alexa_enabled ? [[local.alexa_function_name, var.alexa_region]] : [],
  )

  dashboard_tables = concat(
    [local.tenners_table_name, local.history_table_name, local.households_table_name],
    var.notifications_enabled ? [local.notifications_table_name] : [],
  )

  api_dimensions = ["ApiId", aws_apigatewayv2_api.api.id, "Stage", aws_apigatewayv2_stage.api.name]

  dashboard_widgets = concat(
    [
      {
        type       = "text", x = 0, y = 0, width = 24, height = 1
        properties = { markdown = "# Tenner ${var.environment} — API, Lambda, DynamoDB, CloudFront (runbooks: docs/runbooks/)" }
      },
      {
        type = "metric", x = 0, y = 1, width = 12, height = 6
        properties = {
          title  = "API Gateway: requests and errors"
          region = var.aws_region
          stat   = "Sum"
          period = 300
          metrics = [
            concat(["AWS/ApiGateway", "Count"], local.api_dimensions),
            concat(["AWS/ApiGateway", "4xx"], local.api_dimensions),
            concat(["AWS/ApiGateway", "5xx"], local.api_dimensions),
          ]
        }
      },
      {
        type = "metric", x = 12, y = 1, width = 12, height = 6
        properties = {
          title  = "API Gateway: latency (ms)"
          region = var.aws_region
          period = 300
          metrics = [
            concat(["AWS/ApiGateway", "Latency"], local.api_dimensions, [{ stat = "p50", label = "p50" }]),
            concat(["AWS/ApiGateway", "Latency"], local.api_dimensions, [{ stat = "p95", label = "p95" }]),
          ]
        }
      },
    ],
    [for index, function in local.dashboard_functions : {
      type = "metric", x = (index % 2) * 12, y = 7 + floor(index / 2) * 6, width = 12, height = 6
      properties = {
        title  = "Lambda ${function[0]}"
        region = function[1]
        period = 300
        metrics = [
          ["AWS/Lambda", "Invocations", "FunctionName", function[0], { stat = "Sum" }],
          ["AWS/Lambda", "Errors", "FunctionName", function[0], { stat = "Sum" }],
          ["AWS/Lambda", "Throttles", "FunctionName", function[0], { stat = "Sum" }],
          ["AWS/Lambda", "ConcurrentExecutions", "FunctionName", function[0], { stat = "Maximum" }],
          ["AWS/Lambda", "Duration", "FunctionName", function[0], { stat = "p95", yAxis = "right", label = "Duration p95 (ms)" }],
        ]
      }
    }],
    [
      {
        type = "metric", x = 0, y = 25, width = 12, height = 6
        properties = {
          title   = "DynamoDB: consumed capacity"
          region  = var.aws_region
          stat    = "Sum"
          period  = 300
          metrics = flatten([for table in local.dashboard_tables : [["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", table], ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", table]]])
        }
      },
      {
        type = "metric", x = 12, y = 25, width = 12, height = 6
        properties = {
          title   = "DynamoDB: throttles and system errors"
          region  = var.aws_region
          stat    = "Sum"
          period  = 300
          metrics = flatten([for table in local.dashboard_tables : [["AWS/DynamoDB", "ThrottledRequests", "TableName", table], ["AWS/DynamoDB", "SystemErrors", "TableName", table]]])
        }
      },
      {
        type = "metric", x = 0, y = 37, width = 24, height = 6
        properties = {
          title  = "CloudFront (us-east-1 metrics)"
          region = "us-east-1"
          period = 300
          metrics = [
            ["AWS/CloudFront", "Requests", "DistributionId", aws_cloudfront_distribution.frontend.id, "Region", "Global", { stat = "Sum" }],
            ["AWS/CloudFront", "4xxErrorRate", "DistributionId", aws_cloudfront_distribution.frontend.id, "Region", "Global", { stat = "Average", yAxis = "right" }],
            ["AWS/CloudFront", "5xxErrorRate", "DistributionId", aws_cloudfront_distribution.frontend.id, "Region", "Global", { stat = "Average", yAxis = "right" }],
          ]
        }
      },
    ],
    # ALEXA-009: Alexa section — outcomes from the skill log (eu-west-1) and delivery failures (notifier).
    [for widget in [
      {
        type = "metric", x = 0, y = 31, width = 12, height = 6
        properties = {
          title   = "Alexa skill: requests and errors (eu-west-1)"
          region  = var.alexa_region
          stat    = "Sum"
          period  = 300
          metrics = [[local.alexa_metrics_namespace, "SkillRequests"], [local.alexa_metrics_namespace, "SkillRequestErrors"]]
        }
      },
      {
        type = "log", x = 12, y = 31, width = 12, height = 6
        properties = {
          title  = "Alexa skill: requests per intent and outcome"
          region = var.alexa_region
          view   = "table"
          query  = "SOURCE '${local.alexa_log_group_name}' | filter event = \"skill_request\" | stats count(*) as requests, pct(durationMs, 95) as p95ms by intent, outcome | sort requests desc"
        }
      },
    ] : widget if local.alexa_enabled],
    [for widget in [
      {
        type = "metric", x = 0, y = 43, width = 24, height = 6
        properties = {
          title   = "Alexa deliveries: widget push and notification failures"
          region  = var.aws_region
          stat    = "Sum"
          period  = 3600
          metrics = [[local.alexa_metrics_namespace, "WidgetPushFailures"], [local.alexa_metrics_namespace, "AlexaNotificationFailures"]]
        }
      },
    ] : widget if local.alexa_notifier_enabled],
  )
}

resource "aws_cloudwatch_dashboard" "tenner" {
  count = var.observability_enabled ? 1 : 0

  dashboard_name = local.dashboard_name
  dashboard_body = jsonencode({ widgets = local.dashboard_widgets })
}
