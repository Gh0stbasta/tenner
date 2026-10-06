# Offline tests for the API runtime (TICKET-005).

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

run "lambda_matches_runtime_requirements" {
  command = plan

  assert {
    condition     = aws_lambda_function.api.function_name == "tenner-api"
    error_message = "Lambda must be named tenner-api."
  }

  assert {
    condition     = aws_lambda_function.api.runtime == "nodejs22.x" && aws_lambda_function.api.architectures == tolist(["arm64"])
    error_message = "Lambda must run Node.js 22 on arm64."
  }

  assert {
    condition     = aws_lambda_function.api.memory_size == 256 && aws_lambda_function.api.timeout == 10
    error_message = "Lambda must use 256 MB memory and a 10 second timeout."
  }

  assert {
    condition = aws_lambda_function.api.environment[0].variables == tomap({
      ENVIRONMENT          = "prod"
      LOG_LEVEL            = "INFO"
      APPLICATION_NAME     = "Tenner"
      TENNERS_TABLE        = "tenner-tenners"
      HISTORY_TABLE        = "tenner-history"
      HOUSEHOLDS_TABLE     = "tenner-households"
      APPLICATION_TIMEZONE = "Europe/Berlin"
      COGNITO_USER_POOL_ID = "eu-central-1_TEST"
      HOUSEHOLD_TENANT_ID  = "default"
      ALEXA_CLIENT_ID      = ""
    })
    error_message = "Lambda environment variables do not match the specification."
  }

  assert {
    condition     = aws_lambda_function.api.logging_config[0].log_group == "/tenner/api"
    error_message = "Lambda must log to /tenner/api."
  }
}

run "http_api_routes_health" {
  command = plan

  assert {
    condition     = aws_apigatewayv2_api.api.name == "tenner-api-gateway" && aws_apigatewayv2_api.api.protocol_type == "HTTP"
    error_message = "API must be an HTTP API named tenner-api-gateway."
  }

  assert {
    condition     = toset(keys(aws_apigatewayv2_route.api)) == toset(["GET /health", "POST /tenners", "GET /tenners", "PUT /tenners/{tennerId}", "DELETE /tenners/{tennerId}", "POST /tenners/{tennerId}/complete", "POST /tenners/{tennerId}/undo-completion", "POST /tenners/{tennerId}/restore", "GET /dashboard", "GET /tenners/{tennerId}", "GET /history", "GET /tenners/{tennerId}/history", "GET /onboarding", "POST /onboarding/assignment", "GET /household", "PUT /household", "POST /tenners/{tennerId}/snooze", "POST /tenners/{tennerId}/skip", "POST /tenners/{tennerId}/pause", "POST /tenners/{tennerId}/resume", "PUT /household/vacation", "DELETE /household/vacation", "GET /users", "POST /users", "PUT /users/{userId}", "POST /users/{userId}/deactivate", "POST /users/{userId}/reactivate", "POST /users/{userId}/handover", "DELETE /users/{userId}/handover", "GET /categories", "POST /categories", "PUT /categories/{categoryId}", "GET /analytics/summary", "GET /analytics/trends", "GET /analytics/users", "GET /analytics/categories", "GET /analytics/neglected", "GET /analytics/balance", "GET /analytics/time", "GET /analytics/habits", "GET /analytics/habits/{tennerId}", "GET /users/{userId}/notification-preferences", "PUT /users/{userId}/notification-preferences", "GET /household/alexa", "PUT /household/alexa-speakers/{personId}", "DELETE /household/alexa-speakers/{personId}"])
    error_message = "API routes must match the implemented endpoints."
  }

  assert {
    condition     = aws_apigatewayv2_stage.api.name == "prod" && aws_apigatewayv2_stage.api.auto_deploy
    error_message = "Stage must be prod with auto deploy."
  }

  assert {
    condition     = aws_apigatewayv2_integration.api.payload_format_version == "2.0"
    error_message = "Integration must use payload format 2.0."
  }

  assert {
    condition     = length(aws_apigatewayv2_stage.api.access_log_settings) == 1
    error_message = "API access logging must be enabled."
  }
}

run "logs_are_retained_30_days_by_default" {
  command = plan

  assert {
    condition     = aws_cloudwatch_log_group.api.retention_in_days == 30 && aws_cloudwatch_log_group.api_access.retention_in_days == 30
    error_message = "Log retention must default to 30 days."
  }
}

run "log_retention_is_configurable" {
  command = plan

  variables {
    log_retention_days = 14
  }

  assert {
    condition     = aws_cloudwatch_log_group.api.retention_in_days == 14
    error_message = "log_retention_days must control log retention."
  }
}

run "invalid_timezone_rejected" {
  command = plan

  variables {
    application_timezone = "berlin"
  }

  expect_failures = [var.application_timezone]
}

run "invalid_log_retention_rejected" {
  command = plan

  variables {
    log_retention_days = 31
  }

  expect_failures = [var.log_retention_days]
}

run "role_trusts_only_lambda" {
  command = plan

  assert {
    condition     = aws_iam_role.api.name == "tenner-api-role"
    error_message = "Role must be named tenner-api-role."
  }
}

# SECURITY-014: stage throttling caps the cost of the public API.
run "stage_is_throttled_by_default" {
  command = plan

  assert {
    condition     = aws_apigatewayv2_stage.api.default_route_settings[0].throttling_burst_limit == 20 && aws_apigatewayv2_stage.api.default_route_settings[0].throttling_rate_limit == 10
    error_message = "HTTP API stage must throttle at burst 20 and 10 requests per second by default."
  }
}

run "throttling_is_configurable" {
  command = plan

  variables {
    api_throttling_burst_limit = 50
    api_throttling_rate_limit  = 25
  }

  assert {
    condition     = aws_apigatewayv2_stage.api.default_route_settings[0].throttling_burst_limit == 50 && aws_apigatewayv2_stage.api.default_route_settings[0].throttling_rate_limit == 25
    error_message = "Throttling limits must follow the variables."
  }
}

run "invalid_burst_limit_rejected" {
  command = plan

  variables {
    api_throttling_burst_limit = 0
  }

  expect_failures = [var.api_throttling_burst_limit]
}

run "fractional_burst_limit_rejected" {
  command = plan

  variables {
    api_throttling_burst_limit = 2.5
  }

  expect_failures = [var.api_throttling_burst_limit]
}

run "invalid_rate_limit_rejected" {
  command = plan

  variables {
    api_throttling_rate_limit = 0
  }

  expect_failures = [var.api_throttling_rate_limit]
}

run "lambda_environment_contains_no_secrets" {
  command = plan

  assert {
    condition = alltrue([
      for name in keys(aws_lambda_function.api.environment[0].variables) : length(regexall("(?i)secret|password|token|key", name)) == 0
    ])
    error_message = "Lambda environment variables must not carry secrets (SECURITY-005)."
  }

  assert {
    condition     = aws_lambda_function.api.runtime == "nodejs22.x"
    error_message = "The Lambda runtime must be a supported Node.js version."
  }
}
