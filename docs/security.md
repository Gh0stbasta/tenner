# Tenner Security Baseline

Summary of the security controls, trust boundaries and residual risks (SECURITY-005, reviewed 2026-10-05).
Details live in the linked tickets, ADRs and `technical-debt.md`.

---

## Trust Boundaries

```text
Internet (anyone)
  │  HTTPS only (CloudFront redirect-to-https; API Gateway is HTTPS-only)
  ├──► CloudFront ──(Origin Access Control)──► S3 frontend bucket (private)
  ├──► Cognito / Google sign-in ──► ID token (60 min), refresh token (30 days, revocable)
  │      └─ Alexa account linking (ALEXA-002): client tenner-alexa (secret held by Amazon) ──► access token
  │         (60 min), refresh token (3,650 days, revocable); the skill Lambda (eu-west-1) calls the API with it
  └──► API Gateway HTTP API (throttled 10 req/s, burst 20)
         │  JWT authorizer: every route except GET /health
         ▼
       Lambda tenner-api (role tenner-api-role)
         │  tenant + user only from the verified household group (cognito:groups)
         ├──► DynamoDB tenner-tenners, tenner-history, tenner-households (keys start with tenantId)
         └──► Cognito group membership (self-assignment, HOTFIX-001)

GitHub Actions ──(OIDC, GitHubActionsDeployRole)──► Terraform state (S3 + DynamoDB lock) and all resources above
```

| Boundary | What protects it |
|---|---|
| Browser → API | Cognito ID token verified by API Gateway (signature, issuer, audience, expiry) |
| Alexa skill → API | Cognito access token of the linked member (audience check via `client_id` = Alexa client); same household-group rules as the browser; skill Lambda invocable only by the Tenner skill ID (ADR 0005) |
| Signed-in user → household data | Exactly one group `household:<tenantId>:<userId>`; each member claimable once (ADR 0002) |
| User → other tenant | Every DynamoDB key and query uses `identity.tenantId`; no client-supplied tenant (SECURITY-004) |
| Internet → S3 | Bucket private, Block Public Access on, bucket policy allows only this CloudFront distribution |
| GitHub → AWS | OIDC trust limited to this repository's `main` and `pull_request` subjects; no long-lived keys |

---

## Controls by Area

| Area | Control | Where / verified by |
|---|---|---|
| Authentication | Google only, PKCE, no passwords, token revocation | `terraform/auth.tf`, `tests/auth.tftest.hcl` |
| Authorization | Household group from token; 401 without claims, 403 without household | `backend/src/auth/identity.ts`, backend tests |
| API cost and abuse | Stage throttling 10 req/s, burst 20 → HTTP 429 | SECURITY-014, `tests/api.tftest.hcl` |
| API access logging | JSON access log in `/tenner/api/access` (request ID, route, status, latency, source IP, user agent); **no headers, tokens or bodies** | `terraform/api.tf` |
| Request size | JSON bodies above 16 KiB → 413 before parsing | `backend/src/validators/validate.ts` (SECURITY-005) |
| Input validation | Strict Zod schemas (unknown fields rejected) for every body and query | `backend/src/validators/` |
| Errors | Clients never see stack traces or storage errors (generic 500) | `backend/src/utils/http.ts` |
| Lambda | Node.js 22 (supported), no secrets in environment variables (only names and IDs), logs retained 30 days | `tests/api.tftest.hcl` |
| DynamoDB | Encryption at rest, point-in-time recovery, deletion protection on all tables | `tests/dynamodb.tftest.hcl` |
| S3 frontend | Private, Block Public Access, SSE-S3, versioning (30-day noncurrent retention), TLS-only policy | `tests/frontend_hosting.tftest.hcl` |
| S3 state | Private, SSE-S3, versioning, TLS-only policy; lock table encrypted with deletion protection | `tests/state_backend.tftest.hcl` |
| CloudFront | HTTPS redirect, CSP (`script-src 'self'`), HSTS, X-Frame-Options, nosniff, referrer policy | `terraform/frontend-hosting.tf` |
| Cognito | Deletion protection, no self sign-up with password, app client cannot write identity attributes | `tests/auth.tftest.hcl` |
| Alexa client (ALEXA-002) | Confidential code-grant client, Google only, scopes `openid tenner/household`, redirect URLs validated to Amazon's account-linking hosts; secret never output or committed; tokens never stored or logged by Tenner | `terraform/auth.tf`, `tests/auth.tftest.hcl`, `alexa/src/tennerApi.ts` |
| Secrets | Google client secret only in GitHub secrets and the encrypted state (TD-021); nothing in the repository | README → "Google Sign-In" |
| Runtime secrets (SECURITY-006) | SSM Parameter Store SecureString (`aws/ssm`), set out of band, read per exact ARN, cached 5 min, never in state, env vars or logs | ADR 0004, `backend/src/secrets/`, README → "Secrets" |
| Dependencies | Dependabot; CI fails on high/critical production vulnerabilities | SECURITY-007 |
| Deployment check | Smoke tests incl. "API requires login" after every deploy | OPERATIONS-006 |
| Tags | Mandatory tags enforced on every plan | `scripts/check_tags.py` |

---

## IAM Review (2026-10-05)

Checklist applied to every policy: actions limited to what the code calls; resources limited to Tenner ARNs;
no `*` action; every wildcard resource justified.

### `tenner-api-role` (Lambda, managed in `terraform/iam.tf`)

| Policy | Actions | Resources | Review |
|---|---|---|---|
| `-logging` | `logs:CreateLogStream`, `logs:PutLogEvents` | `/tenner/api` log group, `:log-stream:*` | ✅ Wildcard on stream names is required (Lambda creates streams per container) |
| `-dynamodb` | `GetItem`, `PutItem`, `UpdateItem`, `Query` | all Tenner tables and their indexes | ✅ **SECURITY-005 removed `Scan` and `DeleteItem`** (never used; deletes are soft deletes). Index wildcard `/index/*` covers the GSIs only |
| `-dynamodb` | `BatchGetItem` | `tenner-tenners` | ✅ Title lookup for history (TICKET-020) |
| `-cognito` | `AdminAddUserToGroup`, `AdminRemoveUserFromGroup`, `AdminListGroupsForUser`, `ListUsersInGroup`, `CreateGroup` (HOUSEHOLD-ADMIN-001) | Tenner user pool | ⚠️ IAM cannot restrict the user or group; the code only adds the caller to one free household group (TD-023) |
| Trust | `sts:AssumeRole` | `lambda.amazonaws.com` | ✅ |

### `GitHubActionsDeployRole` (managed outside this repository)

The permission list is in README → "CI Permissions". Known broad grants, accepted for now:

- `apigateway:*` on the Tenner API and `cognito-idp:*` on the Tenner user pool (resource-scoped).
- The PR workflow uses the same role for `terraform plan` (TD-008).

Review it in the IAM console against the README list whenever a ticket adds resource types.

---

## Manual Verifications

These are outside Terraform or need the live system. Run them in AWS CloudShell (`eu-central-1`).

1. **Account-level S3 Block Public Access.** Terraform does not manage it, because the AWS account may hold
   other projects and the setting applies to every bucket. Verify:

   ```bash
   aws s3control get-public-access-block --account-id "$(aws sts get-caller-identity --query Account --output text)"
   ```

   All four flags should be `true`. If the account is used only for Tenner, enable them in the S3 console
   ("Block Public Access settings for this account").

2. **Throttling (SECURITY-014).** A short burst of 100 requests against `/health` should return some `429`:

   ```bash
   API=$(aws apigatewayv2 get-apis --query "Items[?Name=='tenner-api-gateway'].ApiEndpoint | [0]" --output text)/prod
   seq 100 | xargs -P 50 -I{} curl -s -o /dev/null -w "%{http_code}\n" "$API/health" | sort | uniq -c
   ```

3. **Unauthenticated API access is rejected.** Covered automatically by the smoke tests after every deploy.

---

## Residual Risks

| Risk | Reference |
|---|---|
| CloudFront default certificate allows TLS 1.0/1.1 handshakes (custom domain needed for TLS 1.2+) | TD-025, TICKET-022 |
| Unclaimed household members can be claimed by strangers until both members have signed in | TD-020 |
| A deactivated member's existing ID token stays valid up to 60 minutes (group removal applies at the next refresh) | HOUSEHOLD-ADMIN-004 |
| API Lambda can change Cognito group membership | TD-023 |
| Tokens in `localStorage` (XSS would expose them; mitigated by CSP) | ADR 0001 |
| Browser push: push services (Google, Mozilla, Apple) see device endpoints and timing; payloads are end-to-end encrypted (RFC 8291) and contain only titles and estimates. The VAPID private key lives in Parameter Store; endpoints are never logged | NOTIFICATION-009 |
| Offline cache: household Tenner data in `localStorage` for up to 7 days or until logout (readable on an unlocked device; same XSS exposure as the tokens) | MOBILE-003, `frontend/README.md` |
| Offline completions carry a client-chosen `completedAt` (device clock; the backend rejects future and out-of-order times, so it can only move a completion back to the last one) | MOBILE-004 |
| Google client secret in Terraform state | TD-021 |
| Throttling is global, not per client | TD-016 |
| No Lambda reserved concurrency | TD-014 |
| PR plans run with the deploy role | TD-008 |
| No WAF, GuardDuty or Security Hub (cost) | SECURITY-005 out of scope |
| The Alexa link has full member rights (no per-route scopes while the web app uses ID tokens); a linked Alexa account stays valid up to 10 years unless unlinked or the member's group is removed | TD-035 |
