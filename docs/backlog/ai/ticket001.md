# AI-001: Establish AI Foundation

## Type

Architecture / Backend

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Create a safe, cost-controlled foundation for all AI features: provider decision,
LLM client, prompt management, guardrails, budgets and evaluation.

---

# Background

The architecture lists an "AI Assistant" as a future idea. AI features must respect:

```text
Cost Awareness      → strict token and spend limits
Simplicity First    → AI assists, deterministic logic stays the source of truth
Privacy             → minimal household data sent to a model provider
```

Model access options:

```text
A. Claude via Amazon Bedrock   (IAM auth, no API key, data stays in AWS account context)
B. Claude via Anthropic API    (API key via SECURITY-006)
```

Neither Bedrock nor an external LLM API is in the allowed-service list → ADR required.

---

# Dependencies

```text
SECURITY-006
SECURITY-013
OBSERVABILITY-003
```

---

# Scope

## Architecture Decision

ADR `docs/decisions/000X-ai-provider.md`:

```text
Provider (Bedrock vs Anthropic API), region availability (eu-central-1 or cross-region inference)
Default model: a small, fast Claude model (e.g. Claude Haiku 4.5) for cost; larger model only where justified
Data processing terms and privacy
Cost estimate per feature
```

Model IDs must be configuration (Terraform variable / env var), never hardcoded in code.

## LLM Client Module

```text
backend/src/ai/

├── client.ts        (provider adapter, timeouts, retries)
├── prompts/         (versioned prompt templates)
├── schemas/         (JSON output schemas, validated with zod or equivalent)
├── guardrails.ts    (input limits, output validation, PII stripping)
└── budget.ts        (usage tracking and limits)
```

## Structured Output

All AI features must request structured output (tool use / JSON schema) and validate it.
Invalid output → feature degrades gracefully (no AI result), never a 500.

## Guardrails

```text
Max input tokens per request (config)
Max output tokens per request (config)
Only necessary fields sent (titles, categories, frequencies, dates — no notes, no emails)
Prompt injection awareness: user-provided text is data, delimited and never executed as instructions
AI never writes data directly: it proposes, the user confirms (except explicitly opted-in automations)
```

## Budget

```text
Monthly spend limit per household (default 2 USD, config)
Per-user daily request limit (default 50)
Usage persisted (tokens in/out per feature per day)
When exceeded: AI features disabled with a friendly message until next period
```

## Feature Flags

Each AI feature can be enabled/disabled per household in Settings ("AI features" section).
Default: off, with clear explanation of data sent to the provider.

## Evaluation

`backend/src/ai/evals/` with fixture-based tests per feature (golden examples),
runnable on demand (`npm run eval:ai`), not in regular CI (cost).

---

# Testing Requirements

```text
Schema Validation Of Model Output
Invalid Output Degrades Gracefully
Budget Enforcement
Rate Limit Enforcement
PII Stripping
Timeout Handling
Feature Flag Off
```

Unit tests use a mocked provider. Coverage for new code: 80% minimum.

---

# Deliverables

```text
ADR
AI module
Budget tracking storage
Settings AI section
IAM permissions (Bedrock) or secret (API key)
Eval harness
Documentation (docs/ai.md)
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

- Provider decision documented
- Model configurable, not hardcoded
- Structured, validated output enforced
- Budget and rate limits enforced
- Minimal data sent; documented
- Features opt-in per household
- Tests passing

---

# Definition of Done

- AI features can be built safely and affordably

---

# Out of Scope

- Any concrete AI feature (AI-002 onward)
- Fine-tuning or self-hosted models
