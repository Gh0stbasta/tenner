locals {
  # Naming standard: tenner-<resource>. No random names or generated suffixes
  # unless a resource type technically requires them.
  name_prefix = "tenner"

  # Name of the AWS Resource Group that collects all Tenner resources.
  resource_group_name = "Tenner"

  # Remote state (TICKET-003). Must match the literals in backend.tf.
  state_bucket_name                       = "${local.name_prefix}-terraform-state"
  state_lock_table_name                   = "${local.name_prefix}-terraform-locks"
  state_noncurrent_version_retention_days = 90
  state_noncurrent_versions_to_keep       = 10

  # Mandatory tags applied to every resource through provider default_tags.
  # Name, Purpose and Description are set per resource.
  common_tags = {
    Application = "Tenner"
    Project     = "Tenner"
    Owner       = "Stefan Schmidpeter"
    Environment = var.environment
    CreatedBy   = "GitHub Actions"
    ManagedBy   = "Terraform"
    Repository  = "Gh0stbasta/tenner"
  }
}
