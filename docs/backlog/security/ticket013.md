# SECURITY-013: Create Threat Model and Privacy Review

## Type

Security / Documentation

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Create a lightweight threat model and privacy review for Tenner to guide future
security work and to prepare for possible multi-household or public use.

---

# Background

Tenner processes personal data (names, email addresses, Telegram chat IDs,
household routines). Integrations (Strava, Garmin, calendars) will add health
and location-adjacent data. GDPR applies when data of other people is processed.

---

# Dependencies

```text
SECURITY-001 to SECURITY-005
```

---

# Scope

## Threat Model (STRIDE)

For components:

```text
SPA / CloudFront
API Gateway + Lambda
DynamoDB
Notifier Lambda
Integration webhooks
CI/CD pipeline
```

Document assets, trust boundaries, threats, existing mitigations, residual risks.

## Privacy Review

```text
Data inventory (what personal data, where stored, retention)
Data minimization opportunities
Third-party processors (Telegram, email provider, AI provider)
Data subject rights (export → DATA-001, erasure → DATA-005)
```

## Outputs

```text
docs/threat-model.md
docs/privacy.md
New tickets or technical-debt entries for unmitigated risks
```

---

# Deliverables

```text
Threat model document
Privacy document
Follow-up tickets
```

---

# Validation

Review by the repository owner.

---

# Acceptance Criteria

- Threat model covers all components
- Data inventory complete
- Residual risks documented with owners
- Follow-up tickets created

---

# Definition of Done

- Security and privacy risks are known and tracked

---

# Out of Scope

- External audit or certification
