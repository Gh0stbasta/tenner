# API runtime: Lambda + API Gateway HTTP API (TICKET-005).
# The Lambda bundle must be built first: `npm ci && npm run build` in backend/.

data "archive_file" "api" {
  type        = "zip"
  source_dir  = local.api_source_dir
  output_path = local.api_package_zip
}

resource "aws_lambda_function" "api" {
  function_name    = local.api_function_name
  role             = aws_iam_role.api.arn
  runtime          = local.api_runtime
  architectures    = [local.api_architecture]
  handler          = "index.handler"
  memory_size      = local.api_memory_mb
  timeout          = local.api_timeout_seconds
  filename         = data.archive_file.api.output_path
  source_code_hash = data.archive_file.api.output_base64sha256

  environment {
    variables = {
      ENVIRONMENT          = var.environment
      LOG_LEVEL            = var.api_log_level
      APPLICATION_NAME     = local.common_tags.Application
      TENNERS_TABLE        = aws_dynamodb_table.tenners.name
      HISTORY_TABLE        = aws_dynamodb_table.history.name
      HOUSEHOLDS_TABLE     = aws_dynamodb_table.households.name # SCHEDULING-008
      MEALS_TABLE          = aws_dynamodb_table.meals.name      # FOOD-001
      APPLICATION_TIMEZONE = var.application_timezone
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.users.id # HOTFIX-001 self-assignment
      HOUSEHOLD_TENANT_ID  = local.household_tenant_id
      ALEXA_CLIENT_ID      = local.alexa_auth_enabled ? aws_cognito_user_pool_client.alexa[0].id : "" # ALEXA-002 audit channel
      HOUSEHOLD_EVENTS_BUS = local.alexa_notifier_enabled ? local.household_events_bus : ""           # ALEXA-007 widget refresh
      # NOTIFICATION-011: verifies the push action links (parameter name only).
      PUSH_ACTION_HMAC_PARAMETER = local.web_push_enabled ? local.push_action_secret_parameter : ""
    }
  }

  logging_config {
    log_format = "JSON"
    log_group  = aws_cloudwatch_log_group.api.name
  }

  tags = {
    Name        = local.api_function_name
    Purpose     = "Tenner backend API runtime."
    Description = "Processes all Tenner API requests."
  }

  depends_on = [aws_iam_role_policy.api_logging, aws_iam_role_policy.api_dynamodb]
}

resource "aws_apigatewayv2_api" "api" {
  name          = local.api_gateway_name
  protocol_type = "HTTP"
  description   = "Public HTTP API for Tenner."

  # Central CORS configuration (TICKET-017): only the frontend origin, no wildcard.
  cors_configuration {
    allow_origins  = ["https://${aws_cloudfront_distribution.frontend.domain_name}"]
    allow_methods  = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers  = ["content-type", "idempotency-key", "x-correlation-id", "authorization"]
    expose_headers = ["x-correlation-id"]
    max_age        = 300
  }

  tags = {
    Name        = local.api_gateway_name
    Purpose     = "Public API endpoint for Tenner."
    Description = "Routes HTTP requests to backend services."
  }
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

# Explicit routes only (no $default catch-all). Add new endpoints to local.api_routes.
resource "aws_apigatewayv2_route" "api" {
  for_each = toset(local.api_routes)

  api_id    = aws_apigatewayv2_api.api.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"

  # Cognito JWT on every route except the public ones (SECURITY-002). CORS preflight (OPTIONS)
  # is answered by API Gateway before authorization.
  authorization_type = contains(local.api_public_routes, each.value) ? "NONE" : "JWT"
  authorizer_id      = contains(local.api_public_routes, each.value) ? null : aws_apigatewayv2_authorizer.cognito.id
}

moved {
  from = aws_apigatewayv2_route.health
  to   = aws_apigatewayv2_route.api["GET /health"]
}

resource "aws_apigatewayv2_stage" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = var.environment
  auto_deploy = true

  # Cost cap for the public API (SECURITY-014). Throttled requests get HTTP 429 from
  # API Gateway and never invoke Lambda or DynamoDB. Limits are global, not per client.
  default_route_settings {
    throttling_burst_limit = var.api_throttling_burst_limit
    throttling_rate_limit  = var.api_throttling_rate_limit
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_access.arn
    format = jsonencode({
      requestId          = "$context.requestId"
      requestTime        = "$context.requestTime"
      httpMethod         = "$context.httpMethod"
      routeKey           = "$context.routeKey"
      path               = "$context.path"
      status             = "$context.status"
      responseLength     = "$context.responseLength"
      integrationLatency = "$context.integrationLatency"
      latency            = "$context.responseLatency"
      sourceIp           = "$context.identity.sourceIp"
      userAgent          = "$context.identity.userAgent"
      integrationError   = "$context.integrationErrorMessage"
    })
  }

  tags = {
    Name        = "${local.api_gateway_name}-${var.environment}"
    Purpose     = "API deployment stage."
    Description = "Auto-deployed ${var.environment} stage of the Tenner HTTP API."
  }
}

# Allow only this API to invoke the function.
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowInvokeFromTennerHttpApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
