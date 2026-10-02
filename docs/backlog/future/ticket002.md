# FUTURE-002: Harden Multi-Tenant Architecture

## Type

Architecture (Postponed)

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Prepare the platform to safely host many unrelated households with strong tenant
isolation, fair resource usage and per-tenant operations.

---

# Background

Tenner uses a pooled model (shared tables, `tenantId` partition key). This is
appropriate and cheap, but isolation relies entirely on application code.

Postponed until public availability (FUTURE-003) is pursued.

---

# Dependencies

```text
FUTURE-001
SECURITY-004
```

---

# Scope

- Defense in depth: IAM condition `dynamodb:LeadingKeys` scoped to the caller's tenant via
  session tags (tenant-scoped credentials per request), so a code bug cannot read other tenants.
- Per-tenant throttling and quotas (Tenners, members, AI budget).
- Hot partition analysis (tenant = partition key) and mitigation if needed.
- Per-tenant data export/deletion operations.
- Tenant-aware metrics and cost attribution.
- Automated cross-tenant access tests in CI.

---

# Deliverables

```text
ADR (isolation model)
Tenant-scoped credentials
Quotas
Isolation test suite
```

---

# Acceptance Criteria

- Tenant isolation enforced at IAM level, not only in code
- Quotas prevent noisy neighbors
- Isolation tests in CI

---

# Definition of Done

- The platform is safe for many independent households

---

# Out of Scope

- Silo model (separate tables/accounts per tenant)
