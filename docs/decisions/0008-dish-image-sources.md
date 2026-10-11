# ADR 0008: Images for Dishes Without a Photo

- **Status:** Accepted (2026-10-10)
- **Ticket:** FOOD-024 (evaluation; follows FOOD-011 dish photos)
- **Deciders:** repository owner (Stefan): „adr 0008 - platzhalter bleiben“

## Context

Since FOOD-011 dishes can have a family photo (private S3 bucket behind CloudFront). Dishes without a photo show a
placeholder per category (emoji on a soft background). The owner's breakdown of FOOD-011 also named stock images and
AI-generated images. Both need a service outside the allowed list (`docs/architecture.md` → "Serverless Only").

## Considered Options

| Option | Licence and attribution | Privacy | Cost per month | Effort | New dependency |
|---|---|---|---|---|---|
| A. Placeholders per category (built in FOOD-011) | own content, nothing to show | nothing leaves AWS | 0 € | none | none |
| B. Stock image picked in the editor (Unsplash or Pexels API), copied into the image bucket | provider terms; Unsplash wants the photographer named and a download ping; Pexels asks for attribution | dish name and the browser's IP go to the provider | 0 € (free tiers, rate limits ~50 requests/h on Unsplash demo keys) | medium: search UI, server-side copy, attribution text, key in Parameter Store | external API, API key, CSP `connect-src`/`img-src` for previews |
| C. AI image per dish via an Amazon Bedrock image model (EU region), generated once on request, stored in the bucket, labelled „KI-generiert“ | generated content; provider terms on generated images | dish name goes to Bedrock (stays in AWS, no training on inputs) | ≈ 0.04–0.08 € per image; 60 dishes ≈ 3–5 € once | medium: Bedrock IAM, model access request, budget cap, labelling, error handling | Bedrock (not on the allowed-services list) |

What the family gains: photos make the plan and the Echo Show friendlier. With ~60 dishes the family can take photos
over a few weeks of cooking; B and C mainly help on day one.

## Recommendation

**A — keep the category placeholders, encourage own photos.** No new service, no licence or attribution duty, no
cost, nothing leaves AWS. If, after some weeks, many dishes still have no photo, **C** is the better follow-up than B
(stays in AWS, no attribution UI, one-time cost of a few euros), but it needs its own ADR for Bedrock and a budget cap.

## Decision

**A — the category placeholders stay.** No stock or AI images; families add their own photos (FOOD-011). No
follow-up ticket. B or C need a new ADR if the wish comes back.

## Consequences

- A: nothing changes; FOOD-024 closes with this ADR accepted.
- B/C: a new external dependency or AWS service, CSP and IAM changes, cost alarm; the release stays AI-free until the
  follow-up ticket is built.

## Risks

- B: provider terms can change; attribution must stay visible wherever the image is shown (app, widget).
- C: generated images can look wrong for German home dishes; a „neu erzeugen“ action and the family photo always
  win.
