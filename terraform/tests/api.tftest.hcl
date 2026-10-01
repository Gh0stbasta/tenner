# Offline tests for the API runtime (TICKET-005).

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
      ENVIRONMENT      = "prod"
      LOG_LEVEL        = "INFO"
      APPLICATION_NAME = "Tenner"
      TENNERS_TABLE    = "tenner-tenners"
      HISTORY_TABLE    = "tenner-history"
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
    condition     = toset(keys(aws_apigatewayv2_route.api)) == toset(["GET /health", "POST /tenners", "GET /tenners", "PUT /tenners/{tennerId}", "DELETE /tenners/{tennerId}"])
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
