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
