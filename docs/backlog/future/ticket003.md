# FUTURE-003: Evaluate Public SaaS Offering

## Type

Product Strategy (Postponed)

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Decide whether and how Tenner could be offered publicly, and capture the required work.

---

# Background

Tenner is designed for one household. Offering it publicly changes requirements
for security, privacy (GDPR controller duties, privacy policy, DPA with processors),
operations (support, uptime), cost (free tier limits) and legal (terms, imprint).

---

# Dependencies

```text
FUTURE-001
FUTURE-002
SECURITY-013
DATA-005
```

---

# Scope

## Evaluation

```text
Target users and value proposition
Cost model at 100 / 1,000 / 10,000 households
Required compliance work (GDPR, imprint, terms, cookie/consent)
Security uplift (WAF, GuardDuty, pen test, abuse prevention)
Support and operations model
Go / no-go decision
```

## If Go

Create tickets for: self-service sign-up, email verification, account deletion,
landing page, legal pages, WAF, abuse protection, billing (FUTURE-008).

---

# Deliverables

```text
Evaluation document
Decision record
Follow-up tickets (if go)
```

---

# Acceptance Criteria

- All evaluation areas covered
- Decision documented

---

# Definition of Done

- The SaaS question is answered with evidence

---

# Out of Scope

- Implementation
