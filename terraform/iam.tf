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
# TransactWriteItems (TICKET-013) needs no separate IAM action: DynamoDB authorizes each transaction item with
# its own action (PutItem, UpdateItem), granted here. SECURITY-005 removed Scan and DeleteItem from the
# TICKET-007 list: the code never scans and only soft-deletes (TICKET-012).
data "aws_iam_policy_document" "api_dynamodb" {
  statement {
    sid = "TennerTableAccess"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:Query",
    ]
    resources = [
      aws_dynamodb_table.tenners.arn,
      "${aws_dynamodb_table.tenners.arn}/index/*",
      aws_dynamodb_table.history.arn,
      "${aws_dynamodb_table.history.arn}/index/*",
      aws_dynamodb_table.households.arn,
      aws_dynamodb_table.meals.arn, # FOOD-001
    ]
  }

  # Title lookup for history pages (TICKET-020): batch reads on the Tenner table only.
  statement {
    sid       = "TennerTitleLookup"
    actions   = ["dynamodb:BatchGetItem"]
    resources = [aws_dynamodb_table.tenners.arn]
  }
}

resource "aws_iam_role_policy" "api_dynamodb" {
  name   = "${local.api_role_name}-dynamodb"
  role   = aws_iam_role.api.id
  policy = data.aws_iam_policy_document.api_dynamodb.json
}

# Household self-assignment (HOTFIX-001): the API adds the signed-in user to one household group and checks
# whether a member is already taken. Scoped to the Tenner user pool; no user creation, deletion or attribute writes.
data "aws_iam_policy_document" "api_cognito" {
  statement {
    sid = "HouseholdGroupMembership"
    actions = [
      "cognito-idp:AdminAddUserToGroup",
      "cognito-idp:AdminRemoveUserFromGroup",
      "cognito-idp:AdminListGroupsForUser",
      "cognito-idp:ListUsersInGroup",
      # HOUSEHOLD-ADMIN-001: groups of members added in the app are created on their first assignment.
      "cognito-idp:CreateGroup",
    ]
    resources = [aws_cognito_user_pool.users.arn]
  }
}

resource "aws_iam_role_policy" "api_cognito" {
  name   = "${local.api_role_name}-cognito"
  role   = aws_iam_role.api.id
  policy = data.aws_iam_policy_document.api_cognito.json
}

# NOTIFICATION-011: the API verifies push action links with the HMAC secret (exact parameter, aws/ssm key).
data "aws_iam_policy_document" "api_push_actions" {
  count = local.web_push_enabled ? 1 : 0

  statement {
    sid       = "ReadPushActionSecret"
    actions   = ["ssm:GetParameter"]
    resources = ["${local.secret_parameter_arn_prefix}/push/action-secret"]
  }
}

resource "aws_iam_role_policy" "api_push_actions" {
  count = local.web_push_enabled ? 1 : 0

  name   = "${local.api_role_name}-push-actions"
  role   = aws_iam_role.api.id
  policy = data.aws_iam_policy_document.api_push_actions[0].json
}
