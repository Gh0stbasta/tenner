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
