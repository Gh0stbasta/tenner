locals {
  # Naming standard: tenner-<resource>. No random names or generated suffixes
  # unless a resource type technically requires them.
  name_prefix = "tenner"

  # Name of the AWS Resource Group that collects all Tenner resources.
  resource_group_name = "Tenner"

  # Mandatory tags applied to every resource through provider default_tags.
  # Name, Purpose and Description are set per resource.
  common_tags = {
    Application = "Tenner"
    Project     = "Tenner"
    Owner       = "Stefan Schmidpeter"
    Environment = var.environment
    CreatedBy   = "GitHub Actions"
    ManagedBy   = "Terraform"
    Repository  = "Gh0stbasta/tenner"
  }
}
