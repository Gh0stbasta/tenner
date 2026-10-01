# Lambda execution role for the API (TICKET-005, TICKET-007).
# Least privilege: write logs to the API log group and access the two Tenner tables. No S3.

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

# Data access to the Tenner tables and their indexes only (TICKET-007).
# Action list as specified by TICKET-007. TransactWriteItems (TICKET-013) needs no separate IAM action:
# DynamoDB authorizes each transaction item with its own action (PutItem, UpdateItem), granted here.
data "aws_iam_policy_document" "api_dynamodb" {
  statement {
    sid = "TennerTableAccess"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
    ]
    resources = [
      aws_dynamodb_table.tenners.arn,
      "${aws_dynamodb_table.tenners.arn}/index/*",
      aws_dynamodb_table.history.arn,
      "${aws_dynamodb_table.history.arn}/index/*",
    ]
  }
}

resource "aws_iam_role_policy" "api_dynamodb" {
  name   = "${local.api_role_name}-dynamodb"
  role   = aws_iam_role.api.id
  policy = data.aws_iam_policy_document.api_dynamodb.json
}
