# Dish photos (FOOD-011, ADR 0007): private S3 bucket, served by the frontend distribution under /images/* via
# Origin Access Control. Browsers upload with presigned PUT URLs from the API; nothing is public.

resource "aws_s3_bucket" "meal_images" {
  bucket = local.meal_images_bucket_name

  tags = {
    Name        = local.meal_images_bucket_name
    Purpose     = "Dish photo storage."
    Description = "Private bucket with the household's dish photos, served via CloudFront under /images/*."
  }
}

resource "aws_s3_bucket_versioning" "meal_images" {
  bucket = aws_s3_bucket.meal_images.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "meal_images" {
  bucket = aws_s3_bucket.meal_images.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "meal_images" {
  bucket = aws_s3_bucket.meal_images.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "meal_images" {
  bucket = aws_s3_bucket.meal_images.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# Replaced or removed photos stay 30 days as old versions (undo by hand), then disappear.
resource "aws_s3_bucket_lifecycle_configuration" "meal_images" {
  bucket = aws_s3_bucket.meal_images.id

  rule {
    id     = "expire-replaced-photos"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    expiration {
      expired_object_delete_marker = true
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }

  depends_on = [aws_s3_bucket_versioning.meal_images]
}

# The web app uploads directly from the CloudFront origin; only PUT with the signed headers.
resource "aws_s3_bucket_cors_configuration" "meal_images" {
  bucket = aws_s3_bucket.meal_images.id

  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins = ["https://${aws_cloudfront_distribution.frontend.domain_name}"]
    allowed_headers = ["content-type", "cache-control"]
    max_age_seconds = 3000
  }
}

# CloudFront reads, the API role writes under images/meals/ (IAM, iam.tf); TLS required.
data "aws_iam_policy_document" "meal_images_bucket" {
  statement {
    sid       = "AllowCloudFrontRead"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.meal_images.arn}/images/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.frontend.arn]
    }
  }

  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.meal_images.arn,
      "${aws_s3_bucket.meal_images.arn}/*",
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

resource "aws_s3_bucket_policy" "meal_images" {
  bucket = aws_s3_bucket.meal_images.id
  policy = data.aws_iam_policy_document.meal_images_bucket.json

  depends_on = [aws_s3_bucket_public_access_block.meal_images]
}
