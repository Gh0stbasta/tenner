# Offline tests for the secret naming (SECURITY-006, ADR 0004).

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

# Alexa skill region (ALEXA-001): mocked like the default provider.
mock_provider "aws" {
  alias = "alexa"
}


run "secret_names_follow_the_standard" {
  command = plan

  assert {
    condition     = output.secret_parameter_prefix == "/tenner/prod"
    error_message = "Secrets must live below /tenner/<environment>."
  }

  assert {
    condition     = local.secret_parameter_arn_prefix == "arn:aws:ssm:eu-central-1:123456789012:parameter/tenner/prod"
    error_message = "IAM must be able to grant exact parameter ARNs below the prefix."
  }
}

