# Alexa skill Lambda (ALEXA-001, ADR 0005).
# Runs in var.alexa_region (eu-west-1) because the Alexa Skills Kit trigger does not exist in eu-central-1.
# Everything here is created only when var.alexa_skill_id is set (after the skill exists in the developer console);
# until then the plan contains no Alexa resources and the deploy role needs no eu-west-1 permissions.
# The skill bundle must be built first: `npm ci && npm run build` in alexa/.

data "archive_file" "alexa_skill" {
  count = local.alexa_enabled ? 1 : 0

  type        = "zip"
  source_dir  = local.alexa_source_dir
  output_path = local.alexa_package_zip
}

resource "aws_cloudwatch_log_group" "alexa_skill" {
  count    = local.alexa_enabled ? 1 : 0
  provider = aws.alexa

  name              = local.alexa_log_group_name
  retention_in_days = var.log_retention_days

  tags = {
    Name        = local.alexa_log_group_name
    Purpose     = "Application logging."
    Description = "Stores logs of the Tenner Alexa skill Lambda."
  }
}

# Logs only: the skill reaches household data through the Tenner API with the linked user's token (ALEXA-002),
# never through DynamoDB or other AWS APIs.
resource "aws_iam_role" "alexa_skill" {
  count = local.alexa_enabled ? 1 : 0

  name               = local.alexa_role_name
  assume_role_policy = data.aws_iam_policy_document.api_assume_role.json

  tags = {
    Name        = local.alexa_role_name
    Purpose     = "Lambda execution permissions."
    Description = "Provides log access for the Tenner Alexa skill Lambda."
  }
}

data "aws_iam_policy_document" "alexa_skill_logging" {
  count = local.alexa_enabled ? 1 : 0

  statement {
    sid       = "WriteAlexaSkillLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.alexa_skill[0].arn}:log-stream:*"]
  }
}

resource "aws_iam_role_policy" "alexa_skill_logging" {
  count = local.alexa_enabled ? 1 : 0

  name   = "${local.alexa_role_name}-logging"
  role   = aws_iam_role.alexa_skill[0].id
  policy = data.aws_iam_policy_document.alexa_skill_logging[0].json
}

resource "aws_lambda_function" "alexa_skill" {
  count    = local.alexa_enabled ? 1 : 0
  provider = aws.alexa

  function_name    = local.alexa_function_name
  role             = aws_iam_role.alexa_skill[0].arn
  runtime          = local.alexa_runtime
  architectures    = [local.alexa_architecture]
  handler          = "index.handler"
  memory_size      = local.alexa_memory_mb
  timeout          = local.alexa_timeout_seconds
  filename         = data.archive_file.alexa_skill[0].output_path
  source_code_hash = data.archive_file.alexa_skill[0].output_base64sha256

  environment {
    variables = {
      ENVIRONMENT         = var.environment
      LOG_LEVEL           = var.alexa_log_level
      TENNER_API_BASE_URL = aws_apigatewayv2_stage.api.invoke_url
      ALEXA_SKILL_ID      = var.alexa_skill_id
    }
  }

  logging_config {
    log_format = "JSON"
    log_group  = aws_cloudwatch_log_group.alexa_skill[0].name
  }

  tags = {
    Name        = local.alexa_function_name
    Purpose     = "Tenner Alexa skill runtime."
    Description = "Answers Alexa requests for the Tenner custom skill."
  }

  depends_on = [aws_iam_role_policy.alexa_skill_logging]
}

# Only the Tenner skill may invoke the function: the Alexa Skills Kit trigger checks the skill ID.
resource "aws_lambda_permission" "alexa_skill" {
  count    = local.alexa_enabled ? 1 : 0
  provider = aws.alexa

  statement_id       = "AllowTennerAlexaSkill"
  action             = "lambda:InvokeFunction"
  function_name      = aws_lambda_function.alexa_skill[0].function_name
  principal          = local.alexa_invocation_principal
  event_source_token = var.alexa_skill_id
}
