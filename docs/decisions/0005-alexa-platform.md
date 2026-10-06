# ADR 0005: Alexa Skill Platform

- **Status:** Accepted (2026-10-05)
- **Ticket:** ALEXA-001
- **Deciders:** repository owner (Stefan), by asking to implement the Alexa tickets on 2026-10-05 ("dann leg mal
  los mit dem alexa feature"); the options below are the ticket's recommendations. The owner can still veto before
  the skill is activated (no Alexa resource exists until `ALEXA_SKILL_ID` is set).
- **Number:** 0004 is left free for the SECURITY-006 Parameter Store ADR.

## Context

The household uses Echo (Show) devices and speaks German. Tenner should answer by voice, show the day on Echo Show
screens and later push status and reminders (Alexa backlog `docs/backlog/alexa/`). The Alexa Skills Kit (ASK) is
not on the allowed-services list in `docs/architecture.md`.

Constraints (researched 2026-10-05):

- The ASK Lambda trigger exists only in us-east-1, eu-west-1, us-west-2 and ap-northeast-1; Tenner runs in
  eu-central-1. Amazon recommends eu-west-1 for German skills.
- Alexa waits at most 8 seconds for a response.
- A development-stage skill works on all devices of the developer's Amazon account without certification; beta
  tests for other accounts last at most 90 days.
- The Alexa Routines Kit was discontinued on 2026-05-13.

## Considered Options

| Topic | Options | Decision |
|---|---|---|
| Skill backend location | (a) Lambda in eu-west-1 with the ASK trigger; (b) HTTPS endpoint on the existing API Gateway in eu-central-1 with request-signature and certificate verification | **(a)**: no signature/certificate code to get wrong; the trigger checks the skill ID; the cross-region API call (~20–30 ms) is far inside the 8 s budget |
| Data access | (a) the skill calls the Tenner HTTP API with the linked user's token; (b) direct DynamoDB access | **(a)**: reuses validation, authorization, timezone and business rules; no cross-region data permissions; the skill Lambda's role has logs only |
| Skill hosting | (a) self-hosted (Terraform, GitHub Actions); (b) Alexa-hosted skill | **(a)**: Alexa-hosted skills run outside Tenner's AWS account, Terraform and CI |
| Distribution | development stage; beta test; public certification | **Development stage** on the household's Amazon account (no certification, no store listing) |
| Locale | de-DE; additionally en-DE/en-GB | **de-DE only** in this backlog |
| SDK | `ask-sdk-core` (official, Apache-2.0); hand-written request parsing | **`ask-sdk-core`** (+ peer `ask-sdk-model` types): request routing, response builders, interceptors, skill-ID check; ~100 kB bundled, no AWS SDK |
| Skill package deployment | ASK CLI / SMAPI from GitHub Actions; manual console edits | **ASK CLI (SMAPI)** with an LWA refresh token and vendor ID as GitHub secrets; manifest and interaction model are versioned in `alexa/skill-package/` |
| Code location | inside `backend/`; own root folder | **Root folder `alexa/`** as its own npm package (owner requirement) |

## Decision

Add to the allowed services: **Alexa Skills Kit** (custom skill, APL, Reminders, Proactive Events, Data Store) and
the **skill Lambda in eu-west-1** (`tenner-alexa-skill`, logs in eu-west-1). Everything else stays in
eu-central-1. No data is stored in eu-west-1.

All Alexa resources in Terraform are created only when `alexa_skill_id` is set, so the platform can be merged
before the skill exists and before the deploy role has eu-west-1 permissions.

## Consequences

- A second AWS region: provider alias `aws.alexa` (`alexa_region`, default eu-west-1) with the same default tags;
  naming, tagging and budgets apply unchanged. The tag-based Resource Group `Tenner` is regional and does not list
  the eu-west-1 resources.
- The deploy role needs Lambda, IAM and CloudWatch Logs permissions for `tenner-alexa-*` in eu-west-1
  (`alexa/README.md` → "CI Permissions"); the owner applies them.
- CI secrets `ASK_REFRESH_TOKEN` and `ASK_VENDOR_ID` (GitHub) and the variable `ALEXA_SKILL_ID`. These are CI
  credentials; runtime secrets (LWA client secret for Data Store, Proactive Events, ALEXA-007/008) go to Parameter
  Store per SECURITY-006.
- The Amazon developer account, the skill in the developer console and Amazon's terms are outside Terraform; the
  one-time setup is documented in `alexa/README.md`.
- Cost: Lambda and logs stay in the free tier at household volume; the Alexa APIs are free.

## Amendment (2026-10-06, ALEXA-010)

- Invocation name **„tenner board“** (registered by the owner in the developer console).
- The skill stays private: development stage only, never submitted for certification or published; enforced by a
  repository test on workflows and scripts.

## Risks

- Amazon changes or retires Alexa capabilities (as with the Routines Kit) — the skill only uses the core custom
  skill API in ALEXA-001; later features document fallbacks.
- Alexa+ may route or phrase requests differently than classic Alexa; test with both where available.
- The skill-package deployment could not be executed from the development environment; it is verified on the
  first deployment.
