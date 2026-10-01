output "aws_region" {
  description = "AWS region the infrastructure is deployed to."
  value       = data.aws_region.current.region
}

output "environment" {
  description = "Deployment environment."
  value       = var.environment
}

output "resource_group_name" {
  description = "Name of the tag-based Tenner AWS Resource Group."
  value       = aws_resourcegroups_group.tenner.name
}

output "state_bucket_name" {
  description = "S3 bucket holding the Terraform state."
  value       = aws_s3_bucket.terraform_state.bucket
}

output "state_lock_table_name" {
  description = "DynamoDB table used for Terraform state locking."
  value       = aws_dynamodb_table.terraform_locks.name
}

output "mandatory_tag_keys" {
  description = "Tag keys every taggable resource must carry. Read by scripts/check_tags.py."
  value       = local.mandatory_tag_keys
}

output "api_endpoint" {
  description = "Base URL of the Tenner API stage (append /health)."
  value       = aws_apigatewayv2_stage.api.invoke_url
}

output "api_gateway_id" {
  description = "ID of the Tenner HTTP API."
  value       = aws_apigatewayv2_api.api.id
}

output "api_lambda_function_arn" {
  description = "ARN of the Tenner API Lambda function."
  value       = aws_lambda_function.api.arn
}

output "api_lambda_function_name" {
  description = "Name of the Tenner API Lambda function."
  value       = aws_lambda_function.api.function_name
}
