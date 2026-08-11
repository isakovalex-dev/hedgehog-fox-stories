## Local database verification

This is the database release gate for the versioned migration
`supabase/migrations/20260810003928_security_remediation.sql`. Run it from the
repository root only against the disposable local Docker stack. Do not use
`--linked`, a project ref, or a production connection string.

```bash
supabase start
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  --set ON_ERROR_STOP=1 \
  --file tests/supabase-security.sql
```

Then inspect the same local database with the current audit query:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  --set ON_ERROR_STOP=1 \
  --file docs/supabase-rls-audit.sql
```

The commands target only the local Docker database. A successful local gate is
not evidence that a remote project was migrated. Apply the versioned migration
to a non-production project first, review the audit output there, and obtain
explicit approval before any production migration. This runbook never
authorizes applying the retired SQL files under `docs/`.

## CSP staging rollout

The initial non-production deployment sends
`Content-Security-Policy-Report-Only`. Before enforcing it, browse the landing
page, authentication, story generation mock mode, library, illustration display,
and checkout return route. Record every Report-Only CSP violation in browser
DevTools and add only an explicitly observed, required source. Do not add a
wildcard source or `unsafe-inline` to `script-src`.

After 48 hours without a functional violation, replace the
`Content-Security-Policy-Report-Only` key in `vercel.json` with
`Content-Security-Policy`, keeping its value unchanged. Update
`tests/security-headers.test.js` to require the enforced header and to reject
the Report-Only header before deploying the enforced policy.

Verify headers on the non-production URL before and after promotion:

```bash
curl --silent --show-error --head "https://staging.example.invalid" | \
  rg -i "content-security-policy|strict-transport-security|x-content-type-options|referrer-policy|permissions-policy|x-frame-options|cross-origin-opener-policy"
```

Replace only `https://staging.example.invalid` with the real non-production URL.
