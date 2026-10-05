# Offline tests for authentication (SECURITY-002, ADR 0001).

# Placeholder Google OAuth client (FUTURE-011); the real values come from GitHub in CI.
variables {
  google_client_id     = "123456789012-abcdefghijklmnop.apps.googleusercontent.com"
  google_client_secret = "placeholder-secret"
  budget_alert_email   = "owner@example.com"
}


mock_provider "archive" {
  mock_data "archive_file" {
    defaults = {
      output_path         = "tenner-api.zip"
      output_base64sha256 = "bW9jaw=="
    }
  }
}

mock_provider "aws" {
  override_during = plan

  mock_data "aws_region" {
    defaults = {
      region = "eu-central-1"
    }
  }

  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "123456789012"
    }
  }

  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }

  mock_resource "aws_cloudfront_distribution" {
    defaults = {
      domain_name = "d111111abcdef8.cloudfront.net"
      arn         = "arn:aws:cloudfront::000000000000:distribution/E123"
    }
  }

  mock_resource "aws_cognito_user_pool" {
    defaults = {
      id       = "eu-central-1_TEST"
      endpoint = "cognito-idp.eu-central-1.amazonaws.com/eu-central-1_TEST"
    }
  }

  mock_resource "aws_cognito_user_pool_client" {
    defaults = {
      id = "testclientid"
    }
  }

  mock_resource "aws_apigatewayv2_authorizer" {
    defaults = {
      id = "auth123"
    }
  }
}

run "user_pool_is_admin_only_with_email_login" {
  command = plan

  assert {
    condition     = aws_cognito_user_pool.users.admin_create_user_config[0].allow_admin_create_user_only
    error_message = "Self sign-up must be disabled."
  }

  assert {
    condition     = aws_cognito_user_pool.users.username_attributes == toset(["email"]) && aws_cognito_user_pool.users.user_pool_tier == "ESSENTIALS"
    error_message = "E-mail must be the username and the pool must use the Essentials tier."
  }

  assert {
    condition     = aws_cognito_user_pool.users.password_policy[0].minimum_length >= 12 && aws_cognito_user_pool.users.deletion_protection == "ACTIVE"
    error_message = "Password policy (>= 12 characters) and deletion protection are required."
  }

  assert {
    condition = alltrue([
      for attribute in aws_cognito_user_pool.users.schema : attribute.mutable == false if attribute.name == "tenantId"
    ]) && length([for attribute in aws_cognito_user_pool.users.schema : attribute if contains(["tenantId", "userId"], attribute.name)]) == 2
    error_message = "custom:tenantId (immutable) and custom:userId must exist."
  }
}

run "app_client_is_public_pkce_and_cannot_write_identity" {
  command = plan

  assert {
    condition     = aws_cognito_user_pool_client.web.generate_secret == false && aws_cognito_user_pool_client.web.allowed_oauth_flows == toset(["code"])
    error_message = "The SPA client must be public and use the authorization code flow."
  }

  assert {
    condition     = aws_cognito_user_pool_client.web.write_attributes == toset(["email"])
    error_message = "The app client must not be able to write custom:tenantId or custom:userId."
  }

  assert {
    condition     = aws_cognito_user_pool_client.web.callback_urls == toset(["https://d111111abcdef8.cloudfront.net/auth/callback"])
    error_message = "The callback URL must be the CloudFront domain."
  }

  assert {
    condition     = aws_cognito_user_pool_client.web.refresh_token_validity == 30 && aws_cognito_user_pool_client.web.id_token_validity == 60
    error_message = "Token lifetimes must be 60 minutes and 30 days (refresh)."
  }
}

run "login_domain_is_stable_and_hides_the_account" {
  command = plan

  assert {
    condition     = aws_cognito_user_pool_domain.login.domain == "tenner-prod-${substr(sha1("123456789012"), 0, 8)}" && !strcontains(aws_cognito_user_pool_domain.login.domain, "123456789012")
    error_message = "The domain prefix must be derived from a hash of the account ID."
  }

  assert {
    condition     = aws_cognito_user_pool_domain.login.managed_login_version == 2
    error_message = "Managed login (version 2) must be used."
  }
}

run "routes_require_jwt_except_health" {
  command = plan

  assert {
    condition     = aws_apigatewayv2_route.api["GET /health"].authorization_type == "NONE"
    error_message = "GET /health must stay public."
  }

  assert {
    condition = alltrue([
      for key, route in aws_apigatewayv2_route.api : route.authorization_type == "JWT" && route.authorizer_id == "auth123" if key != "GET /health"
    ])
    error_message = "All other routes must use the Cognito JWT authorizer."
  }

  assert {
    condition     = aws_apigatewayv2_route.api["POST /onboarding/assignment"].authorization_type == "JWT" && aws_apigatewayv2_route.api["GET /onboarding"].authorization_type == "JWT"
    error_message = "Onboarding routes (HOTFIX-001) must require a signed-in user."
  }

  assert {
    condition     = aws_apigatewayv2_authorizer.cognito.jwt_configuration[0].issuer == "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_TEST"
    error_message = "The authorizer issuer must be the user pool."
  }

  assert {
    condition     = aws_apigatewayv2_authorizer.cognito.jwt_configuration[0].audience == toset(["testclientid"])
    error_message = "The authorizer audience must be the app client."
  }
}

run "csp_allows_cognito_endpoints" {
  command = plan

  assert {
    condition = strcontains(
      aws_cloudfront_response_headers_policy.frontend.security_headers_config[0].content_security_policy[0].content_security_policy,
      "https://cognito-idp.eu-central-1.amazonaws.com https://tenner-prod-${substr(sha1("123456789012"), 0, 8)}.auth.eu-central-1.amazoncognito.com",
    )
    error_message = "connect-src must allow the Cognito discovery and token endpoints."
  }
}

run "sign_in_is_google_only" {
  command = plan

  assert {
    condition     = aws_cognito_user_pool_client.web.supported_identity_providers == toset(["Google"])
    error_message = "The app client must offer Google only (no password login)."
  }

  assert {
    condition     = aws_cognito_user_pool_client.web.explicit_auth_flows == toset(["ALLOW_REFRESH_TOKEN_AUTH"])
    error_message = "Password-based auth flows (SRP, USER_PASSWORD) must be disabled."
  }

  assert {
    condition     = aws_cognito_identity_provider.google.provider_type == "Google" && aws_cognito_identity_provider.google.provider_details["authorize_scopes"] == "openid email profile"
    error_message = "Google must be configured with the openid, email and profile scopes."
  }

  assert {
    condition     = aws_cognito_identity_provider.google.provider_details["client_id"] == "123456789012-abcdefghijklmnop.apps.googleusercontent.com"
    error_message = "The Google client ID must come from var.google_client_id."
  }

  assert {
    condition     = aws_cognito_identity_provider.google.attribute_mapping == tomap({ email = "email", username = "sub" })
    error_message = "Only the e-mail may be mapped from Google (username = Google subject)."
  }

  assert {
    condition     = output.cognito_google_redirect_uri == "https://tenner-prod-${substr(sha1("123456789012"), 0, 8)}.auth.eu-central-1.amazoncognito.com/oauth2/idpresponse"
    error_message = "The Google redirect URI output must point to the Cognito domain."
  }
}

run "household_groups_exist" {
  command = plan

  assert {
    condition     = toset([for group in aws_cognito_user_group.household : group.name]) == toset(["household:default:STEFAN", "household:default:JULIA"])
    error_message = "There must be one household group per member (household:<tenantId>:<userId>)."
  }
}

run "google_client_id_is_validated" {
  command = plan

  variables {
    google_client_id = "not-a-google-client"
  }

  expect_failures = [var.google_client_id]
}

run "google_client_secret_is_required" {
  command = plan

  variables {
    google_client_secret = "  "
  }

  expect_failures = [var.google_client_secret]
}
