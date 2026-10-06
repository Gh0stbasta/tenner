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
}
