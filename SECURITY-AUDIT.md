# Security remediation status record

## Verification state

The findings below are **implemented, pending non-production verification**.
This is an implementation-status record, not evidence that the migration has
been applied to staging or production. The local database release gate remains
blocked because the required Docker image pull did not complete; no remote
Supabase, Vercel, or production command was run for this release.

- Migration name: `supabase/migrations/20260810003928_security_remediation.sql`
- Test results: blocked — local database reset, SQL contract, and advisor checks remain pending; do not record a pass until they complete.
- Staging URL: blocked — not recorded until the non-production deployment is verified.
- Deploy timestamp: blocked — no deployment timestamp recorded.
- Reviewer: blocked — awaiting security review after non-production verification.

## Findings

### SEC-001 — Authoritative image quota and reservation

Status: implemented, pending non-production verification.

### SEC-002 — Atomic story quota reservation before provider work

Status: implemented, pending non-production verification.

### SEC-003 — Browser-stored refresh-token exposure

Status: risk reduced; BFF cookie migration remains separate. CSP and Supabase
session controls reduce exposure, but client-side sessions remain part of the
approved Supabase-only architecture. Non-production verification is pending.

### SEC-004 — Browser security headers and clickjacking protection

Status: implemented, pending non-production verification.

### SEC-005 — Versioned RLS, Storage, and cross-user isolation controls

Status: implemented, pending non-production verification.

### SEC-006 — Server-only story finalisation and current-entitlement checks

Status: implemented, pending non-production verification.
