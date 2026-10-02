# Environment: prod

Environment-specific Terraform configuration for production goes here.

Current state:

- The root configuration (`terraform/`) defaults to `environment = "prod"`, so no
  variable file is needed yet.
- TICKET-003 introduces the remote state backend (state key `prod/terraform.tfstate`).
- TICKET-021 introduces separate environments (`dev`, `prod`) with per-environment
  variable files and state keys in these folders.
