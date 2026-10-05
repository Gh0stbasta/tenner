# SECURITY-006: Implement Secrets Management

## Type

Infrastructure / Security

---

## Priority

High

---

## Phase

V2

---

## Goal

Provide a secure, Terraform-compatible way to store and access application secrets
such as:

```text
Telegram bot token
Telegram webhook secret
VAPID private key
OAuth client secrets for integrations
AI provider API keys
```

---

# Background

No secrets exist yet in the application. Upcoming features (NOTIFICATION-006,
NOTIFICATION-007, INTEGRATION domain, AI domain) require them.

Neither SSM Parameter Store nor Secrets Manager is in the allowed-service list
of the architecture. An architecture decision is required.

Secrets must never be stored in Terraform state in plain text, the repository,
GitHub Actions logs or Lambda environment variables.

---

# Dependencies

```text
TICKET-005
```

---

# Scope

## Architecture Decision

Create ADR `docs/decisions/000X-secrets-management.md` comparing:

```text
SSM Parameter Store SecureString (standard tier: free)
Secrets Manager (0.40 USD/secret/month, rotation support)
```

Expected decision: SSM Parameter Store SecureString for cost reasons;
Secrets Manager only where automatic rotation is needed.

## Terraform

- Terraform creates the parameter **names**, IAM permissions and (optionally) a
  KMS key, but not secret values. Values are set out-of-band by an administrator.
- Use `lifecycle { ignore_changes = [value] }` with a placeholder value, so the real
  value never enters Terraform state.

## Runtime Access

- Lambdas read secrets at cold start via SDK and cache them in memory with a TTL (e.g. 5 min).
- IAM: `ssm:GetParameter` on specific parameter ARNs only; `kms:Decrypt` scoped to the key.

## Naming

```text
/tenner/<environment>/<component>/<name>
```

## Documentation

Document how to set and rotate each secret (CLI commands with placeholders).

---

# Testing Requirements

```text
Secret Loader Caching
Loader Failure Handling
No Secret Values In Logs (test with a known marker)
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
ADR
Terraform parameter skeletons and IAM
Secret loader module
Documentation
Tests
```

---

# Validation

```bash
terraform fmt -check

terraform validate

npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- Secrets storage decided and documented
- Secret values never in repo, state, logs or env vars
- Least-privilege access per secret
- Rotation procedure documented
- Tests passing

---

# Definition of Done

- Features requiring secrets can be built safely

---

# Owner Decision (2026-10-05)

**SSM Parameter Store, SecureString, encrypted with the AWS managed key `aws/ssm`** (no cost). Secrets Manager is
not used: the planned secrets (Telegram, VAPID, OAuth, AI keys) belong to third-party services that its rotation
cannot renew, and about 5 secrets would cost ~2 USD per month against a running cost below 0.10 USD. Secrets
Manager stays an option for a single secret that needs automatic rotation. The ADR in `docs/decisions/` is written
when this ticket is implemented.

---

# Out of Scope

- Automatic rotation
- Secrets for CI (handled by GitHub OIDC; no AWS keys)
