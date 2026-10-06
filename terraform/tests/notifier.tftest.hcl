# Offline tests for the notifier (NOTIFICATION-001).

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


run "no_notifier_by_default" {
  command = plan

  assert {
    condition     = length(aws_lambda_function.notifier) == 0 && length(aws_dynamodb_table.notifications) == 0 && length(aws_cloudwatch_event_rule.notifier) == 0
    error_message = "The notifier must stay off until notifications_enabled is set."
  }

  assert {
    condition     = output.notifier_function_name == ""
    error_message = "No notifier output while disabled."
  }
}

run "notifier_runs_every_15_minutes" {
  command = plan

  variables {
    notifications_enabled = true
  }

  assert {
    condition     = aws_cloudwatch_event_rule.notifier[0].schedule_expression == "rate(15 minutes)"
    error_message = "The notifier must run every 15 minutes."
  }

  assert {
    condition     = aws_lambda_permission.notifier_schedule[0].principal == "events.amazonaws.com"
    error_message = "Only EventBridge may invoke the notifier."
  }

  assert {
    condition     = aws_lambda_function.notifier[0].function_name == "tenner-notifier" && aws_lambda_function.notifier[0].runtime == "nodejs22.x" && aws_lambda_function.notifier[0].timeout == 60
    error_message = "Notifier must be tenner-notifier on Node.js 22 with a 60 s timeout."
  }

  assert {
    condition     = aws_lambda_function.notifier[0].environment[0].variables["NOTIFICATIONS_TABLE"] == "tenner-notifications" && aws_lambda_function.notifier[0].environment[0].variables["HOUSEHOLD_TENANT_ID"] == "default"
    error_message = "Notifier must know the delivery log table and the tenant."
  }
}

run "notifier_reads_tenners_for_the_digest" {
  command = plan

  variables {
    notifications_enabled = true
  }

  assert {
    condition     = contains(keys(aws_lambda_function.notifier[0].environment[0].variables), "APP_URL")
    error_message = "The notifier needs the web app URL for deep links."
  }
}

run "delivery_log_expires_after_ttl" {
  command = plan

  variables {
    notifications_enabled = true
  }

  assert {
    condition     = aws_dynamodb_table.notifications[0].hash_key == "notificationKey" && aws_dynamodb_table.notifications[0].ttl[0].attribute_name == "expiresAt" && aws_dynamodb_table.notifications[0].ttl[0].enabled
    error_message = "The delivery log must be keyed by notificationKey with TTL on expiresAt."
  }

  assert {
    condition     = aws_dynamodb_table.notifications[0].billing_mode == "PAY_PER_REQUEST" && aws_dynamodb_table.notifications[0].server_side_encryption[0].enabled
    error_message = "The delivery log must be on-demand and encrypted."
  }

  assert {
    condition     = aws_cloudwatch_log_group.notifier[0].retention_in_days == 30
    error_message = "Notifier logs must be kept 30 days."
  }
}

run "alexa_widget_wiring" {
  command = plan

  variables {
    notifications_enabled = true
    alexa_skill_id        = "amzn1.ask.skill.12345678-90ab-cdef-1234-567890abcdef"
  }

  assert {
    condition     = jsondecode(aws_cloudwatch_event_rule.household_changed[0].event_pattern) == { source = ["tenner.api"], "detail-type" = ["HouseholdChanged"] }
    error_message = "Household change events from the API must reach the notifier."
  }

  assert {
    condition     = aws_lambda_permission.notifier_household_changed[0].principal == "events.amazonaws.com" && aws_lambda_function.api.environment[0].variables["HOUSEHOLD_EVENTS_BUS"] == "default"
    error_message = "The API must publish to the default bus and EventBridge may invoke the notifier."
  }

  assert {
    condition     = aws_lambda_function.notifier[0].environment[0].variables["ALEXA_LWA_CLIENT_SECRET_PARAMETER"] == "/tenner/prod/alexa/lwa-client-secret" && aws_lambda_function.notifier[0].environment[0].variables["ALEXA_API_ENDPOINT"] == "https://api.eu.amazonalexa.com"
    error_message = "The notifier gets the parameter names (never values) and the EU Alexa API endpoint."
  }

  assert {
    condition     = length(aws_iam_role_policy.api_events) == 1
    error_message = "The API needs events:PutEvents when the widget is enabled."
  }
}

run "no_widget_wiring_without_skill" {
  command = plan

  variables {
    notifications_enabled = true
  }

  assert {
    condition     = length(aws_cloudwatch_event_rule.household_changed) == 0 && aws_lambda_function.notifier[0].environment[0].variables["ALEXA_API_ENDPOINT"] == "" && aws_lambda_function.api.environment[0].variables["HOUSEHOLD_EVENTS_BUS"] == ""
    error_message = "Without the skill there is no widget wiring."
  }
}
