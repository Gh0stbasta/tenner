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
    "POST /tenners",                                        # TICKET-009
    "GET /tenners",                                         # TICKET-010
    "PUT /tenners/{tennerId}",                              # TICKET-011
    "DELETE /tenners/{tennerId}",                           # TICKET-012 (soft delete)
    "POST /tenners/{tennerId}/complete",                    # TICKET-013
    "POST /tenners/{tennerId}/undo-completion",             # TICKET-014
    "POST /tenners/{tennerId}/restore",                     # TICKET-015
    "GET /dashboard",                                       # TICKET-016
    "GET /tenners/{tennerId}",                              # TICKET-019
    "GET /history",                                         # TICKET-020
    "GET /tenners/{tennerId}/history",                      # TICKET-020
    "GET /onboarding",                                      # HOTFIX-001 (signed in, no household needed)
    "POST /onboarding/assignment",                          # HOTFIX-001
    "GET /household",                                       # SCHEDULING-008
    "PUT /household",                                       # SCHEDULING-008
    "GET /analytics/summary",                               # ANALYTICS-001
    "GET /analytics/trends",                                # ANALYTICS-002
    "GET /analytics/users",                                 # ANALYTICS-003
    "GET /analytics/categories",                            # ANALYTICS-004
    "GET /analytics/neglected",                             # ANALYTICS-006
    "GET /analytics/balance",                               # ANALYTICS-007
    "GET /analytics/time",                                  # ANALYTICS-005
    "GET /analytics/habits",                                # ANALYTICS-008
    "GET /analytics/habits/{tennerId}",                     # ANALYTICS-008
    "POST /tenners/{tennerId}/snooze",                      # SCHEDULING-003
    "POST /tenners/{tennerId}/skip",                        # SCHEDULING-004
    "POST /tenners/{tennerId}/pause",                       # SCHEDULING-005
    "POST /tenners/{tennerId}/resume",                      # SCHEDULING-005
    "PUT /household/vacation",                              # SCHEDULING-005
    "DELETE /household/vacation",                           # SCHEDULING-005
    "POST /household/catalog",                              # DATA-008
    "GET /users",                                           # HOUSEHOLD-ADMIN-001
    "POST /users",                                          # HOUSEHOLD-ADMIN-001
    "PUT /users/{userId}",                                  # HOUSEHOLD-ADMIN-001
    "POST /users/{userId}/deactivate",                      # HOUSEHOLD-ADMIN-004
    "POST /users/{userId}/reactivate",                      # HOUSEHOLD-ADMIN-004
    "POST /users/{userId}/handover",                        # HOUSEHOLD-004
    "DELETE /users/{userId}/handover",                      # HOUSEHOLD-004
    "GET /categories",                                      # HOUSEHOLD-ADMIN-002
    "POST /categories",                                     # HOUSEHOLD-ADMIN-002
    "GET /users/{userId}/notification-preferences",         # NOTIFICATION-002
    "PUT /users/{userId}/notification-preferences",         # NOTIFICATION-002
    "PUT /users/{userId}/push-subscription",                # NOTIFICATION-009
    "DELETE /users/{userId}/push-subscription",             # NOTIFICATION-009
    "POST /push-actions",                                   # NOTIFICATION-011 (public, signed token)
    "GET /household/alexa",                                 # ALEXA-002
    "PUT /household/alexa-speakers/{personId}",             # ALEXA-002
    "DELETE /household/alexa-speakers/{personId}",          # ALEXA-002
    "PUT /household/alexa-users/{alexaUserId}",             # ALEXA-007
    "PUT /categories/{categoryId}",                         # HOUSEHOLD-ADMIN-002
    "GET /meals/ingredients",                               # FOOD-021
    "POST /meals/ingredients",                              # FOOD-021
    "PUT /meals/ingredients/{ingredientId}",                # FOOD-021
    "GET /meals/dishes",                                    # FOOD-002
    "POST /meals/dishes",                                   # FOOD-002
    "GET /meals/dishes/{dishId}",                           # FOOD-002
    "PUT /meals/dishes/{dishId}",                           # FOOD-002
    "DELETE /meals/dishes/{dishId}",                        # FOOD-002 (archive)
    "POST /meals/dishes/{dishId}/restore",                  # FOOD-002
    "GET /meals/profile",                                   # FOOD-004
    "PUT /meals/profile",                                   # FOOD-004
    "POST /meals/catalog",                                  # FOOD-003
    "GET /meals/plans/{weekStart}",                         # FOOD-006
    "POST /meals/plans/{weekStart}/slots/{slotId}/replace", # FOOD-007
  ]

  # Routes reachable without a token (SECURITY-002). Everything else requires a Cognito JWT.
  # POST /push-actions (NOTIFICATION-011) is authorized by the signed token in the body instead of a login.
  api_public_routes = ["GET /health", "POST /push-actions"]

  # Authentication (SECURITY-002, ADR 0001). The Cognito domain prefix must be unique per region;
  # a hash of the account ID keeps it stable without exposing the account ID in the login URL.
  auth_user_pool_name     = "${local.name_prefix}-users-${var.environment}"
  auth_client_name        = "${local.name_prefix}-web-${var.environment}"
  auth_domain_prefix      = "${local.name_prefix}-${var.environment}-${substr(sha1(data.aws_caller_identity.current.account_id), 0, 8)}"
  auth_login_domain       = "${local.auth_domain_prefix}.auth.${var.aws_region}.amazoncognito.com"
  auth_callback_path      = "/auth/callback"
  auth_token_minutes      = 60
  auth_refresh_token_days = 30

  # Alexa account linking (ALEXA-002): own app client with a secret; Alexa refreshes the access token itself,
  # so the refresh token lives up to the Cognito maximum and the household never has to relink.
  alexa_auth_enabled            = local.alexa_enabled && length(var.alexa_redirect_urls) > 0
  alexa_auth_client_name        = "${local.name_prefix}-alexa-${var.environment}"
  alexa_auth_resource_server    = "tenner"
  alexa_auth_scope              = "household"
  alexa_auth_refresh_token_days = 3650

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

  # Notifier (NOTIFICATION-001): scheduled Lambda separate from the API, delivery log with 90-day TTL.
  notifier_function_name   = "${local.name_prefix}-notifier"
  notifier_role_name       = "${local.name_prefix}-notifier-role"
  notifier_log_group_name  = "/${local.name_prefix}/notifier"
  notifier_source_dir      = "${path.module}/../backend/dist-notifier"
  notifier_package_zip     = "${path.module}/../.build/tenner-notifier.zip"
  notifier_timeout_seconds = 60
  notifier_schedule        = "rate(15 minutes)"
  notifications_table_name = "${local.name_prefix}-notifications"

  # Runtime secrets (SECURITY-006, ADR 0004): SSM SecureString parameters below this prefix. Terraform knows only
  # the names (IAM, Lambda configuration); values are set out of band so they never enter the state.
  secret_parameter_prefix     = "/${local.name_prefix}/${var.environment}"
  secret_parameter_arn_prefix = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${local.secret_parameter_prefix}"

  # Alexa skill Lambda (ALEXA-001, ADR 0005). Created only once the skill exists (var.alexa_skill_id set).
  alexa_enabled              = var.alexa_skill_id != ""
  alexa_function_name        = "${local.name_prefix}-alexa-skill"
  alexa_role_name            = "${local.name_prefix}-alexa-skill-role"
  alexa_log_group_name       = "/${local.name_prefix}/alexa-skill"
  alexa_source_dir           = "${path.module}/../alexa/dist"
  alexa_package_zip          = "${path.module}/../.build/tenner-alexa-skill.zip"
  alexa_runtime              = "nodejs22.x"
  alexa_architecture         = "arm64"
  alexa_memory_mb            = 256
  alexa_timeout_seconds      = 7 # Alexa waits at most 8 seconds for a response.
  alexa_invocation_principal = "alexa-appkit.amazon.com"

  # Echo Show widget and Alexa notifications (ALEXA-007/008): need the skill and the notifier. The LWA client of the
  # skill (developer console → Permissions) lives in Parameter Store (SECURITY-006), set out of band.
  alexa_notifier_enabled            = local.alexa_enabled && var.notifications_enabled
  alexa_api_endpoint                = "https://api.eu.amazonalexa.com"
  alexa_lwa_client_id_parameter     = "${local.secret_parameter_prefix}/alexa/lwa-client-id"
  alexa_lwa_client_secret_parameter = "${local.secret_parameter_prefix}/alexa/lwa-client-secret"

  # NOTIFICATION-009: browser push needs the notifier and a VAPID key pair (public key as variable, private key in SSM).
  web_push_enabled               = var.notifications_enabled && var.web_push_public_key != ""
  web_push_private_key_parameter = "${local.secret_parameter_prefix}/push/vapid-private-key"
  # NOTIFICATION-011: HMAC secret of the action links (notifier signs, API verifies).
  push_action_secret_parameter = "${local.secret_parameter_prefix}/push/action-secret"
  household_events_bus         = "default"

  # Persistence layer (TICKET-006).
  tenners_table_name = "${local.name_prefix}-tenners"
  history_table_name = "${local.name_prefix}-history"
  # Household settings, one item per tenant (SCHEDULING-008; extended by HOUSEHOLD-ADMIN-003).
  households_table_name = "${local.name_prefix}-households"
  # Meal planning (FOOD-001, ADR 0007): dishes, ingredients, profile, plans and shopping lists per tenant.
  meals_table_name = "${local.name_prefix}-meals"

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
