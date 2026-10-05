# Offline tests for cost monitoring (OPERATIONS-001).

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
  override_during = plan

  mock_data "aws_region" {
    defaults = {
      region = "eu-central-1"
    }
  }

  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "123456789012"
    }
  }

  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }

  mock_resource "aws_cloudfront_distribution" {
    defaults = {
      domain_name = "d111111abcdef8.cloudfront.net"
      arn         = "arn:aws:cloudfront::000000000000:distribution/E123"
    }
  }

  mock_resource "aws_cognito_user_pool" {
    defaults = {
      id       = "eu-central-1_TEST"
      endpoint = "cognito-idp.eu-central-1.amazonaws.com/eu-central-1_TEST"
    }
  }

  mock_resource "aws_cognito_user_pool_client" {
    defaults = {
      id = "testclientid"
    }
  }

  mock_resource "aws_apigatewayv2_authorizer" {
    defaults = {
      id = "auth123"
    }
  }
}

run "budget_alerts_at_50_80_and_forecast_100" {
  command = plan

  assert {
    condition     = aws_budgets_budget.monthly.limit_amount == "5.00" && aws_budgets_budget.monthly.time_unit == "MONTHLY" && aws_budgets_budget.monthly.budget_type == "COST"
    error_message = "The default budget must be 5 USD per month."
  }

  assert {
    condition     = toset([for n in aws_budgets_budget.monthly.notification : "${n.threshold}-${n.notification_type}"]) == toset(["50-ACTUAL", "80-ACTUAL", "100-FORECASTED"])
    error_message = "Alerts must fire at 50 % and 80 % actual and 100 % forecasted spend."
  }

  assert {
    condition     = alltrue([for n in aws_budgets_budget.monthly.notification : n.subscriber_email_addresses == toset(["owner@example.com"])])
    error_message = "Every alert must go to var.budget_alert_email."
  }

  assert {
    condition     = length(aws_budgets_budget.monthly.cost_filter) == 0
    error_message = "By default the budget covers the whole account (no tag filter)."
  }
}

run "budget_can_be_limited_to_the_application_tag" {
  command = plan

  variables {
    budget_filter_by_application_tag = true
    monthly_budget_usd               = 2.5
  }

  assert {
    condition     = one(aws_budgets_budget.monthly.cost_filter).values == tolist(["user:Application$Tenner"]) && aws_budgets_budget.monthly.limit_amount == "2.50"
    error_message = "The tag filter must select Application = Tenner."
  }
}

run "anomaly_detection_sends_a_daily_summary" {
  command = plan

  assert {
    condition     = length(aws_ce_anomaly_monitor.services) == 1 && aws_ce_anomaly_monitor.services[0].monitor_dimension == "SERVICE"
    error_message = "Terraform must create an AWS-services anomaly monitor by default."
  }

  assert {
    condition     = aws_ce_anomaly_subscription.daily.frequency == "DAILY" && one(aws_ce_anomaly_subscription.daily.subscriber).address == "owner@example.com"
    error_message = "Anomalies must be e-mailed daily to the owner."
  }

  assert {
    condition     = one(one(aws_ce_anomaly_subscription.daily.threshold_expression).dimension).values == toset(["1.00"])
    error_message = "Only anomalies with at least 1 USD impact are reported."
  }
}

run "an_existing_anomaly_monitor_can_be_reused" {
  command = plan

  variables {
    cost_anomaly_monitor_arn = "arn:aws:ce::123456789012:anomalymonitor/abc-123"
  }

  assert {
    condition     = length(aws_ce_anomaly_monitor.services) == 0 && aws_ce_anomaly_subscription.daily.monitor_arn_list == tolist(["arn:aws:ce::123456789012:anomalymonitor/abc-123"])
    error_message = "With cost_anomaly_monitor_arn set, no second monitor may be created."
  }
}

run "alert_email_is_required" {
  command = plan

  variables {
    budget_alert_email = ""
  }

  expect_failures = [var.budget_alert_email]
}

run "invalid_budget_rejected" {
  command = plan

  variables {
    monthly_budget_usd = 0
  }

  expect_failures = [var.monthly_budget_usd]
}
