# Offline tests for the Terraform foundation (TICKET-002).
# The mocked provider needs no AWS credentials: run with `terraform test`.

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

# Alexa skill region (ALEXA-001): mocked like the default provider.
mock_provider "aws" {
  alias = "alexa"
}

run "common_tags_contain_mandatory_values" {
  command = plan

  assert {
    condition = local.common_tags == {
      Application = "Tenner"
      Project     = "Tenner"
      Owner       = "Stefan Schmidpeter"
      Environment = "prod"
      CreatedBy   = "GitHub Actions"
      ManagedBy   = "Terraform"
      Repository  = "Gh0stbasta/tenner"
      CostCenter  = "Tenner"
    }
    error_message = "common_tags do not match the mandatory tag standard."
  }

  assert {
    condition = toset(local.mandatory_tag_keys) == toset([
      "Name", "Application", "Project", "Owner", "Environment", "CreatedBy",
      "Purpose", "Description", "ManagedBy", "Repository", "CostCenter",
    ])
    error_message = "mandatory_tag_keys must match the TICKET-001A tag list."
  }
}

run "resource_group_is_tag_based" {
  command = plan

  assert {
    condition     = aws_resourcegroups_group.tenner.name == "Tenner"
    error_message = "Resource group must be named Tenner."
  }

  assert {
    condition     = aws_resourcegroups_group.tenner.resource_query[0].type == "TAG_FILTERS_1_0"
    error_message = "Resource group membership must be tag-based."
  }

  assert {
    condition = jsondecode(aws_resourcegroups_group.tenner.resource_query[0].query) == {
      ResourceTypeFilters = ["AWS::AllSupported"]
      TagFilters          = [{ Key = "Project", Values = ["Tenner"] }]
    }
    error_message = "Resource group must include all resources tagged Project = Tenner."
  }

  assert {
    condition     = alltrue([for k in ["Name", "Purpose", "Description"] : contains(keys(aws_resourcegroups_group.tenner.tags), k)])
    error_message = "Resource group must set Name, Purpose and Description tags."
  }
}

# AWS Resource Groups rejects descriptions outside this pattern (TICKET-023).
run "resource_group_description_is_valid" {
  command = plan

  assert {
    condition     = can(regex("^[\\sa-zA-Z0-9_.-]*$", aws_resourcegroups_group.tenner.description))
    error_message = "Resource group description may only contain letters, digits, whitespace, '_', '.' and '-'."
  }
}

run "environment_is_validated" {
  command = plan

  variables {
    environment = "staging"
  }

  expect_failures = [var.environment]
}

run "cost_center_must_not_be_empty" {
  command = plan

  variables {
    cost_center = " "
  }

  expect_failures = [var.cost_center]
}

run "region_is_validated" {
  command = plan

  variables {
    aws_region = "not-a-region"
  }

  expect_failures = [var.aws_region]
}
