# Authentication (SECURITY-002, ADR docs/decisions/0001-authentication.md):
# Cognito User Pool with one account per household member, managed login with PKCE,
# and a JWT authorizer on the HTTP API.
# Sign-in is through Google only (FUTURE-011, ADR docs/decisions/0002-google-sign-in.md); household
# membership comes from Cognito groups.

resource "aws_cognito_user_pool" "users" {
  name                = local.auth_user_pool_name
  user_pool_tier      = "ESSENTIALS" # free up to 10,000 MAU; includes managed login
  deletion_protection = "ACTIVE"

  # E-mail is the username. Password self sign-up stays disabled; Google users are created by Cognito on
  # their first sign-in (FUTURE-011) and have no household access until an administrator adds them to a group.
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Identity attributes of SECURITY-004. Unused since FUTURE-011 (groups instead), but removing a schema
  # attribute replaces the pool and deletes all accounts: keep the schema stable.
  schema {
    name                     = "tenantId"
    attribute_data_type      = "String"
    mutable                  = false
    developer_only_attribute = false
    required                 = false

    string_attribute_constraints {
      min_length = 1
      max_length = 64
    }
  }

  schema {
    name                     = "userId"
    attribute_data_type      = "String"
    mutable                  = true
    developer_only_attribute = false
    required                 = false

    string_attribute_constraints {
      min_length = 1
      max_length = 64
    }
  }

  tags = {
    Name        = local.auth_user_pool_name
    Purpose     = "Household member accounts."
    Description = "Cognito user pool for logging in to Tenner."
  }
}

# Public SPA client: no secret, Authorization Code flow with PKCE.
resource "aws_cognito_user_pool_client" "web" {
  name         = local.auth_client_name
  user_pool_id = aws_cognito_user_pool.users.id

  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email"]
  supported_identity_providers         = [aws_cognito_identity_provider.google.provider_name] # Google only, no passwords
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH"]

  callback_urls = ["https://${aws_cloudfront_distribution.frontend.domain_name}${local.auth_callback_path}"]
  logout_urls   = ["https://${aws_cloudfront_distribution.frontend.domain_name}/"]

  access_token_validity  = local.auth_token_minutes
  id_token_validity      = local.auth_token_minutes
  refresh_token_validity = local.auth_refresh_token_days
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  enable_token_revocation       = true
  prevent_user_existence_errors = "ENABLED"

  # The app may never write identity attributes (an unset write list would allow writing every attribute).
  # "email" must stay writable: the Google attribute mapping writes it on every sign-in.
  read_attributes  = ["email", "email_verified", "custom:tenantId", "custom:userId"]
  write_attributes = ["email"]
}

resource "aws_cognito_user_pool_domain" "login" {
  domain                = local.auth_domain_prefix
  user_pool_id          = aws_cognito_user_pool.users.id
  managed_login_version = 2
}

# Default Cognito look for the managed login pages (required for managed login version 2).
resource "aws_cognito_managed_login_branding" "web" {
  user_pool_id                = aws_cognito_user_pool.users.id
  client_id                   = aws_cognito_user_pool_client.web.id
  use_cognito_provided_values = true
}

# Google as the only identity provider (FUTURE-011). Client ID and secret come from GitHub (TF_VAR_*);
# the secret is a sensitive variable and is stored only in the encrypted Terraform state.
resource "aws_cognito_identity_provider" "google" {
  user_pool_id  = aws_cognito_user_pool.users.id
  provider_name = local.auth_identity_provider
  provider_type = "Google"

  # The URL fields are the values Cognito sets for Google; listing them avoids a permanent plan diff.
  provider_details = {
    client_id                     = var.google_client_id
    client_secret                 = var.google_client_secret
    authorize_scopes              = local.auth_google_scopes
    attributes_url                = "https://people.googleapis.com/v1/people/me?personFields="
    attributes_url_add_attributes = "true"
    authorize_url                 = "https://accounts.google.com/o/oauth2/v2/auth"
    oidc_issuer                   = "https://accounts.google.com"
    token_request_method          = "POST"
    token_url                     = "https://www.googleapis.com/oauth2/v4/token"
  }

  # Only the e-mail is copied (it must be writable by the app client); the Google subject is the username.
  attribute_mapping = {
    email    = "email"
    username = "sub"
  }
}

# Household membership (FUTURE-011): one group per member, e.g. "household:default:STEFAN".
# Adding a user to a group is a manual administrator step (README → "User Accounts").
resource "aws_cognito_user_group" "household" {
  for_each = local.household_groups

  user_pool_id = aws_cognito_user_pool.users.id
  name         = each.value
  description  = "Tenner household ${local.household_tenant_id}, member ${each.key}."
}

# Alexa account linking (ALEXA-002, ADR 0005): a confidential client (Alexa keeps the secret server-side) with the
# authorization code grant and Google sign-in. Alexa sends the access token; it carries cognito:groups like the ID
# token, so the skill has exactly the linked member's rights. The secret is entered once in the Alexa developer
# console (alexa/README.md); it is never output or committed.
resource "aws_cognito_resource_server" "tenner" {
  count = local.alexa_auth_enabled ? 1 : 0

  user_pool_id = aws_cognito_user_pool.users.id
  identifier   = local.alexa_auth_resource_server
  name         = "Tenner API"

  scope {
    scope_name        = local.alexa_auth_scope
    scope_description = "Act as a member of the household."
  }
}

resource "aws_cognito_user_pool_client" "alexa" {
  count = local.alexa_auth_enabled ? 1 : 0

  name         = local.alexa_auth_client_name
  user_pool_id = aws_cognito_user_pool.users.id

  generate_secret                      = true
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "${aws_cognito_resource_server.tenner[0].identifier}/${local.alexa_auth_scope}"]
  supported_identity_providers         = [aws_cognito_identity_provider.google.provider_name]
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH"]

  callback_urls = var.alexa_redirect_urls

  access_token_validity  = local.auth_token_minutes
  id_token_validity      = local.auth_token_minutes
  refresh_token_validity = local.alexa_auth_refresh_token_days
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  enable_token_revocation       = true
  prevent_user_existence_errors = "ENABLED"

  read_attributes  = ["email", "email_verified"]
  write_attributes = ["email"]
}

resource "aws_cognito_managed_login_branding" "alexa" {
  count = local.alexa_auth_enabled ? 1 : 0

  user_pool_id                = aws_cognito_user_pool.users.id
  client_id                   = aws_cognito_user_pool_client.alexa[0].id
  use_cognito_provided_values = true
}

# Validates the Cognito ID token (audience = app client, ADR 0001) on protected routes.
# ALEXA-002: also the Alexa client's access tokens (HTTP API JWT authorizers match client_id when aud is absent).
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.api.id
  name             = "${local.name_prefix}-cognito"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    issuer   = "https://${aws_cognito_user_pool.users.endpoint}"
    audience = concat([aws_cognito_user_pool_client.web.id], aws_cognito_user_pool_client.alexa[*].id)
  }
}
