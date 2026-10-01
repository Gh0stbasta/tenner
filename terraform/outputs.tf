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
