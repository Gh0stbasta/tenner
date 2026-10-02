provider "aws" {
  region = var.aws_region

  # Every taggable resource inherits the common Tenner tags.
  # Resources add only their own Name, Purpose and Description tags.
  default_tags {
    tags = local.common_tags
  }
}
