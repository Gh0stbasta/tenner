# FOOD-024: Evaluate Stock and AI-Generated Dish Images

## Type

Evaluation / Architecture

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Decide whether dishes without a photo should get a stock image or an AI-generated image, and how, without
licence, privacy or cost surprises.

---

# Background

Owner breakdown FOOD-011 lists photo, stock image and AI-generated image. Photo upload is built in FOOD-011 with
allowed services only. Stock images need an external API (licence, attribution, API key); AI images need an image
model (Amazon Bedrock or an external API). Both need an ADR; release 2.0 is AI-free.

---

# Dependencies

```text
FOOD-011
```

---

# Scope

## Options

| Option | Licence and attribution | Cost | New dependency |
|---|---|---|---|
| A. Category illustrations only (FOOD-011 placeholders) | own | none | none |
| B. Stock images (e.g. Unsplash or Pexels API) picked in the editor, copied to the bucket | per provider terms, attribution shown | free tiers | API key, external call |
| C. AI image per dish via Amazon Bedrock image model, generated once on request, stored in the bucket | generated content, labelled „KI-generiert“ | cents per image | Bedrock (ADR) |

## Output

- ADR with decision; if go: implementation ticket (editor action „Bild vorschlagen“, storage in the existing
  bucket, labelling, budget cap).

---

# Deliverables

```text
ADR with decision
Follow-up ticket if go
```

---

# Acceptance Criteria

- [ ] Options compared on licence, privacy, cost and effort
- [ ] Decision documented
- [ ] If go: follow-up ticket created

---

# Definition of Done

- [ ] Evaluation completed
- [ ] Documentation updated
- [ ] Acceptance criteria verified
- [ ] Git commit created

---

# Assumptions

- Only dish names are sent to an image service, never profile data.

---

# Out of Scope

- Implementation.

---

# Evaluation Status

Prepared (2026-10-10), **waiting for the owner's decision**.

- Options A (placeholders, built in FOOD-011), B (stock images) and C (AI images via Bedrock) compared on licence,
  privacy, cost and effort in [ADR 0008](../../../decisions/0008-dish-image-sources.md) (status Proposed).
- Recommendation: A now; C later if many dishes still have no photo.
- Remaining: the owner's decision; if B or C, the follow-up ticket. The acceptance criteria „Decision documented“ and
  „If go: follow-up ticket created“ are open until then.
