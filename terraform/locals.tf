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

  # API routes served by the tenner-api Lambda.
  api_routes = [
    "GET /health",
    "POST /tenners",                            # TICKET-009
    "GET /tenners",                             # TICKET-010
    "PUT /tenners/{tennerId}",                  # TICKET-011
    "DELETE /tenners/{tennerId}",               # TICKET-012 (soft delete)
    "POST /tenners/{tennerId}/complete",        # TICKET-013
    "POST /tenners/{tennerId}/undo-completion", # TICKET-014
    "POST /tenners/{tennerId}/restore",         # TICKET-015
    "GET /dashboard",                           # TICKET-016
    "GET /tenners/{tennerId}",                  # TICKET-019
    "GET /history",                             # TICKET-020
    "GET /tenners/{tennerId}/history",          # TICKET-020
    "GET /onboarding",                          # HOTFIX-001 (signed in, no household needed)
    "POST /onboarding/assignment",              # HOTFIX-001
    "GET /household",                           # SCHEDULING-008
    "PUT /household",                           # SCHEDULING-008
    "GET /analytics/summary",                   # ANALYTICS-001
    "GET /analytics/trends",                    # ANALYTICS-002
    "POST /tenners/{tennerId}/snooze",          # SCHEDULING-003
    "POST /tenners/{tennerId}/skip",            # SCHEDULING-004
    "POST /tenners/{tennerId}/pause",           # SCHEDULING-005
    "POST /tenners/{tennerId}/resume",          # SCHEDULING-005
    "PUT /household/vacation",                  # SCHEDULING-005
    "DELETE /household/vacation",               # SCHEDULING-005
    "GET /users",                               # HOUSEHOLD-ADMIN-001
    "POST /users",                              # HOUSEHOLD-ADMIN-001
    "PUT /users/{userId}",                      # HOUSEHOLD-ADMIN-001
    "POST /users/{userId}/deactivate",          # HOUSEHOLD-ADMIN-004
    "POST /users/{userId}/reactivate",          # HOUSEHOLD-ADMIN-004
    "POST /users/{userId}/handover",            # HOUSEHOLD-004
    "DELETE /users/{userId}/handover",          # HOUSEHOLD-004
    "GET /categories",                          # HOUSEHOLD-ADMIN-002
    "POST /categories",                         # HOUSEHOLD-ADMIN-002
    "PUT /categories/{categoryId}",             # HOUSEHOLD-ADMIN-002
  ]

  # Routes reachable without a token (SECURITY-002). Everything else requires a Cognito JWT.
  api_public_routes = ["GET /health"]

  # Authentication (SECURITY-002, ADR 0001). The Cognito domain prefix must be unique per region;
  # a hash of the account ID keeps it stable without exposing the account ID in the login URL.
  auth_user_pool_name     = "${local.name_prefix}-users-${var.environment}"
  auth_client_name        = "${local.name_prefix}-web-${var.environment}"
  auth_domain_prefix      = "${local.name_prefix}-${var.environment}-${substr(sha1(data.aws_caller_identity.current.account_id), 0, 8)}"
  auth_login_domain       = "${local.auth_domain_prefix}.auth.${var.aws_region}.amazoncognito.com"
  auth_callback_path      = "/auth/callback"
  auth_token_minutes      = 60
  auth_refresh_token_days = 30

  # Google sign-in and household membership (FUTURE-011). A user belongs to the household through exactly one
  # Cognito group "household:<tenantId>:<userId>"; the group arrives in the ID token as cognito:groups.
  auth_identity_provider = "Google"
  auth_google_scopes     = "openid email profile"
  household_tenant_id    = "default"
  household_members      = ["STEFAN", "JULIA"]
  household_groups       = { for member in local.household_members : member => "household:${local.household_tenant_id}:${member}" }

  # Cost monitoring (OPERATIONS-001): 50 % and 80 % of actual spend, 100 % of forecasted spend.
  cost_budget_name               = "${local.name_prefix}-monthly-${var.environment}"
  cost_anomaly_monitor_name      = "${local.name_prefix}-services-${var.environment}"
  cost_anomaly_subscription_name = "${local.name_prefix}-anomalies-${var.environment}"
  cost_budget_alerts = [
    { percent = 50, type = "ACTUAL" },
    { percent = 80, type = "ACTUAL" },
    { percent = 100, type = "FORECASTED" },
  ]
  cost_anomaly_monitor_arn = var.cost_anomaly_monitor_arn != "" ? var.cost_anomaly_monitor_arn : aws_ce_anomaly_monitor.services[0].arn

  # Lambda bundle built by `npm run build` in backend/ (dist/index.mjs).
  api_source_dir  = "${path.module}/../backend/dist"
  api_package_zip = "${path.module}/../.build/tenner-api.zip"

  # Persistence layer (TICKET-006).
  tenners_table_name = "${local.name_prefix}-tenners"
  history_table_name = "${local.name_prefix}-history"
  # Household settings, one item per tenant (SCHEDULING-008; extended by HOUSEHOLD-ADMIN-003).
  households_table_name = "${local.name_prefix}-households"

  # Frontend hosting (TICKET-017).
  frontend_bucket_name       = "${local.name_prefix}-frontend-${var.environment}"
  frontend_distribution_name = "${local.name_prefix}-cloudfront"
  # AWS managed CloudFront cache policies (global, stable IDs; avoids data-source lookups).
  cache_policy_caching_optimized = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  cache_policy_caching_disabled  = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"

  # Every taggable resource must end up with these tags (TICKET-001A).
  # Enforced in CI by scripts/check_tags.py against the Terraform plan.
  mandatory_tag_keys = concat(keys(local.common_tags), ["Name", "Purpose", "Description"])
}
