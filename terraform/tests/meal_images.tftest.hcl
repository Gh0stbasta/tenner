# Offline tests for dish photos (FOOD-011): private image bucket, CloudFront origin, IAM prefix scope and CSP.

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
      arn                         = "arn:aws:s3:::tenner-meal-images-prod"
      bucket_regional_domain_name = "tenner-meal-images-prod.s3.eu-central-1.amazonaws.com"
    }
  }
}

# Alexa skill region (ALEXA-001): mocked like the default provider.
mock_provider "aws" {
  alias = "alexa"
}

run "image_bucket_is_private_encrypted_and_versioned" {
  command = plan

  assert {
    condition     = aws_s3_bucket.meal_images.bucket == "tenner-meal-images-prod"
    error_message = "Bucket must be named tenner-meal-images-<environment>."
  }

  assert {
    condition = alltrue([
      aws_s3_bucket_public_access_block.meal_images.block_public_acls,
      aws_s3_bucket_public_access_block.meal_images.block_public_policy,
      aws_s3_bucket_public_access_block.meal_images.ignore_public_acls,
      aws_s3_bucket_public_access_block.meal_images.restrict_public_buckets,
    ])
    error_message = "All public access must be blocked."
  }

  assert {
    condition     = one([for r in aws_s3_bucket_server_side_encryption_configuration.meal_images.rule : one(r.apply_server_side_encryption_by_default).sse_algorithm]) == "AES256"
    error_message = "Photos must be encrypted at rest."
  }

  assert {
    condition     = aws_s3_bucket_versioning.meal_images.versioning_configuration[0].status == "Enabled"
    error_message = "Versioning must be enabled."
  }

  assert {
    condition     = aws_s3_bucket_lifecycle_configuration.meal_images.rule[0].noncurrent_version_expiration[0].noncurrent_days == 30
    error_message = "Replaced photos must expire after 30 days."
  }

  assert {
    condition     = aws_s3_bucket_ownership_controls.meal_images.rule[0].object_ownership == "BucketOwnerEnforced"
    error_message = "ACLs must be disabled."
  }

  assert {
    condition     = aws_s3_bucket.meal_images.tags["Purpose"] != "" && aws_s3_bucket.meal_images.tags["Description"] != ""
    error_message = "The bucket needs Purpose and Description tags."
  }
}

run "only_the_distribution_reads_and_tls_is_required" {
  command = plan

  assert {
    condition     = data.aws_iam_policy_document.meal_images_bucket.statement[0].actions == toset(["s3:GetObject"])
    error_message = "CloudFront may only read objects."
  }

  assert {
    condition     = one(data.aws_iam_policy_document.meal_images_bucket.statement[0].principals).identifiers == toset(["cloudfront.amazonaws.com"])
    error_message = "Only CloudFront may read."
  }

  assert {
    condition     = one(data.aws_iam_policy_document.meal_images_bucket.statement[0].condition).values == tolist(["arn:aws:cloudfront::000000000000:distribution/E123"])
    error_message = "Reads must be limited to the Tenner distribution (SourceArn)."
  }

  assert {
    condition     = data.aws_iam_policy_document.meal_images_bucket.statement[1].effect == "Deny" && one(data.aws_iam_policy_document.meal_images_bucket.statement[1].condition).variable == "aws:SecureTransport"
    error_message = "Requests without TLS must be denied."
  }
}

run "distribution_serves_images_via_oac" {
  command = plan

  assert {
    condition = anytrue([
      for o in aws_cloudfront_distribution.frontend.origin :
      o.origin_id == "meal-images-s3" && o.domain_name == "tenner-meal-images-prod.s3.eu-central-1.amazonaws.com"
    ])
    error_message = "The image bucket must be a CloudFront origin (OAC is enforced by the bucket policy test)."
  }

  assert {
    condition = anytrue([
      for b in aws_cloudfront_distribution.frontend.ordered_cache_behavior :
      b.path_pattern == "/images/*" && b.target_origin_id == "meal-images-s3" && b.viewer_protocol_policy == "redirect-to-https" && toset(b.allowed_methods) == toset(["GET", "HEAD"])
    ])
    error_message = "/images/* must be read-only from the image origin over HTTPS."
  }
}

run "uploads_come_only_from_the_app" {
  command = plan

  assert {
    condition     = toset(one(aws_s3_bucket_cors_configuration.meal_images.cors_rule).allowed_methods) == toset(["PUT"])
    error_message = "CORS allows only the upload PUT."
  }

  assert {
    condition     = toset(one(aws_s3_bucket_cors_configuration.meal_images.cors_rule).allowed_origins) == toset(["https://d111111abcdef8.cloudfront.net"])
    error_message = "Only the web app origin may upload."
  }
}

run "api_role_writes_only_dish_photos" {
  command = plan

  assert {
    condition     = toset(data.aws_iam_policy_document.api_meal_images.statement[0].actions) == toset(["s3:PutObject", "s3:DeleteObject"])
    error_message = "The API may only put and delete photos (no read, no list)."
  }

  assert {
    condition     = toset(data.aws_iam_policy_document.api_meal_images.statement[0].resources) == toset(["arn:aws:s3:::tenner-meal-images-prod/images/meals/*"])
    error_message = "Photo writes must be limited to images/meals/ of the image bucket."
  }

  assert {
    condition     = aws_lambda_function.api.environment[0].variables["MEAL_IMAGES_BUCKET"] == "tenner-meal-images-prod"
    error_message = "The API must know the image bucket."
  }

  assert {
    condition     = contains(local.api_routes, "POST /meals/dishes/{dishId}/image-upload") && contains(local.api_routes, "PUT /meals/dishes/{dishId}/image") && contains(local.api_routes, "DELETE /meals/dishes/{dishId}/image")
    error_message = "The photo routes must be deployed."
  }
}

run "csp_allows_uploads_and_previews" {
  command = plan

  assert {
    condition     = strcontains(aws_cloudfront_response_headers_policy.frontend.security_headers_config[0].content_security_policy[0].content_security_policy, "img-src 'self' data: blob:")
    error_message = "img-src must allow blob: for the photo preview and nothing external."
  }

  assert {
    condition     = strcontains(aws_cloudfront_response_headers_policy.frontend.security_headers_config[0].content_security_policy[0].content_security_policy, "https://tenner-meal-images-prod.s3.eu-central-1.amazonaws.com;")
    error_message = "connect-src must allow the upload to the image bucket."
  }
}
