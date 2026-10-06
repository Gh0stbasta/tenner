# Notifier (NOTIFICATION-001): a scheduled Lambda that sends reminders through pluggable channels, deduplicated by
# the delivery log tenner-notifications. Created only when var.notifications_enabled is true (deploy role needs the
# notifier permissions first). The bundle is built by `npm run build` in backend/ (dist-notifier/index.mjs).

data "archive_file" "notifier" {
  count = var.notifications_enabled ? 1 : 0

  type        = "zip"
  source_dir  = local.notifier_source_dir
  output_path = local.notifier_package_zip
}

resource "aws_dynamodb_table" "notifications" {
  count = var.notifications_enabled ? 1 : 0

  name         = local.notifications_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "notificationKey"

  attribute {
    name = "notificationKey"
    type = "S"
  }

  # Delivery records expire after 90 days (expiresAt, epoch seconds).
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  server_side_encryption {
    enabled = true
  }

  # A delivery log only: losing it can cause at most one duplicate reminder, so no point-in-time recovery.
  point_in_time_recovery {
    enabled = false
  }

  deletion_protection_enabled = true

  tags = {
    Name        = local.notifications_table_name
    Purpose     = "Notification delivery log."
    Description = "Deduplicates and records notification deliveries."
  }
}

resource "aws_cloudwatch_log_group" "notifier" {
  count = var.notifications_enabled ? 1 : 0

  name              = local.notifier_log_group_name
  retention_in_days = var.log_retention_days

  tags = {
    Name        = local.notifier_log_group_name
    Purpose     = "Application logging."
    Description = "Stores logs of the Tenner notifier."
  }
}

resource "aws_iam_role" "notifier" {
  count = var.notifications_enabled ? 1 : 0

  name               = local.notifier_role_name
  assume_role_policy = data.aws_iam_policy_document.api_assume_role.json

  tags = {
    Name        = local.notifier_role_name
    Purpose     = "Lambda execution permissions."
    Description = "Provides runtime access for the Tenner notifier."
  }
}

# Least privilege: logs, read the household item, read/write the delivery log. Content jobs add their reads.
data "aws_iam_policy_document" "notifier" {
  count = var.notifications_enabled ? 1 : 0

  statement {
    sid       = "WriteNotifierLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.notifier[0].arn}:log-stream:*"]
  }

  statement {
    sid       = "ReadHousehold"
    actions   = ["dynamodb:GetItem"]
    resources = [aws_dynamodb_table.households.arn]
  }

  # Daily digest / overdue alerts (NOTIFICATION-003/004): the dashboard read model queries the Tenner table.
  statement {
    sid       = "ReadTenners"
    actions   = ["dynamodb:GetItem", "dynamodb:Query"]
    resources = [aws_dynamodb_table.tenners.arn, "${aws_dynamodb_table.tenners.arn}/index/*"]
  }

  # ALEXA-007/008: LWA client of the skill (exact parameters only; aws/ssm needs no KMS statement) and removal of
  # Alexa accounts Amazon no longer accepts (household item update).
  dynamic "statement" {
    for_each = local.alexa_notifier_enabled ? [1] : []
    content {
      sid     = "ReadAlexaLwaClient"
      actions = ["ssm:GetParameter"]
      resources = [
        "${local.secret_parameter_arn_prefix}/alexa/lwa-client-id",
        "${local.secret_parameter_arn_prefix}/alexa/lwa-client-secret",
      ]
    }
  }

  dynamic "statement" {
    for_each = local.alexa_notifier_enabled ? [1] : []
    content {
      sid       = "UpdateAlexaTargets"
      actions   = ["dynamodb:UpdateItem"]
      resources = [aws_dynamodb_table.households.arn]
    }
  }

  statement {
    sid       = "DeliveryLog"
    actions   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.notifications[0].arn]
  }
}

resource "aws_iam_role_policy" "notifier" {
  count = var.notifications_enabled ? 1 : 0

  name   = local.notifier_role_name
  role   = aws_iam_role.notifier[0].id
  policy = data.aws_iam_policy_document.notifier[0].json
}

resource "aws_lambda_function" "notifier" {
  count = var.notifications_enabled ? 1 : 0

  function_name    = local.notifier_function_name
  role             = aws_iam_role.notifier[0].arn
  runtime          = local.api_runtime
  architectures    = [local.api_architecture]
  handler          = "index.handler"
  memory_size      = local.api_memory_mb
  timeout          = local.notifier_timeout_seconds
  filename         = data.archive_file.notifier[0].output_path
  source_code_hash = data.archive_file.notifier[0].output_base64sha256

  # No reserved concurrency (accounts with the default limit of 10 cannot reserve any, TD-014); overlapping runs
  # are harmless because every delivery claims its key first.

  environment {
    variables = {
      ENVIRONMENT          = var.environment
      LOG_LEVEL            = var.notifier_log_level
      APPLICATION_NAME     = local.common_tags.Application
      TENNERS_TABLE        = aws_dynamodb_table.tenners.name
      HISTORY_TABLE        = aws_dynamodb_table.history.name
      HOUSEHOLDS_TABLE     = aws_dynamodb_table.households.name
      NOTIFICATIONS_TABLE  = aws_dynamodb_table.notifications[0].name
      APPLICATION_TIMEZONE = var.application_timezone
      HOUSEHOLD_TENANT_ID  = local.household_tenant_id
      APP_URL              = "https://${aws_cloudfront_distribution.frontend.domain_name}" # deep links (NOTIFICATION-003)
      # ALEXA-007/008: Alexa APIs; only parameter names, the values stay in Parameter Store.
      ALEXA_API_ENDPOINT                = local.alexa_notifier_enabled ? local.alexa_api_endpoint : ""
      ALEXA_LWA_CLIENT_ID_PARAMETER     = local.alexa_notifier_enabled ? local.alexa_lwa_client_id_parameter : ""
      ALEXA_LWA_CLIENT_SECRET_PARAMETER = local.alexa_notifier_enabled ? local.alexa_lwa_client_secret_parameter : ""
      ALEXA_SKILL_STAGE                 = "development"
    }
  }

  logging_config {
    log_format = "JSON"
    log_group  = aws_cloudwatch_log_group.notifier[0].name
  }

  tags = {
    Name        = local.notifier_function_name
    Purpose     = "Tenner notifier runtime."
    Description = "Sends scheduled Tenner notifications."
  }

  depends_on = [aws_iam_role_policy.notifier]
}

# EventBridge schedule rule (allowed service) instead of EventBridge Scheduler: no extra invocation role needed.
resource "aws_cloudwatch_event_rule" "notifier" {
  count = var.notifications_enabled ? 1 : 0

  name                = "${local.notifier_function_name}-schedule"
  description         = "Runs the Tenner notifier every 15 minutes."
  schedule_expression = local.notifier_schedule

  tags = {
    Name        = "${local.notifier_function_name}-schedule"
    Purpose     = "Notification scheduling."
    Description = "Triggers the Tenner notifier."
  }
}

resource "aws_cloudwatch_event_target" "notifier" {
  count = var.notifications_enabled ? 1 : 0

  rule = aws_cloudwatch_event_rule.notifier[0].name
  arn  = aws_lambda_function.notifier[0].arn
}

resource "aws_lambda_permission" "notifier_schedule" {
  count = var.notifications_enabled ? 1 : 0

  statement_id  = "AllowNotifierSchedule"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.notifier[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.notifier[0].arn
}

# ALEXA-007: household changes from the API refresh the Echo Show widget through the notifier.
resource "aws_cloudwatch_event_rule" "household_changed" {
  count = local.alexa_notifier_enabled ? 1 : 0

  name           = "${local.name_prefix}-household-changed"
  description    = "Household writes from the Tenner API (refreshes the Echo Show widget)."
  event_bus_name = local.household_events_bus
  event_pattern  = jsonencode({ source = ["tenner.api"], "detail-type" = ["HouseholdChanged"] })

  tags = {
    Name        = "${local.name_prefix}-household-changed"
    Purpose     = "Widget refresh trigger."
    Description = "Routes household change events to the notifier."
  }
}

resource "aws_cloudwatch_event_target" "household_changed" {
  count = local.alexa_notifier_enabled ? 1 : 0

  rule = aws_cloudwatch_event_rule.household_changed[0].name
  arn  = aws_lambda_function.notifier[0].arn
}

resource "aws_lambda_permission" "notifier_household_changed" {
  count = local.alexa_notifier_enabled ? 1 : 0

  statement_id  = "AllowHouseholdChangedEvents"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.notifier[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.household_changed[0].arn
}

# The API publishes the events (ALEXA-007).
data "aws_iam_policy_document" "api_events" {
  count = local.alexa_notifier_enabled ? 1 : 0

  statement {
    sid       = "PublishHouseholdChanged"
    actions   = ["events:PutEvents"]
    resources = ["arn:aws:events:${var.aws_region}:${data.aws_caller_identity.current.account_id}:event-bus/${local.household_events_bus}"]
  }
}

resource "aws_iam_role_policy" "api_events" {
  count = local.alexa_notifier_enabled ? 1 : 0

  name   = "${local.api_role_name}-events"
  role   = aws_iam_role.api.id
  policy = data.aws_iam_policy_document.api_events[0].json
}
