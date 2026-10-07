# Environment: prod

Environment-specific Terraform configuration for production goes here.

Current state:

- The root configuration (`terraform/`) defaults to `environment = "prod"`, so no
  variable file is needed yet.
- TICKET-003 introduced the remote state backend (state key `prod/terraform.tfstate`).
- Production is the only environment (TD-040); separate environments (TICKET-021) were
  not built.
