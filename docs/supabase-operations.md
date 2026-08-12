# Supabase security remediation runbook

This runbook covers the versioned migration
`supabase/migrations/20260810003928_security_remediation.sql`. The three
retired SQL files in `docs/` must never be applied. A successful local check is
not evidence that a remote project was migrated.

Follow these six gates in order. Gates 1–3 are preparation and
non-production work. Gate 4 is a manual production operation requiring explicit
approval; this document does not authorize or execute production commands.

## 1. Supabase Auth Dashboard

In the Supabase Auth Dashboard, require confirmed email. Enable CAPTCHA for
sign-up, sign-in, and password reset. Set a short JWT expiry, enable
refresh-token rotation and reuse detection, and configure Auth rate limits.
Record the resulting dashboard settings in the release evidence.

## 2. Vercel Environment Variables

Set `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` only in server
environments. Configure AI and YooKassa keys only there as well. Before the
release, confirm the secrets are absent from `js/`, `dist/`, source maps, and
browser network responses. Do not place secret values in client configuration,
committed files, or frontend build variables.

## 3. Non-production

Run the following local-only database checks from the repository root against
the disposable local Docker stack. Do not use `--linked`, a project ref, or a
production connection string.

```bash
supabase start
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  --set ON_ERROR_STOP=1 \
  --file tests/supabase-security.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  --set ON_ERROR_STOP=1 \
  --file docs/supabase-rls-audit.sql
supabase db advisors
node --test tests/*.test.js
npm run build
npm run test:e2e
```

Then apply and verify the versioned migration in a non-production project,
review the read-only audit output, and verify the headers on its URL:

```bash
curl --silent --show-error --head "https://staging.example.invalid" | \
  rg -i "content-security-policy|strict-transport-security|x-content-type-options|referrer-policy|permissions-policy|x-frame-options|cross-origin-opener-policy"
```

Replace only `https://staging.example.invalid` with the real non-production
URL. The initial deployment uses `Content-Security-Policy-Report-Only`; browse
landing, authentication, mock story generation, library, illustrations, and
checkout return. Record observed violations and allow only required sources.
After 48 hours without a functional violation, promote the unchanged policy to
`Content-Security-Policy`, update the header test, and verify the headers again.

## 4. Manual production approval

This is a **manual production operation requiring explicit approval**. It must
be performed only by an authorized operator after gates 1–3 have passed; no
agent or unattended job may execute it. First back up or export the schema and
inspect the linked migration state:

```bash
supabase migration list --linked
```

Apply the approved versioned migration through the controlled Supabase CLI
workflow approved for production. Then rerun the read-only RLS audit SQL and
verify both a non-paid free-account rejection and one safe mock-mode generation.
Archive the backup reference, migration list, audit result, and verification
evidence with the release record.

## 5. Rollback

Disable `GENERATION_API_ENABLED` and `ILLUSTRATION_API_ENABLED` at Vercel first.
Then roll back only the application deployment or configuration. Do not delete
reservation or payment rows. Investigate counts with the read-only audit SQL
before writing a forward corrective migration.

## 6. Monitoring

Alert on `rate_limited`, `quota_exhausted`, `job_in_progress`, provider
failures, release failures, repeated idempotency replays, webhook verification
failures, and daily completions above 20 per active user. Structured logs must
contain only event type, resource kind, truncated reservation ID, HTTP status,
duration, and provider request ID.
