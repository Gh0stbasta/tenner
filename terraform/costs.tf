# Cost monitoring (OPERATIONS-001, ADR docs/decisions/0003-cost-monitoring.md).
# Billing features without runtime cost: a monthly AWS Budget with e-mail alerts and Cost Anomaly Detection
# with a daily summary. The alert address comes from the GitHub secret BUDGET_ALERT_EMAIL (never committed).

resource "aws_budgets_budget" "monthly" {
  name         = local.cost_budget_name
  budget_type  = "COST"
  limit_amount = format("%.2f", var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Default: the whole account, so no Tenner cost can be missed. Filtering by the Application tag only works
  # after the tag is activated as a cost allocation tag in the billing console (README → "Cost Monitoring").
  dynamic "cost_filter" {
    for_each = var.budget_filter_by_application_tag ? [1] : []
    content {
      name   = "TagKeyValue"
      values = [format("user:Application$%s", local.common_tags.Application)] # "user:<key>$<value>"
    }
  }

  dynamic "notification" {
    for_each = local.cost_budget_alerts
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value.percent
      threshold_type             = "PERCENTAGE"
      notification_type          = notification.value.type
      subscriber_email_addresses = [var.budget_alert_email]
    }
  }

  tags = {
    Name        = local.cost_budget_name
    Purpose     = "Cost monitoring."
    Description = "Monthly cost budget with e-mail alerts for Tenner."
  }
}

# One AWS-services monitor per account is allowed. If the account already has one (e.g. the default monitor AWS
# creates for new accounts), set var.cost_anomaly_monitor_arn to reuse it instead of creating a second one.
resource "aws_ce_anomaly_monitor" "services" {
  count = var.cost_anomaly_monitor_arn == "" ? 1 : 0

  name              = local.cost_anomaly_monitor_name
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"

  tags = {
    Name        = local.cost_anomaly_monitor_name
    Purpose     = "Cost monitoring."
    Description = "Detects unusual spend per AWS service."
  }
}

resource "aws_ce_anomaly_subscription" "daily" {
  name             = local.cost_anomaly_subscription_name
  frequency        = "DAILY"
  monitor_arn_list = [local.cost_anomaly_monitor_arn]

  subscriber {
    type    = "EMAIL"
    address = var.budget_alert_email
  }

  # Report anomalies with at least this total impact (USD); smaller ones are noise at near-zero spend.
  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      match_options = ["GREATER_THAN_OR_EQUAL"]
      values        = [format("%.2f", var.anomaly_alert_threshold_usd)]
    }
  }

  tags = {
    Name        = local.cost_anomaly_subscription_name
    Purpose     = "Cost monitoring."
    Description = "Daily e-mail summary of cost anomalies."
  }
}
