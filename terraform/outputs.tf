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

output "households_table_name" {
  description = "Name of the household settings table (SCHEDULING-008)."
  value       = aws_dynamodb_table.households.name
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

output "cognito_user_pool_id" {
  description = "ID of the Cognito user pool (user provisioning, SECURITY-002)."
  value       = aws_cognito_user_pool.users.id
}

output "cognito_client_id" {
  description = "ID of the public SPA app client (frontend login, SECURITY-003)."
  value       = aws_cognito_user_pool_client.web.id
}

output "cognito_issuer_url" {
  description = "OIDC issuer of the user pool (frontend authority, JWT authorizer)."
  value       = "https://${aws_cognito_user_pool.users.endpoint}"
}

output "cognito_login_url" {
  description = "Base URL of the Cognito managed login domain (logout endpoint)."
  value       = "https://${local.auth_login_domain}"
}

output "cognito_google_redirect_uri" {
  description = "Authorized redirect URI to enter in the Google OAuth client (FUTURE-011)."
  value       = "https://${local.auth_login_domain}/oauth2/idpresponse"
}

output "cognito_household_groups" {
  description = "Cognito groups that grant household membership (FUTURE-011)."
  value       = values(local.household_groups)
}

output "alexa_skill_lambda_arn" {
  description = "ARN of the Alexa skill Lambda (ALEXA-001); the skill manifest endpoint. Empty until alexa_skill_id is set."
  value       = local.alexa_enabled ? aws_lambda_function.alexa_skill[0].arn : ""
}

output "alexa_account_linking" {
  description = "Values for the Alexa developer console → Account Linking (ALEXA-002); null until Alexa linking is set up. The client secret is not output: read it with `aws cognito-idp describe-user-pool-client` (alexa/README.md)."
  value = local.alexa_auth_enabled ? {
    authorization_uri = "https://${local.auth_login_domain}/oauth2/authorize"
    access_token_uri  = "https://${local.auth_login_domain}/oauth2/token"
    client_id         = aws_cognito_user_pool_client.alexa[0].id
    scopes            = aws_cognito_user_pool_client.alexa[0].allowed_oauth_scopes
    user_pool_id      = aws_cognito_user_pool.users.id
  } : null
}
