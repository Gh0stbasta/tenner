# Region the provider is configured for; used in outputs and by future resources.
data "aws_region" "current" {}

# Account of the deploy role; used to derive a stable, unique Cognito domain prefix (SECURITY-002).
data "aws_caller_identity" "current" {}
