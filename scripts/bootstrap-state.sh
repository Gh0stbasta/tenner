#!/usr/bin/env bash
# Bootstrap the Terraform remote state backend (TICKET-003).
#
# Terraform cannot store its state in a bucket that does not exist yet. This script:
#   1. temporarily switches to a local backend (backend_override.tf, git-ignored)
#   2. creates only the state bucket and lock table (terraform apply -target)
#   3. switches back to the S3 backend and migrates the local state into it
#   4. verifies remote state and deletes the local state files
#
# Usage (from the repository root, with AWS credentials for the target account):
#   scripts/bootstrap-state.sh            # dry run: plan only, no changes
#   scripts/bootstrap-state.sh --apply    # create backend resources and migrate state
#
# Run once per AWS account. It refuses to run if the state bucket already exists.
set -euo pipefail

readonly STATE_BUCKET="tenner-terraform-state"
TF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../terraform" && pwd)"
readonly TF_DIR
readonly OVERRIDE_FILE="${TF_DIR}/backend_override.tf"
readonly TARGETS=(
  aws_s3_bucket.terraform_state
  aws_s3_bucket_versioning.terraform_state
  aws_s3_bucket_server_side_encryption_configuration.terraform_state
  aws_s3_bucket_public_access_block.terraform_state
  aws_s3_bucket_ownership_controls.terraform_state
  aws_s3_bucket_policy.terraform_state
  aws_s3_bucket_lifecycle_configuration.terraform_state
  aws_dynamodb_table.terraform_locks
)

apply=false
case "${1:-}" in
  "") ;;
  --apply) apply=true ;;
  *) echo "Usage: $0 [--apply]" >&2; exit 2 ;;
esac

for cmd in terraform aws; do
  command -v "$cmd" >/dev/null || { echo "Error: '$cmd' is required." >&2; exit 1; }
done

cleanup() { rm -f "$OVERRIDE_FILE"; }
trap cleanup EXIT

echo "AWS identity:"
aws sts get-caller-identity --query '{Account:Account,Arn:Arn}' --output table

if aws s3api head-bucket --bucket "$STATE_BUCKET" >/dev/null 2>&1; then
  echo "Bucket '${STATE_BUCKET}' already exists. The backend is bootstrapped; use 'terraform init'." >&2
  exit 1
fi

target_args=()
for t in "${TARGETS[@]}"; do target_args+=("-target=$t"); done

echo "Step 1: temporary local backend"
printf 'terraform {\n  backend "local" {}\n}\n' > "$OVERRIDE_FILE"
terraform -chdir="$TF_DIR" init -input=false -reconfigure

if [[ "$apply" == false ]]; then
  echo "Dry run: planning state backend resources only. Re-run with --apply to create them."
  terraform -chdir="$TF_DIR" plan -input=false "${target_args[@]}"
  exit 0
fi

echo "Step 2: create state bucket and lock table"
terraform -chdir="$TF_DIR" apply -input=false "${target_args[@]}"

echo "Step 3: switch to S3 backend and migrate local state"
cleanup
terraform -chdir="$TF_DIR" init -input=false -migrate-state -force-copy

echo "Step 4: verify remote state"
terraform -chdir="$TF_DIR" state list
rm -f "${TF_DIR}/terraform.tfstate" "${TF_DIR}/terraform.tfstate.backup"

echo "Done. Remote state is active: s3://${STATE_BUCKET}/prod/terraform.tfstate"
