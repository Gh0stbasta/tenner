# Offline tests for the Alexa skill Lambda (ALEXA-001, ADR 0005).

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

override_resource {
  target          = aws_cognito_user_pool.users
  override_during = plan
  values = {
    id = "eu-central-1_TEST"
  }
}

# Alexa skill region (ALEXA-001): mocked like the default provider.
mock_provider "aws" {
  alias = "alexa"
}


run "no_alexa_resources_without_skill_id" {
  command = plan

  assert {
    condition     = length(aws_lambda_function.alexa_skill) == 0 && length(aws_lambda_permission.alexa_skill) == 0 && length(aws_iam_role.alexa_skill) == 0 && length(aws_cloudwatch_log_group.alexa_skill) == 0
    error_message = "Without alexa_skill_id no Alexa resources may be planned (the deploy role has no eu-west-1 permissions yet)."
  }

  assert {
    condition     = output.alexa_skill_lambda_arn == ""
    error_message = "alexa_skill_lambda_arn must be empty while the skill is not configured."
  }

  assert {
    condition     = var.alexa_region == "eu-west-1"
    error_message = "The skill Lambda must default to eu-west-1 (Alexa Skills Kit trigger region for de-DE)."
  }
}

run "skill_lambda_matches_requirements" {
  command = plan

  variables {
    alexa_skill_id = "amzn1.ask.skill.12345678-90ab-cdef-1234-567890abcdef"
  }

  assert {
    condition     = aws_lambda_function.alexa_skill[0].function_name == "tenner-alexa-skill"
    error_message = "Skill Lambda must be named tenner-alexa-skill."
  }

  assert {
    condition     = aws_lambda_function.alexa_skill[0].runtime == "nodejs22.x" && aws_lambda_function.alexa_skill[0].architectures == tolist(["arm64"]) && aws_lambda_function.alexa_skill[0].memory_size == 256
    error_message = "Skill Lambda must run Node.js 22 on arm64 with 256 MB."
  }

  assert {
    condition     = aws_lambda_function.alexa_skill[0].timeout < 8
    error_message = "Skill Lambda timeout must stay below the 8 second Alexa response limit."
  }

  assert {
    condition     = aws_lambda_function.alexa_skill[0].environment[0].variables["ALEXA_SKILL_ID"] == "amzn1.ask.skill.12345678-90ab-cdef-1234-567890abcdef" && contains(keys(aws_lambda_function.alexa_skill[0].environment[0].variables), "TENNER_API_BASE_URL")
    error_message = "Skill Lambda must get the skill ID and the Tenner API base URL."
  }

  assert {
    condition     = aws_cloudwatch_log_group.alexa_skill[0].name == "/tenner/alexa-skill" && aws_cloudwatch_log_group.alexa_skill[0].retention_in_days == 30
    error_message = "Skill logs must go to /tenner/alexa-skill with 30 days retention."
  }
}

run "only_the_tenner_skill_may_invoke" {
  command = plan

  variables {
    alexa_skill_id = "amzn1.ask.skill.12345678-90ab-cdef-1234-567890abcdef"
  }

  assert {
    condition     = aws_lambda_permission.alexa_skill[0].principal == "alexa-appkit.amazon.com" && aws_lambda_permission.alexa_skill[0].action == "lambda:InvokeFunction"
    error_message = "Only the Alexa Skills Kit may invoke the skill Lambda."
  }

  assert {
    condition     = aws_lambda_permission.alexa_skill[0].event_source_token == "amzn1.ask.skill.12345678-90ab-cdef-1234-567890abcdef"
    error_message = "The permission must be restricted to the Tenner skill ID."
  }
}

run "skill_role_writes_logs_only" {
  command = plan

  variables {
    alexa_skill_id = "amzn1.ask.skill.12345678-90ab-cdef-1234-567890abcdef"
  }

  assert {
    condition     = aws_iam_role.alexa_skill[0].name == "tenner-alexa-skill-role" && length(aws_iam_role_policy.alexa_skill_logging) == 1
    error_message = "Skill role must exist with exactly the logging policy."
  }
}

run "invalid_skill_id_is_rejected" {
  command = plan

  variables {
    alexa_skill_id = "not-a-skill-id"
  }

  expect_failures = [var.alexa_skill_id]
}

run "region_without_alexa_trigger_is_rejected" {
  command = plan

  variables {
    alexa_region = "eu-central-1"
  }

  expect_failures = [var.alexa_region]
}
