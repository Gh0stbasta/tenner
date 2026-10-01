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
    CostCenter  = var.cost_center
  }

  # API runtime (TICKET-005).
  api_function_name   = "${local.name_prefix}-api"
  api_role_name       = "${local.name_prefix}-api-role"
  api_gateway_name    = "${local.name_prefix}-api-gateway"
  api_log_group_name  = "/${local.name_prefix}/api"
  api_access_log_name = "/${local.name_prefix}/api/access"
  api_runtime         = "nodejs22.x"
  api_architecture    = "arm64"
  api_memory_mb       = 256
  api_timeout_seconds = 10

  # Lambda bundle built by `npm run build` in backend/ (dist/index.mjs).
  api_source_dir  = "${path.module}/../backend/dist"
  api_package_zip = "${path.module}/../.build/tenner-api.zip"

  # Every taggable resource must end up with these tags (TICKET-001A).
  # Enforced in CI by scripts/check_tags.py against the Terraform plan.
  mandatory_tag_keys = concat(keys(local.common_tags), ["Name", "Purpose", "Description"])
}
