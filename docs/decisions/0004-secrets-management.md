# ADR 0004: Secrets Management with SSM Parameter Store

- **Status:** Accepted (2026-10-05, owner decision in SECURITY-006; ADR written 2026-10-06)
- **Ticket:** SECURITY-006
- **Deciders:** repository owner (Stefan): „na dann entscheidung parameter store“

## Context

Upcoming features need runtime secrets: the Login-with-Amazon (LWA) client of the Alexa skill for the Data Store,
Proactive Events and Reminders APIs (ALEXA-007, ALEXA-008), later Telegram, VAPID, OAuth and AI keys. Secrets must
never be stored in the repository, Terraform state, GitHub Actions logs or Lambda environment variables. Neither
SSM Parameter Store nor Secrets Manager is on the allowed-services list.

## Considered Options

| Option | Cost | Assessment |
|---|---|---|
| A: SSM Parameter Store, SecureString, AWS managed key `aws/ssm` | standard tier free (up to 10,000 parameters, standard throughput) | encrypted, IAM per parameter ARN, no rotation |
| B: Secrets Manager | 0.40 USD per secret and month + API calls | rotation only for AWS-native credentials; third-party tokens cannot be rotated by it |
| C: Lambda environment variables (encrypted) | free | visible in the console and in Terraform state; rejected |

## Decision

**Option A.** Add "SSM Parameter Store (SecureString, `aws/ssm`)" to the allowed services. Secrets Manager stays an
option for a single secret that needs automatic rotation.

| Topic | Decision |
|---|---|
| Naming | `/tenner/<environment>/<component>/<name>`, e.g. `/tenner/prod/alexa/lwa-client-secret` |
| Who creates values | an administrator, out of band, with `aws ssm put-parameter --type SecureString` (README → "Secrets") |
| Terraform | knows only the **names**: IAM `ssm:GetParameter` on the exact parameter ARNs and the names as Lambda configuration. It does **not** manage `aws_ssm_parameter` resources: a refresh of a managed parameter reads the current value into the state (also with `ignore_changes`), which would put the secret into the state file |
| Encryption | AWS managed key `aws/ssm`; reading with decryption needs no extra KMS permission in the role for this key |
| Runtime | Lambdas read at first use with `WithDecryption` and cache in memory for 5 minutes (`backend/src/secrets/`); the placeholder value `SET-OUT-OF-BAND` and empty values are treated as "not set" |
| Logging | only parameter names and error names, never values |

## Consequences

- One manual step per secret (documented with placeholder commands); rotation = `put-parameter --overwrite`, picked
  up within 5 minutes by warm Lambdas.
- Parameters are not part of the Terraform plan, so the tag check does not cover them; the README command sets the
  mandatory tags.
- A missing parameter fails only the feature that needs it (the loader raises `SecretUnavailableError`), not the
  whole Lambda.
- Cost: 0 USD (standard parameters, standard throughput).

## Risks

- Manual values can be forgotten: features log "secret unavailable" and skip their work; the runbook lists each
  secret.
