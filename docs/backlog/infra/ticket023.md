# TICKET-023: Fix Invalid Characters in AWS Tags and Descriptions

## Type

Bug / Infrastructure

---

## Priority

Critical

---

## Phase

MVP

---

## Goal

The first deployment to `main` succeeds. Tag values and resource descriptions use only
characters that AWS accepts, and CI catches invalid tag characters before `apply`.

---

# Background

The first `deploy.yml` run (run 36971396311, 2026-10-02) applied part of the plan and then
failed with two AWS validation errors. `terraform plan`, the offline tests and the tag check
all passed, because they do not validate characters.

```text
aws_s3_bucket.frontend            InvalidTag: The TagValue you have provided is invalid
                                  (Description contains a comma)
aws_resourcegroups_group.tenner   description must match [\sa-zA-Z0-9_\.-]*
                                  (contains "(", ")" and "=")
```

The other resources (Lambda, DynamoDB tables, IAM role and policies, log groups, CloudFront
OAC and headers policy) were created and are in the remote state. The next apply continues
from there.

AWS tag rules (common subset across services): letters, numbers, spaces and `_ . : / = + - @`.

---

# Dependencies

```text
TICKET-001A  (tag check)
TICKET-002   (resource group)
TICKET-017   (frontend bucket)
```

---

# Requirements

- Remove the comma from the frontend bucket `Description` tag.
- Make the resource group description match `[\sa-zA-Z0-9_\.-]*`.
- `scripts/check_tags.py` rejects tag keys and values with characters outside the AWS tag
  character set, so the plan check fails before `apply`.
- Add an offline Terraform test for the resource group description pattern.

---

# Acceptance Criteria

- [x] Frontend bucket `Description` tag contains only allowed characters
- [x] Resource group description matches the AWS pattern
- [x] `check_tags.py` reports tags with invalid characters and exits non-zero
- [x] Unit tests cover valid and invalid tag characters
- [x] Terraform test asserts the resource group description pattern
- [x] All existing tests pass (`terraform test`, tag checker tests)
- [ ] Deploy run on `main` succeeds (verified after merge)

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [ ] Acceptance criteria verified (deploy on `main` pending)
- [x] Git commit created

---

# Assumptions

- The check uses the common AWS tag character set (Unicode letters, numbers, whitespace,
  `_ . : / = + - @`). Some services allow more, but S3 is the strictest service in use, so
  the common set avoids service-specific surprises.
- Description fields of individual resource types (not tags) have their own rules. Only the
  resource group description failed; it is covered by a dedicated Terraform test.

---

# Out of Scope

- Validating every per-service description field in CI
- Rollback of the partially applied resources (not needed; the next apply continues)

---

# Implementation Status

- `terraform/frontend-hosting.tf`: comma removed from the bucket `Description` tag.
- `terraform/resource-groups.tf`: description is now `All resources of the Tenner application tagged Project Tenner.`
- `scripts/check_tags.py`: new check for invalid tag characters (keys and values). Both
  missing tags and invalid characters are reported; the exit code is 1 if either occurs.
- Tests: 4 new tag checker unit tests (plus an exit-code case); TD-015 records the remaining gap; new Terraform test run `resource_group_description_is_valid`.
- Validation: `terraform fmt -check`, `terraform validate`, `terraform test`, tag checker tests.
  A unit test reproduces the old frontend tag (comma); a mutation check with the old resource group
  description makes the new Terraform test fail.
