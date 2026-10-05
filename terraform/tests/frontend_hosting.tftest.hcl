# Offline tests for frontend hosting (TICKET-017).

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

  mock_resource "aws_s3_bucket" {
    defaults = {
      arn                         = "arn:aws:s3:::tenner-frontend-prod"
      bucket_regional_domain_name = "tenner-frontend-prod.s3.eu-central-1.amazonaws.com"
    }
  }
}

run "bucket_is_private_and_versioned" {
  command = plan

  assert {
    condition     = aws_s3_bucket.frontend.bucket == "tenner-frontend-prod"
    error_message = "Bucket must be named tenner-frontend-<environment>."
  }

  assert {
    condition = alltrue([
      aws_s3_bucket_public_access_block.frontend.block_public_acls,
      aws_s3_bucket_public_access_block.frontend.block_public_policy,
      aws_s3_bucket_public_access_block.frontend.ignore_public_acls,
      aws_s3_bucket_public_access_block.frontend.restrict_public_buckets,
    ])
    error_message = "All public access must be blocked."
  }

  assert {
    condition     = aws_s3_bucket_versioning.frontend.versioning_configuration[0].status == "Enabled"
    error_message = "Versioning must be enabled."
  }

  assert {
    condition     = aws_s3_bucket_ownership_controls.frontend.rule[0].object_ownership == "BucketOwnerEnforced"
    error_message = "ACLs must be disabled."
  }
}

run "bucket_policy_allows_only_this_distribution" {
  command = plan

  assert {
    condition     = one(data.aws_iam_policy_document.frontend_bucket.statement[0].principals).identifiers == toset(["cloudfront.amazonaws.com"])
    error_message = "Only CloudFront may read the bucket."
  }

  assert {
    condition     = one(data.aws_iam_policy_document.frontend_bucket.statement[0].condition).values == tolist(["arn:aws:cloudfront::000000000000:distribution/E123"])
    error_message = "Read access must be limited to this distribution (AWS:SourceArn)."
  }
}

run "distribution_serves_spa_securely" {
  command = plan

  assert {
    condition     = aws_cloudfront_origin_access_control.frontend.signing_behavior == "always" && aws_cloudfront_origin_access_control.frontend.origin_access_control_origin_type == "s3"
    error_message = "S3 origin must use Origin Access Control."
  }

  assert {
    condition     = aws_cloudfront_distribution.frontend.default_root_object == "index.html" && aws_cloudfront_distribution.frontend.price_class == "PriceClass_100"
    error_message = "Default root object index.html and PriceClass_100 required."
  }

  assert {
    condition     = aws_cloudfront_distribution.frontend.default_cache_behavior[0].viewer_protocol_policy == "redirect-to-https"
    error_message = "HTTP must redirect to HTTPS."
  }

  assert {
    condition = toset([for r in aws_cloudfront_distribution.frontend.custom_error_response : "${r.error_code}:${r.response_code}:${r.response_page_path}"]) == toset([
      "403:200:/index.html",
      "404:200:/index.html",
    ])
    error_message = "SPA routes must fall back to index.html."
  }

  assert {
    condition     = aws_cloudfront_distribution.frontend.ordered_cache_behavior[0].path_pattern == "/assets/*" && aws_cloudfront_distribution.frontend.ordered_cache_behavior[0].cache_policy_id == "658327ea-f89d-4fab-a63d-7e88639e58f6"
    error_message = "Hashed assets must use the CachingOptimized policy."
  }

  assert {
    condition     = aws_cloudfront_distribution.frontend.default_cache_behavior[0].cache_policy_id == "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    error_message = "index.html must not be cached by CloudFront."
  }
}

run "security_headers_are_set" {
  command = plan

  assert {
    condition     = aws_cloudfront_response_headers_policy.frontend.security_headers_config[0].frame_options[0].frame_option == "DENY"
    error_message = "X-Frame-Options must be DENY."
  }

  assert {
    condition     = strcontains(aws_cloudfront_response_headers_policy.frontend.security_headers_config[0].content_security_policy[0].content_security_policy, "connect-src 'self' https://*.execute-api.eu-central-1.amazonaws.com")
    error_message = "CSP must allow the API Gateway origin."
  }
}

run "api_cors_allows_only_the_frontend_origin" {
  command = plan

  assert {
    condition     = aws_apigatewayv2_api.api.cors_configuration[0].allow_origins == toset(["https://d111111abcdef8.cloudfront.net"])
    error_message = "CORS must allow exactly the CloudFront origin."
  }

  assert {
    condition     = contains(aws_apigatewayv2_api.api.cors_configuration[0].allow_headers, "idempotency-key")
    error_message = "CORS must allow the Idempotency-Key header."
  }
}
