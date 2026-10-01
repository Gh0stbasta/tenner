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
