# CloudWatch log groups for the API runtime (TICKET-005).

resource "aws_cloudwatch_log_group" "api" {
  name              = local.api_log_group_name
  retention_in_days = var.log_retention_days

  tags = {
    Name        = local.api_log_group_name
    Purpose     = "Application logging."
    Description = "Stores operational and application logs for Tenner API."
  }
}

resource "aws_cloudwatch_log_group" "api_access" {
  name              = local.api_access_log_name
  retention_in_days = var.log_retention_days

  tags = {
    Name        = local.api_access_log_name
    Purpose     = "API access logging."
    Description = "Stores API Gateway access logs for the Tenner API."
  }
}
