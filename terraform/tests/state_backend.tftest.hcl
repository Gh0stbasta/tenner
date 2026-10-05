# Offline tests for the remote state infrastructure (TICKET-003).

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
}

run "state_bucket_is_hardened" {
  command = plan

  assert {
    condition     = aws_s3_bucket.terraform_state.bucket == "tenner-terraform-state"
    error_message = "State bucket must be named tenner-terraform-state (must match backend.tf)."
  }

  assert {
    condition     = aws_s3_bucket_versioning.terraform_state.versioning_configuration[0].status == "Enabled"
    error_message = "State bucket versioning must be enabled."
  }

  assert {
    condition     = one(aws_s3_bucket_server_side_encryption_configuration.terraform_state.rule).apply_server_side_encryption_by_default[0].sse_algorithm == "AES256"
    error_message = "State bucket must use server-side encryption."
  }

  assert {
    condition = alltrue([
      aws_s3_bucket_public_access_block.terraform_state.block_public_acls,
      aws_s3_bucket_public_access_block.terraform_state.block_public_policy,
      aws_s3_bucket_public_access_block.terraform_state.ignore_public_acls,
      aws_s3_bucket_public_access_block.terraform_state.restrict_public_buckets,
    ])
    error_message = "All public access must be blocked on the state bucket."
  }

  assert {
    condition     = aws_s3_bucket_ownership_controls.terraform_state.rule[0].object_ownership == "BucketOwnerEnforced"
    error_message = "ACLs must be disabled (BucketOwnerEnforced)."
  }
}

run "state_versions_are_retained" {
  command = plan

  assert {
    condition     = aws_s3_bucket_lifecycle_configuration.terraform_state.rule[0].noncurrent_version_expiration[0].newer_noncurrent_versions == 10
    error_message = "At least 10 previous state versions must be kept."
  }

  assert {
    condition     = aws_s3_bucket_lifecycle_configuration.terraform_state.rule[0].noncurrent_version_expiration[0].noncurrent_days == 90
    error_message = "Previous state versions must be kept for 90 days."
  }

  assert {
    condition     = length(aws_s3_bucket_lifecycle_configuration.terraform_state.rule[0].expiration) == 0
    error_message = "Current state versions must never expire."
  }
}

run "lock_table_is_terraform_compatible" {
  command = plan

  assert {
    condition     = aws_dynamodb_table.terraform_locks.name == "tenner-terraform-locks"
    error_message = "Lock table must be named tenner-terraform-locks (must match backend.tf)."
  }

  assert {
    condition     = aws_dynamodb_table.terraform_locks.hash_key == "LockID"
    error_message = "Terraform requires the lock table hash key LockID."
  }

  assert {
    condition     = aws_dynamodb_table.terraform_locks.billing_mode == "PAY_PER_REQUEST"
    error_message = "Lock table must use on-demand billing."
  }

  assert {
    condition     = aws_dynamodb_table.terraform_locks.server_side_encryption[0].enabled
    error_message = "Lock table encryption must be enabled."
  }

  assert {
    condition     = aws_dynamodb_table.terraform_locks.deletion_protection_enabled
    error_message = "Lock table must have deletion protection."
  }
}

run "state_resources_have_governance_tags" {
  command = plan

  assert {
    condition = alltrue([
      for tags in [aws_s3_bucket.terraform_state.tags, aws_dynamodb_table.terraform_locks.tags] :
      alltrue([for k in ["Name", "Purpose", "Description"] : contains(keys(tags), k)])
    ])
    error_message = "State resources must set Name, Purpose and Description tags."
  }
}
