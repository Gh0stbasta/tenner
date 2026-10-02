# IAM policy content tests (TICKET-005, TICKET-007).
# The policy document data sources are mocked (only their rendered JSON is computed), but their
# configured statements stay inspectable. Resource ARNs are overridden with fixed values.

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

  mock_resource "aws_dynamodb_table" {
    defaults = {
      arn = "arn:aws:dynamodb:eu-central-1:000000000000:table/mock"
    }
  }

  mock_resource "aws_cloudwatch_log_group" {
    defaults = {
      arn = "arn:aws:logs:eu-central-1:000000000000:log-group:/tenner/api"
    }
  }
}

override_resource {
  target          = aws_dynamodb_table.tenners
  override_during = plan
  values = {
    arn = "arn:aws:dynamodb:eu-central-1:000000000000:table/tenner-tenners"
  }
}

override_resource {
  target          = aws_dynamodb_table.history
  override_during = plan
  values = {
    arn = "arn:aws:dynamodb:eu-central-1:000000000000:table/tenner-history"
  }
}

run "dynamodb_policy_is_scoped_to_tenner_tables" {
  command = plan

  assert {
    condition = toset(data.aws_iam_policy_document.api_dynamodb.statement[0].resources) == toset([
      "arn:aws:dynamodb:eu-central-1:000000000000:table/tenner-tenners",
      "arn:aws:dynamodb:eu-central-1:000000000000:table/tenner-tenners/index/*",
      "arn:aws:dynamodb:eu-central-1:000000000000:table/tenner-history",
      "arn:aws:dynamodb:eu-central-1:000000000000:table/tenner-history/index/*",
    ])
    error_message = "DynamoDB access must be limited to the two Tenner tables and their indexes."
  }

  assert {
    condition = toset(data.aws_iam_policy_document.api_dynamodb.statement[0].actions) == toset([
      "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem",
      "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:Scan",
    ])
    error_message = "DynamoDB actions must match the TICKET-007 allow list."
  }

  assert {
    condition     = alltrue([for a in data.aws_iam_policy_document.api_dynamodb.statement[0].actions : !strcontains(a, "*")])
    error_message = "Wildcard DynamoDB actions are not permitted."
  }
}

run "batch_get_is_limited_to_the_tenner_table" {
  command = plan

  assert {
    condition     = data.aws_iam_policy_document.api_dynamodb.statement[1].actions == toset(["dynamodb:BatchGetItem"])
    error_message = "Second statement must only allow BatchGetItem."
  }

  assert {
    condition     = data.aws_iam_policy_document.api_dynamodb.statement[1].resources == toset(["arn:aws:dynamodb:eu-central-1:000000000000:table/tenner-tenners"])
    error_message = "BatchGetItem must be limited to the Tenner table."
  }
}

run "logging_policy_is_scoped_to_api_log_group" {
  command = plan

  assert {
    condition     = data.aws_iam_policy_document.api_logging.statement[0].resources == toset(["arn:aws:logs:eu-central-1:000000000000:log-group:/tenner/api:log-stream:*"])
    error_message = "Log permissions must be limited to the API log group."
  }
}
