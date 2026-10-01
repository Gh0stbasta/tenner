# Offline tests for the Terraform foundation (TICKET-002).
# The mocked provider needs no AWS credentials: run with `terraform test`.

mock_provider "aws" {
  mock_data "aws_region" {
    defaults = {
      region = "eu-central-1"
    }
  }
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
    }
    error_message = "common_tags do not match the mandatory tag standard."
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

run "environment_is_validated" {
  command = plan

  variables {
    environment = "staging"
  }

  expect_failures = [var.environment]
}

run "region_is_validated" {
  command = plan

  variables {
    aws_region = "not-a-region"
  }

  expect_failures = [var.aws_region]
}
