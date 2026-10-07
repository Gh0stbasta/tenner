# DynamoDB persistence layer (TICKET-006).
# Both tables are partitioned by tenantId to support multiple households later.
# No data access is granted to Lambda in this ticket (TICKET-007).

resource "aws_dynamodb_table" "tenners" {
  name         = local.tenners_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenantId"
  range_key    = "tennerId"

  attribute {
    name = "tenantId"
    type = "S"
  }

  attribute {
    name = "tennerId"
    type = "S"
  }

  attribute {
    name = "nextDue"
    type = "S"
  }

  attribute {
    name = "assignedTo"
    type = "S"
  }

  # Due and overdue Tenners: Query tenantId with nextDue <= today.
  global_secondary_index {
    name = "nextDue-index"
    key_schema {
      attribute_name = "tenantId"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "nextDue"
      key_type       = "RANGE"
    }

    projection_type = "ALL"
  }

  # Tenners assigned to a user: Query tenantId with assignedTo = user.
  global_secondary_index {
    name = "assignedTo-index"
    key_schema {
      attribute_name = "tenantId"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "assignedTo"
      key_type       = "RANGE"
    }

    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = true
  }

  deletion_protection_enabled = true

  tags = {
    Name        = local.tenners_table_name
    Purpose     = "Primary Tenner storage."
    Description = "Stores recurring responsibilities and schedules."
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_dynamodb_table" "history" {
  name         = local.history_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenantId"
  range_key    = "historyId"

  attribute {
    name = "tenantId"
    type = "S"
  }

  attribute {
    name = "historyId"
    type = "S"
  }

  attribute {
    name = "completedAt"
    type = "S"
  }

  # "<tenantId>#<tennerId>" (TICKET-014).
  attribute {
    name = "tenantTennerId"
    type = "S"
  }

  # Reporting and analytics: Query tenantId by completedAt range.
  global_secondary_index {
    name = "completedAt-index"
    key_schema {
      attribute_name = "tenantId"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "completedAt"
      key_type       = "RANGE"
    }

    projection_type = "ALL"
  }

  # History of one Tenner, newest first (undo, detail views): Query tenantTennerId, ScanIndexForward = false.
  global_secondary_index {
    name = "tennerId-completedAt-index"

    key_schema {
      attribute_name = "tenantTennerId"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "completedAt"
      key_type       = "RANGE"
    }

    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = true
  }

  deletion_protection_enabled = true

  tags = {
    Name        = local.history_table_name
    Purpose     = "Completion tracking."
    Description = "Stores historical execution data."
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Household settings (SCHEDULING-008): one item per tenant, e.g. the timezone all due dates use.
# HOUSEHOLD-ADMIN-003 adds more attributes to the same item.
resource "aws_dynamodb_table" "households" {
  name         = local.households_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenantId"

  attribute {
    name = "tenantId"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = true
  }

  deletion_protection_enabled = true

  tags = {
    Name        = local.households_table_name
    Purpose     = "Household settings storage."
    Description = "Stores settings per household such as the timezone."
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Meal planning (FOOD-001, ADR 0007): one table, item kinds by sort key prefix (DISH#, INGREDIENT#, PROFILE,
# PLAN#, LIST#). expiresAt is the TTL of old plans (FOOD-023).
resource "aws_dynamodb_table" "meals" {
  name         = local.meals_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tenantId"
  range_key    = "itemKey"

  attribute {
    name = "tenantId"
    type = "S"
  }

  attribute {
    name = "itemKey"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = true
  }

  deletion_protection_enabled = true

  tags = {
    Name        = local.meals_table_name
    Purpose     = "Meal planning storage."
    Description = "Stores dishes and ingredients plus the family food profile and the weekly meal plans."
  }

  lifecycle {
    prevent_destroy = true
  }
}
