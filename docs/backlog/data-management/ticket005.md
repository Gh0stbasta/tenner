# DATA-005: Implement Member Data Erasure

## Type

Backend Feature / Privacy

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Allow a household administrator to erase a former member's personal data
while keeping the household's history consistent.

---

# Background

Completion history is immutable by design. Erasure requests (GDPR Art. 17) must
be resolved without breaking analytics.

Approach: pseudonymize, not delete — replace the member's identifiers in history
with an anonymous placeholder.

---

# Dependencies

```text
HOUSEHOLD-ADMIN-004
SECURITY-013
OPERATIONS-007
```

---

# Scope

## Process

```text
1. Member must be deactivated
2. Admin requests erasure (confirmation by typing the member name)
3. Job:
   - member record: displayName → "Former member", email/channels removed
   - history: completedBy → "ANON-<random>" (consistent per member)
   - notes written by member removed
   - notification preferences, push subscriptions, integration tokens deleted
   - Cognito user deleted
4. Audit event recorded (without the erased personal data)
```

This is the only sanctioned modification of history records. Document the
exception in `docs/architecture.md`.

## Archives and Backups

Document that S3 archives and PITR backups expire per DATA-004 and that erased data
remains there until expiry.

---

# Testing Requirements

```text
Pseudonymization Consistent
Analytics Still Computable
All Personal Fields Removed
Active Member Rejected
Audit Event Without Personal Data
Idempotent Re-Run
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Erasure job
Admin UI action with confirmation
Architecture exception documentation
Tests
```

---

# Validation

```bash
npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- Former member's personal data erased or pseudonymized
- History remains consistent
- Backups/archives behavior documented
- Tests passing

---

# Definition of Done

- Erasure requests can be fulfilled safely

---

# Out of Scope

- Whole-household deletion (FUTURE-003)
