variable "aws_region" {
  description = "AWS region for all Tenner resources."
  type        = string
  default     = "eu-central-1"

  validation {
    condition     = can(regex("^[a-z]{2}(-[a-z]+)+-[0-9]$", var.aws_region))
    error_message = "aws_region must be a valid AWS region name, e.g. eu-central-1."
  }
}

variable "environment" {
  description = "Deployment environment. Used in the Environment tag."
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["prod", "dev"], var.environment)
    error_message = "environment must be one of: prod, dev."
  }
}

variable "cost_center" {
  description = "Value of the CostCenter tag, used for AWS cost allocation."
  type        = string
  default     = "Tenner"

  validation {
    condition     = length(trimspace(var.cost_center)) > 0
    error_message = "cost_center must not be empty."
  }
}

variable "log_retention_days" {
  description = "Retention in days for Tenner CloudWatch log groups."
  type        = number
  default     = 30

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653], var.log_retention_days)
    error_message = "log_retention_days must be a retention value supported by CloudWatch Logs."
  }
}

variable "api_log_level" {
  description = "LOG_LEVEL of the API Lambda."
  type        = string
  default     = "INFO"

  validation {
    condition     = contains(["DEBUG", "INFO", "WARN", "ERROR"], var.api_log_level)
    error_message = "api_log_level must be one of DEBUG, INFO, WARN, ERROR."
  }
}

variable "application_timezone" {
  description = "IANA timezone for calendar-date decisions in the API (e.g. dashboard reference date)."
  type        = string
  default     = "Europe/Berlin"

  validation {
    condition     = can(regex("^[A-Za-z]+(/[A-Za-z0-9_+-]+)+$", var.application_timezone)) || var.application_timezone == "UTC"
    error_message = "application_timezone must be an IANA timezone such as Europe/Berlin."
  }
}

variable "api_throttling_burst_limit" {
  description = "Maximum concurrent request burst for every route of the HTTP API stage (SECURITY-014)."
  type        = number
  default     = 20

  validation {
    condition     = var.api_throttling_burst_limit >= 1 && floor(var.api_throttling_burst_limit) == var.api_throttling_burst_limit
    error_message = "api_throttling_burst_limit must be a whole number of at least 1."
  }
}

variable "api_throttling_rate_limit" {
  description = "Steady-state requests per second for every route of the HTTP API stage (SECURITY-014)."
  type        = number
  default     = 10

  validation {
    condition     = var.api_throttling_rate_limit > 0
    error_message = "api_throttling_rate_limit must be greater than 0."
  }
}

variable "google_client_id" {
  description = "OAuth client ID of the Google Cloud project used for Google sign-in (FUTURE-011). Set as GitHub variable GOOGLE_CLIENT_ID."
  type        = string

  validation {
    condition     = can(regex("^[0-9]+-[a-z0-9]+\\.apps\\.googleusercontent\\.com$", var.google_client_id))
    error_message = "google_client_id must be a Google OAuth client ID (<number>-<id>.apps.googleusercontent.com). Set the GitHub variable GOOGLE_CLIENT_ID."
  }
}

variable "google_client_secret" {
  description = "OAuth client secret for Google sign-in (FUTURE-011). Set as GitHub secret GOOGLE_CLIENT_SECRET; never commit it."
  type        = string
  sensitive   = true

  validation {
    condition     = length(trimspace(var.google_client_secret)) > 0
    error_message = "google_client_secret must not be empty. Set the GitHub secret GOOGLE_CLIENT_SECRET."
  }
}

variable "budget_alert_email" {
  description = "E-mail address for budget and cost anomaly alerts (OPERATIONS-001). Set as GitHub secret BUDGET_ALERT_EMAIL; never commit it."
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.budget_alert_email))
    error_message = "budget_alert_email must be an e-mail address. Set the GitHub secret BUDGET_ALERT_EMAIL."
  }
}

variable "monthly_budget_usd" {
  description = "Monthly cost budget in USD (OPERATIONS-001)."
  type        = number
  default     = 5

  validation {
    condition     = var.monthly_budget_usd > 0
    error_message = "monthly_budget_usd must be greater than 0."
  }
}

variable "anomaly_alert_threshold_usd" {
  description = "Minimum total impact in USD for a cost anomaly to be e-mailed (OPERATIONS-001)."
  type        = number
  default     = 1

  validation {
    condition     = var.anomaly_alert_threshold_usd > 0
    error_message = "anomaly_alert_threshold_usd must be greater than 0."
  }
}

variable "budget_filter_by_application_tag" {
  description = "Limit the budget to resources tagged Application = Tenner. Requires the tag to be activated as a cost allocation tag; otherwise the budget sees no cost. Default: whole account."
  type        = bool
  default     = false
}

variable "cost_anomaly_monitor_arn" {
  description = "ARN of an existing AWS-services cost anomaly monitor to reuse (only one per account is allowed). Empty: Terraform creates one. Set as GitHub variable COST_ANOMALY_MONITOR_ARN if needed."
  type        = string
  default     = ""

  validation {
    condition     = var.cost_anomaly_monitor_arn == "" || can(regex("^arn:aws:ce::[0-9]{12}:anomalymonitor/", var.cost_anomaly_monitor_arn))
    error_message = "cost_anomaly_monitor_arn must be empty or a Cost Explorer anomaly monitor ARN."
  }
}
