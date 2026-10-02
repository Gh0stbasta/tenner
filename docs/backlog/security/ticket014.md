# SECURITY-014: Cap API Cost with Stage Throttling and Lambda Concurrency

## Type

Infrastructure / Security

---

## Priority

Critical

---

## Phase

MVP (before the first deployment to `main`)

---

## Goal

Bound the worst-case daily AWS cost of the public, unauthenticated API before the first
deployment. Configure throttling on the API Gateway stage and a concurrency cap on the
Lambda function.

---

# Background

After TICKET-005 to TICKET-020, the HTTP API `tenner-api-gateway` is reachable from the
internet without authentication (SECURITY-002) and without throttling. The only effective
limit is the account-wide Lambda concurrency limit (default 1000).

Rough cost per million requests in eu-central-1:

```text
API Gateway HTTP API  ~1.20 USD
Lambda (256 MB, arm64, short runtime)  ~0.40 USD
DynamoDB on-demand  ~0.30–1.50 USD
Total  ~2–3 USD per million requests
```

A sustained flood of 1000 req/s (~86M requests/day) could cost about 150–250 USD/day.
Stage throttling of 10 req/s caps this at about 864,000 requests/day, which is about
2–3 USD/day.

This ticket is the cost-critical subset of SECURITY-005. It is split out so it can ship
before the first deployment. SECURITY-005 keeps the remaining hardening work.

---

# Dependencies

```text
TICKET-005  (Lambda and HTTP API stage)
```

---

# Scope

## API Gateway

```text
aws_apigatewayv2_stage.default_route_settings:
  throttling_burst_limit = var.api_throttling_burst_limit  (default 20)
  throttling_rate_limit  = var.api_throttling_rate_limit   (default 10 req/s)
```

- Make both values Terraform variables with validation (positive numbers, burst >= 1).
- Throttled requests return HTTP 429 from API Gateway. They never reach Lambda or
  DynamoDB and are not billed by Lambda or DynamoDB.

## Lambda

```text
aws_lambda_function.reserved_concurrent_executions = var.api_reserved_concurrency
```

- Default value: decide during implementation, based on the account limit (see Assumptions).
  `-1` (no reservation) must remain possible through the variable.
- Validation: `-1` or a positive integer.

## Documentation

- `docs/architecture.md`: replace "throttling (SECURITY-005)" with the implemented limits and
  the resulting worst-case cost.
- `README.md`: list the new variables and explain how to change the limits.
- `docs/technical-debt.md`: record that the limits are global, not per client, and that
  legitimate users share the budget with an attacker until authentication exists.

---

# Testing Requirements

```text
terraform fmt -check
terraform validate
terraform test: stage throttling values, Lambda reserved concurrency, variable validation (invalid values rejected)
Offline terraform plan + scripts/check_tags.py
```

After the first deployment (manual, outside this ticket's CI):

```text
Short burst (≤ 100 requests) against GET /health shows HTTP 429 responses
```

---

# Acceptance Criteria

- [ ] HTTP API stage has default route throttling (burst 20, rate 10 req/s by default)
- [ ] Throttling limits are configurable through validated Terraform variables
- [ ] Lambda reserved concurrency is configurable through a validated Terraform variable
- [ ] Terraform tests cover the defaults and the variable validation
- [ ] Worst-case daily cost is documented in `docs/architecture.md`
- [ ] README and technical debt are updated
- [ ] SECURITY-005 references this ticket for throttling and concurrency

---

# Definition of Done

- [ ] Implementation completed
- [ ] Tests completed
- [ ] Documentation updated
- [ ] Technical debt documented
- [ ] Acceptance criteria verified
- [ ] Git commit created

---

# Assumptions

- The frontend needs at most a few requests per second for a single household, so
  10 req/s with a burst of 20 does not affect normal use.
- **Reserved concurrency depends on the account.** AWS requires at least 100 unreserved
  concurrent executions to remain in the account, so reserving any concurrency fails on
  new accounts whose limit is only 10. If the account limit is 10, set the default to `-1`.
  Stage throttling alone already caps the cost. Check the limit with:

  ```bash
  aws lambda get-account-settings --query 'AccountLimit.ConcurrentExecutions'
  ```

---

# Out of Scope

- Per-route or per-client throttling (needs authentication, SECURITY-002)
- AWS WAF rate-based rules (cost ~5+ USD/month)
- AWS Budgets and cost alerts (OPERATIONS-001)
- Access logging and the rest of the SECURITY-005 baseline
