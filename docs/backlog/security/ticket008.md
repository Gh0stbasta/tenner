# SECURITY-008: Harden Software Supply Chain

## Type

CI/CD / Security

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Reduce the risk that a compromised dependency or CI component can modify
the production deployment.

---

# Background

The deployment workflow assumes an AWS role with broad infrastructure permissions.
A compromised third-party GitHub Action could abuse that role.

---

# Dependencies

```text
TICKET-001
TICKET-018
SECURITY-007
```

---

# Scope

## GitHub Actions

```text
Pin all third-party actions to full commit SHAs (Dependabot keeps them updated)
Set top-level `permissions: {}` and grant minimal per-job permissions
id-token: write only on jobs that assume AWS roles
No pull_request_target with checkout of untrusted code
Restrict OIDC trust policy to repository + branch/environment (document required trust policy)
```

## npm

```text
npm ci only (lockfile enforced)
`--ignore-scripts` where feasible; document exceptions
Lockfile changes reviewed (lockfile-lint or equivalent)
```

## Terraform

```text
.terraform.lock.hcl committed
Provider versions constrained
```

## SBOM

Generate an SBOM (CycloneDX) for frontend and backend in the deploy workflow,
stored as a build artifact.

---

# Deliverables

```text
Workflow hardening
npm and Terraform lockfile enforcement
SBOM generation
docs/security.md supply-chain section
```

---

# Validation

- Workflows run successfully after hardening.
- Lint workflows with `actionlint` (added to PR workflow).

---

# Acceptance Criteria

- All actions pinned by SHA
- Minimal workflow permissions
- OIDC trust policy restriction documented
- Lockfiles enforced
- SBOM generated
- actionlint passes

---

# Definition of Done

- CI/CD is resilient against common supply-chain attacks

---

# Out of Scope

- Artifact signing / SLSA provenance level 3 (future consideration)
