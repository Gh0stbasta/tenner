# ALEXA-001: Establish Alexa Platform Foundation

## Type

Platform / Infrastructure

---

## Priority

High

---

## Phase

V2

---

## Goal

Create the foundation every Alexa ticket builds on: a German (de-DE) custom skill "Tenner" with its interaction
model and manifest in the repository, a skill Lambda deployed by Terraform, automated skill deployment in CI, and
an architecture decision that admits the Alexa Skills Kit as a service.

After this ticket, "Alexa, öffne Tenner" on a household Echo device reaches Tenner's skill Lambda and gets a
spoken welcome. No household data is read yet (ALEXA-002 links accounts).

---

# Background

Tenner should become the household information hub (Alexa backlog,
`docs/backlog/alexaSkill/alexaFoundation.md`). The household uses Echo Show devices and speaks German; the web app
is German. The Alexa Skills Kit (ASK) is not on the allowed-services list in `docs/architecture.md`, so an ADR is
required before any Alexa resource is created (same rule as TD-004 and `docs/roadmap.md` → "Cross-Cutting
Decisions").

Facts that shape the design (researched 2026-10-05; re-check the linked documentation before implementing):

- The Lambda trigger for the Alexa Skills Kit exists only in us-east-1, eu-west-1, us-west-2 and ap-northeast-1;
  Amazon recommends **eu-west-1 (Ireland)** for German skills. Tenner runs in **eu-central-1**, which the trigger
  does not support.
- Alexa waits at most **8 seconds** for a skill response.
- A skill in the **development stage** works on every Echo device registered to the developer's Amazon account
  without certification. Other Amazon accounts can be invited to a **beta test of at most 90 days** (not
  extendable).
- The Alexa Routines Kit is no longer available since 2026-05-13; skills must not depend on it.
- Alexa+ is in early access in Germany (since April 2026); classic custom skills must be tested with both the
  classic assistant and Alexa+ where available.

---

# Dependencies

```text
TICKET-002   Terraform foundation
TICKET-005   API foundation
SECURITY-002 Cognito user pool (used from ALEXA-002 on)
```

---

# Scope

## Architecture Decision (first deliverable)

Create `docs/decisions/0005-alexa-platform.md` (next free number) covering:

| Topic | Options | Recommendation |
|---|---|---|
| Skill backend location | (a) Lambda in eu-west-1 with the ASK trigger, (b) HTTPS endpoint on the existing API Gateway (eu-central-1) with request-signature verification | **(a)**: no signature/certificate code, the trigger checks the skill ID; cross-region call to the API (~20–30 ms) is far inside the 8 s budget |
| Data access | (a) skill Lambda calls the Tenner HTTP API with the linked user's token, (b) direct DynamoDB access | **(a)**: reuses validation, authorization, timezone and business rules; no cross-region DynamoDB permissions |
| Skill hosting | (a) self-hosted (Terraform), (b) Alexa-hosted skill | **(a)**: Alexa-hosted skills run outside Tenner's account, Terraform and CI |
| Distribution | development stage on the household's Amazon account; beta test only for extra accounts | development stage (no certification, no public listing) |
| Locale | de-DE first; en-DE/en-GB later | de-DE only in this backlog |

The ADR also adds "Alexa Skills Kit (custom skill, APL, Reminders, Proactive Events, Data Store)" and the
eu-west-1 skill Lambda to the allowed services, and records the cost (Lambda free tier; Alexa APIs free).

## Repository Layout

**Owner requirement (2026-10-05):** all Alexa skill code and assets live in their own top-level folder `alexa/` in
the repository root, next to `backend/`, `frontend/` and `terraform/`. It is a separate npm package with its own
`package.json`, lockfile, lint/test setup and README; it does not live inside `backend/` or `frontend/`. Terraform
for the skill stays in `terraform/` (one state), CI jobs run in `alexa/` like the existing ones in `backend/` and
`frontend/`, and Dependabot gets an `npm` entry for `/alexa`. Later Alexa tickets (APL documents, widget packages)
add their files under `alexa/` only.

```text
alexa/                                      repository root, next to backend/ and frontend/
├── skill-package/
│   ├── skill.json                          manifest: de-DE, custom skill, APL interface, permissions
│   └── interactionModels/custom/de-DE.json invocation name, intents, slots, samples
├── src/                                    skill Lambda (TypeScript, ask-sdk-core)
│   ├── index.ts                            handler + request routing
│   ├── handlers/                           one file per intent (LaunchRequest, Help, Stop, Fallback, ...)
│   ├── tennerApi.ts                        typed client for the Tenner HTTP API (ALEXA-002 on)
│   └── speech.ts                           German response texts (central, testable)
├── tests/
├── package.json, tsconfig.json, eslint config  (same conventions as backend/)
└── README.md
```

`ask-sdk-core` (official Alexa SDK, Apache-2.0) is the only new runtime dependency; justify it in the ADR
(request parsing, response builders, interceptors). Bundle with esbuild like `backend/`.

## Interaction Model (de-DE)

- Invocation name: `tenner`. One-word invocation names may be rejected for published skills; development stage
  accepts it. If the console rejects it, use `mein tenner` and document it.
- Built-in intents: `AMAZON.HelpIntent`, `AMAZON.StopIntent`, `AMAZON.CancelIntent`, `AMAZON.FallbackIntent`,
  `AMAZON.NavigateHomeIntent`.
- Launch response: „Willkommen bei Tenner. Frag mich zum Beispiel: Was ist heute fällig?“
- Every later intent is added by its ticket; this ticket ships the skeleton and a test harness.

## Infrastructure (Terraform)

- Provider alias `aws.alexa` for region `var.alexa_region` (default `eu-west-1`), same default tags.
- `aws_lambda_function.alexa_skill` (Node.js 22, arm64, 256 MB, **timeout 7 s**), log group with 30-day
  retention, IAM role with logs only (API access is via HTTPS with the user's token).
- `aws_lambda_permission` for principal `alexa-appkit.amazon.com` with `event_source_token = var.alexa_skill_id`
  (only Tenner's skill may invoke the function).
- Environment: `TENNER_API_BASE_URL` (from the existing API output), `LOG_LEVEL`.
- Outputs: `alexa_skill_lambda_arn`.

## Skill Creation and Deployment

- One-time manual step (documented, external): create the skill "Tenner" in the Alexa developer console under the
  household's Amazon developer account; note the skill ID and vendor ID; set `var.alexa_skill_id`.
- CI (`.github/workflows/deploy.yml`): after Terraform, deploy the skill package (manifest + interaction model)
  with ASK CLI (`ask deploy --target skill-metadata`) or SMAPI, then wait for the interaction model build.
- CI credentials: an LWA refresh token for SMAPI (`ASK_REFRESH_TOKEN`), plus `ASK_VENDOR_ID` and the LWA client,
  as GitHub Actions secrets. These are CI secrets (SECURITY-006 covers runtime secrets only). The manifest's
  endpoint is filled from the Terraform output at deploy time; never hardcode account IDs.
- PR workflow: lint, typecheck, unit tests and `ask smapi validate-skill`-style checks without deploying.

## Deploy Role (external change, owner)

The deploy role needs: Lambda, IAM (role for the skill Lambda), CloudWatch Logs in eu-west-1 for
`tenner-alexa-*` resources. Document the exact statements in README → "CI Permissions"; the owner applies them.

---

# Architecture Considerations

- **Latency:** 8 s budget per request. Cold start (~300 ms) + API call (~100–300 ms) is fine; keep the Lambda small
  (no AWS SDK in the bundle unless needed).
- **Security:** the ASK trigger's skill-ID check is the request authentication. The Lambda holds no household data
  and no long-lived secrets in this ticket.
- **Region:** eu-west-1 is a second region for Tenner; tags, naming (`tenner-alexa-skill`) and budgets apply
  unchanged. No data is stored in eu-west-1.
- **Testing:** handlers are pure functions of the request envelope; unit-test them with recorded request JSON.
- **Cost:** Lambda and logs stay in the free tier at household volume.

---

# Deliverables

```text
ADR docs/decisions/0005-alexa-platform.md
Root folder alexa/ as its own npm package (skill package, Lambda skeleton, tests, README), Dependabot entry
Terraform: provider alias, Lambda, permission, outputs, tests
CI: build/test in PRs, skill deployment on main
Documentation: README (setup, manual steps, CI permissions), architecture.md
```

---

# Testing Requirements

```text
LaunchRequest Response
Help / Stop / Cancel / Fallback
SessionEndedRequest Handling
Unknown Intent Handling
Response Within Timeout (handler has no network call yet)
Terraform Tests (provider alias, permission with skill ID, timeout < 8 s)
Interaction Model JSON Valid
```

Coverage for new code: 80% minimum.

---

# Validation

```bash
terraform fmt -check
terraform test
npm run lint && npm run build && npm test   # in alexa/
```

Manual: „Alexa, öffne Tenner“ on a household Echo Show answers with the welcome text (also with Alexa+ if enabled).

---

# Acceptance Criteria

- ADR accepted by the owner and allowed services updated
- All Alexa code lives in the root folder `alexa/` (own package), not in `backend/` or `frontend/`
- Skill package and Lambda deploy through GitHub Actions
- Only the Tenner skill can invoke the Lambda
- „Alexa, öffne Tenner“ works on a household device
- Tests passing

---

# Definition of Done

- The Alexa platform can be extended intent by intent without further setup
- Feature deploys through GitHub Actions

---

# Out of Scope

- Account linking and any household data (ALEXA-002)
- Voice workflows (ALEXA-003 – 005), visuals (ALEXA-006, 007), notifications (ALEXA-008)
- Publishing the skill in the Alexa Skills Store / certification
- Other locales than de-DE
