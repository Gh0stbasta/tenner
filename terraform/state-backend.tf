# Remote state infrastructure (TICKET-003).
# These resources hold Terraform's own state. They are created once by
# scripts/bootstrap-state.sh and are protected against destruction afterwards.

resource "aws_s3_bucket" "terraform_state" {
  bucket = local.state_bucket_name

  tags = {
    Name        = local.state_bucket_name
    Purpose     = "Stores Terraform state files for the Tenner platform."
    Description = "Remote backend bucket used by Terraform for state management."
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# Reject any request that does not use TLS.
data "aws_iam_policy_document" "terraform_state_tls_only" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.terraform_state.arn,
      "${aws_s3_bucket.terraform_state.arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  policy = data.aws_iam_policy_document.terraform_state_tls_only.json

  depends_on = [aws_s3_bucket_public_access_block.terraform_state]
}

# Keep the current state forever. Keep the 10 newest previous versions, and any
# previous version younger than 90 days, for recovery. Clean up incomplete uploads.
resource "aws_s3_bucket_lifecycle_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    id     = "retain-recent-state-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days           = local.state_noncurrent_version_retention_days
      newer_noncurrent_versions = local.state_noncurrent_versions_to_keep
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.terraform_state]
}

resource "aws_dynamodb_table" "terraform_locks" {
  name         = local.state_lock_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }

  deletion_protection_enabled = true

  tags = {
    Name        = local.state_lock_table_name
    Purpose     = "Terraform state locking."
    Description = "Prevents concurrent modifications of Tenner infrastructure."
  }

  lifecycle {
    prevent_destroy = true
  }
}
