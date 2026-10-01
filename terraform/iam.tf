# Lambda execution role for the API (TICKET-005).
# Least privilege: only write logs to the API log group. No DynamoDB, no S3.

data "aws_iam_policy_document" "api_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "api" {
  name               = local.api_role_name
  assume_role_policy = data.aws_iam_policy_document.api_assume_role.json

  tags = {
    Name        = local.api_role_name
    Purpose     = "Lambda execution permissions."
    Description = "Provides runtime access for Tenner backend functions."
  }
}

data "aws_iam_policy_document" "api_logging" {
  statement {
    sid       = "WriteApiLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.api.arn}:log-stream:*"]
  }
}

resource "aws_iam_role_policy" "api_logging" {
  name   = "${local.api_role_name}-logging"
  role   = aws_iam_role.api.id
  policy = data.aws_iam_policy_document.api_logging.json
}
