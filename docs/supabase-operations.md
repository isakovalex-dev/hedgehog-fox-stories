# Supabase security remediation runbook

This runbook covers every timestamped migration in `supabase/migrations/`, in
timestamp order, including
`*_atomic_image_finalization.sql` (currently
`20260813025626_atomic_image_finalization.sql`). The three retired SQL files in
`docs/` must never be applied. A successful local check is not evidence that a
remote project was migrated.

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
SUPABASE_LOCAL_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  bash tests/supabase-concurrent-reservation.sh
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  --set ON_ERROR_STOP=1 \
  --file docs/supabase-rls-audit.sql
supabase db advisors
node --test tests/*.test.js
npm run build
npm run test:e2e
```

The SQL contract and two-session reservation runner must pass and their output
must be archived as release evidence. Also archive the output of the
`public.finalize_image_generation` atomic image finalizer: successful
`completed`, its `idempotency_replayed` retry, and the rejected
`reservation_expired` and `page_changed` cases from `tests/supabase-security.sql`.
`SUPABASE_LOCAL_DB_URL` must point only to the local or other disposable
non-production database initialized for this gate. Never set it to a linked
production database or a production connection string.

If the local Docker lifecycle is unstable, this gate remains pending: do not
promote the release gate and do not use a remote, staging, or production project
as a substitute for the local checks. Record the exact lifecycle failure and
repeat the local gate only after the disposable stack is stable.

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
failures, and daily completions above 20 per active user. Successful illustration
logs must contain only event type, resource kind, truncated reservation ID, HTTP
status, duration, and provider request ID. Illustration lifecycle failure logs
contain only the event type and the scalar `finalizationState` classification.

## Isolated Vercel Preview (staging only)

1. In Vercel open the project, then **Settings → Environment Variables**.
2. Create or edit variables for the **Preview** environment and branch
   `codex/security-remediation` only. Do not edit Production variables.
3. Set `SUPABASE_URL` to `https://opcnhhujyckmccvvpihc.supabase.co`.
4. Copy `SUPABASE_ANON_KEY` and `SUPABASE_SECRET_KEY` only from **Supabase
   staging → Project Settings → API Keys**. Mark the secret key as Sensitive.
   Never paste either key into Git, chat or source files.
5. Set exactly: `PAYMENTS_ENABLED=false`, `AI_GENERATION_ENABLED=false`,
   `IMAGE_GENERATION_ENABLED=false`.
6. Do not add `YOOKASSA_*`, `PAYMENT_WEBHOOK_SECRET`, `AI_API_KEY`,
   `OPENAI_IMAGE_API_KEY` or other provider credentials to Preview.
7. Deploy only without `--prod`, check the resulting Preview URL, then inspect
   Vercel error logs. Do not promote this deployment.
