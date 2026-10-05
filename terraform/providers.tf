provider "aws" {
  region = var.aws_region

  # Every taggable resource inherits the common Tenner tags.
  # Resources add only their own Name, Purpose and Description tags.
  default_tags {
    tags = local.common_tags
  }
}

# Alexa skill Lambda (ALEXA-001, ADR 0005): the Alexa Skills Kit trigger is not available in eu-central-1, so the
# skill Lambda runs in var.alexa_region. No data is stored there; the skill calls the Tenner API over HTTPS.
provider "aws" {
  alias  = "alexa"
  region = var.alexa_region

  default_tags {
    tags = local.common_tags
  }
}
