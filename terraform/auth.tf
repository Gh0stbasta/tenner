# Authentication (SECURITY-002, ADR docs/decisions/0001-authentication.md):
# Cognito User Pool with one account per household member, managed login with PKCE,
# and a JWT authorizer on the HTTP API.

resource "aws_cognito_user_pool" "users" {
  name                = local.auth_user_pool_name
  user_pool_tier      = "ESSENTIALS" # free up to 10,000 MAU; includes managed login
  deletion_protection = "ACTIVE"

  # E-mail is the username; no self sign-up, accounts are created by an administrator.
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

  # Identity used by the backend (SECURITY-004). Changing this schema replaces the pool: keep it stable.
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
  supported_identity_providers         = ["COGNITO"]
  explicit_auth_flows                  = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]

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

  # The app may read the identity attributes but never write them: only administrators set
  # custom:tenantId and custom:userId (an unset write list would allow writing every attribute).
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

# Validates the Cognito ID token (audience = app client, ADR 0001) on protected routes.
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.api.id
  name             = "${local.name_prefix}-cognito"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    issuer   = "https://${aws_cognito_user_pool.users.endpoint}"
    audience = [aws_cognito_user_pool_client.web.id]
  }
}
