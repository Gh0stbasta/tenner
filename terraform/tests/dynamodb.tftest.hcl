# Offline tests for the DynamoDB persistence layer (TICKET-006).

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

run "tables_use_tenant_partitioning" {
  command = plan

  assert {
    condition     = aws_dynamodb_table.tenners.name == "tenner-tenners" && aws_dynamodb_table.tenners.hash_key == "tenantId" && aws_dynamodb_table.tenners.range_key == "tennerId"
    error_message = "tenner-tenners must use tenantId/tennerId as primary key."
  }

  assert {
    condition     = aws_dynamodb_table.history.name == "tenner-history" && aws_dynamodb_table.history.hash_key == "tenantId" && aws_dynamodb_table.history.range_key == "historyId"
    error_message = "tenner-history must use tenantId/historyId as primary key."
  }
}

run "tables_are_protected_and_on_demand" {
  command = plan

  assert {
    condition = alltrue([
      for t in [aws_dynamodb_table.tenners, aws_dynamodb_table.history] :
      t.billing_mode == "PAY_PER_REQUEST" && t.point_in_time_recovery[0].enabled && t.server_side_encryption[0].enabled && t.deletion_protection_enabled
    ])
    error_message = "Tables must be on-demand, encrypted, with PITR and deletion protection."
  }
}

run "required_indexes_exist" {
  command = plan

  assert {
    condition = {
      for i in aws_dynamodb_table.tenners.global_secondary_index : i.name => [for k in i.key_schema : "${k.key_type}:${k.attribute_name}"]
      } == {
      "nextDue-index"    = ["HASH:tenantId", "RANGE:nextDue"]
      "assignedTo-index" = ["HASH:tenantId", "RANGE:assignedTo"]
    }
    error_message = "tenner-tenners must have nextDue-index and assignedTo-index."
  }

  assert {
    condition = {
      for i in aws_dynamodb_table.history.global_secondary_index : i.name => [for k in i.key_schema : "${k.key_type}:${k.attribute_name}"]
      } == {
      "completedAt-index"          = ["HASH:tenantId", "RANGE:completedAt"]
      "tennerId-completedAt-index" = ["HASH:tenantTennerId", "RANGE:completedAt"]
    }
    error_message = "tenner-history must have completedAt-index and tennerId-completedAt-index."
  }
}
