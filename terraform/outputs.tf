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

output "tenners_table_name" {
  description = "Name of the tenner-tenners DynamoDB table."
  value       = aws_dynamodb_table.tenners.name
}

output "tenners_table_arn" {
  description = "ARN of the tenner-tenners DynamoDB table."
  value       = aws_dynamodb_table.tenners.arn
}

output "history_table_name" {
  description = "Name of the tenner-history DynamoDB table."
  value       = aws_dynamodb_table.history.name
}

output "history_table_arn" {
  description = "ARN of the tenner-history DynamoDB table."
  value       = aws_dynamodb_table.history.arn
}

output "api_lambda_role_arn" {
  description = "ARN of the Tenner API Lambda execution role."
  value       = aws_iam_role.api.arn
}

output "frontend_bucket_name" {
  description = "S3 bucket holding the frontend build (deploy target)."
  value       = aws_s3_bucket.frontend.bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (cache invalidation)."
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "CloudFront domain serving the frontend."
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "frontend_url" {
  description = "HTTPS URL of the Tenner frontend."
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}
