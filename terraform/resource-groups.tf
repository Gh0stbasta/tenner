# Tag-based AWS Resource Group: every resource tagged Project = Tenner
# becomes a member automatically. No manual assignment.
resource "aws_resourcegroups_group" "tenner" {
  name        = local.resource_group_name
  description = "All resources of the Tenner application (tag Project = Tenner)."

  resource_query {
    type = "TAG_FILTERS_1_0"
    query = jsonencode({
      ResourceTypeFilters = ["AWS::AllSupported"]
      TagFilters = [
        {
          Key    = "Project"
          Values = [local.common_tags.Project]
        }
      ]
    })
  }

  tags = {
    Name        = local.resource_group_name
    Purpose     = "Resource governance"
    Description = "Tag-based resource group containing all Tenner resources."
  }
}
