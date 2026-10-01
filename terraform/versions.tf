terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Remote state backend placeholder.
  # TICKET-003 adds the S3 backend (terraform/backend.tf) and migrates local state.
  # Until then Terraform uses local state. Strategy: docs/architecture.md, "State Management".
}
