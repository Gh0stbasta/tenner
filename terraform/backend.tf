# Remote state backend (TICKET-003).
# Backend blocks cannot use variables, so these values are literals.
# They must match local.state_bucket_name / local.state_lock_table_name.
# First-time setup: scripts/bootstrap-state.sh (see README "Terraform State").
terraform {
  backend "s3" {
    bucket         = "tenner-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "eu-central-1"
    encrypt        = true
    use_lockfile   = true
    dynamodb_table = "tenner-terraform-locks"
  }
}
