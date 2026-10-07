# HOTFIX-003: CloudWatch Dashboard Metrics Format

## Type

Infrastructure

---

## Priority

High (blocks every deployment)

---

## Goal

The production deployment applies again: CloudWatch accepts the `tenner-prod` dashboard.

---

# Background

The deployment after merging PR #21 (run 37436385511, 2026-10-06) failed in "Terraform apply":

```text
"dataPath": "/widgets/7/properties/metrics/31",
"message": "Field \"metrics\" has to be an array of array of strings, with an optional metricRenderer object as last element"
```

The two DynamoDB widgets in `terraform/observability.tf` (OBSERVABILITY-001) built their metric lists with
`flatten()`, which also flattened the inner metric arrays into one list of strings. The tests only checked for
substrings in the dashboard body, so the shape error was invisible until CloudWatch validated it.

---

# Requirements

- Build the DynamoDB widget metrics as a list of metric arrays (`concat` of two `for` expressions).
- A Terraform test checks that every `metrics` entry of every widget is an array.

---

# Acceptance Criteria

- [x] Both DynamoDB widgets produce `[["AWS/DynamoDB", "<Metric>", "TableName", "<table>"], ...]`.
- [x] The new test fails on the old code and passes with the fix.
- [x] `terraform fmt` and the full `terraform test` suite pass (74 runs).

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated (this ticket)
- [x] Technical debt documented (none new)
- [x] Acceptance criteria verified
- [x] Git commit created

---

# Assumptions

- Apply stopped at the dashboard; resources created before it stay and the rerun applies the rest. Terraform state
  is consistent because a failed create is not recorded.

---

# Out of Scope

- Other CloudWatch-side validations that a mocked plan cannot catch; they surface on the next apply.

---

# Implementation Status

Done (2026-10-06). `terraform/observability.tf`, `terraform/tests/observability.tftest.hcl`.
