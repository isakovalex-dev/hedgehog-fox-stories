# Operational Audit

This document tracks the remaining checks before broader public sharing.

## Current Status

Historical evidence (pre-security-remediation migration):

- public site opens on HTTPS;
- manual browser checks were reported as passed on 2026-06-26;
- frontend does not contain real AI, YooKassa, or Supabase service role secrets;
- Supabase RLS is enabled on `stories`, `story_pages`, `story_likes`, `subscriptions`, and `generation_usage`;
- Supabase RLS policies exist on `stories`, `story_pages`, `story_likes`, `subscriptions`, and `generation_usage`;
- fresh-account generation limits were reported as passed on 2026-07-12;
- Vercel logged a successful `POST /api/generate-story` response with status `200` on 2026-07-13; the corresponding CORS `OPTIONS` request returned `204`, with no warnings, errors, or fatal logs in the reviewed window;
- Supabase API Gateway logged a successful `POST /rest/v1/rpc/create_generated_story_with_usage` response with status `200` on 2026-07-13;
- local generation diagnostics are available for the AI fallback-rate review;
- `pictures/` and `export_chat_ezhik_lisenok.docx` are intentionally untracked.

The evidence above verifies the retired direct-RPC flow only. It does **not**
verify `supabase/migrations/20260810003928_security_remediation.sql`, the
server-only reservation flow, or the current browser-header rollout.

Security-remediation release gate: **not yet verified in a database
environment**.

- The versioned migration and its local contract test are present in the
  repository.
- The local Docker gate must pass before a non-production migration is applied.
- Non-production migration, two-account RLS testing, and the 48-hour
  Report-Only CSP observation remain required before promotion.
- Production migration is a manual, explicitly approved operation; no result
  is recorded here until that approved operation and its audit are complete.

Deferred optional review:

- AI fallback rate after several generations. This does not block normal operation,
  but should be reviewed before broader promotion or after provider changes.

## Supabase RLS Audit

Run this file in Supabase SQL Editor:

```text
docs/supabase-rls-audit.sql
```

Expected after the security-remediation migration:

- all nine tables named by the query exist and have RLS enabled;
- the displayed policy counts meet the stated minimums;
- authenticated users can execute only `get_current_usage` among the audited
  quota/finalization functions;
- service role can execute the reservation, completion, release, rate-limit,
  finalization, and payment functions;
- neither `create_generated_story_with_usage` nor `get_generation_access` is
  executable by browser roles or service role.

The 2026-07-11 RLS result predates this migration and is historical only; do
not treat it as a pass for this gate.

If any row returns:

```text
missing_table
rls_disabled
review_required
missing_function
browser_execute_grant
service_role_grant_mismatch
```

do not broaden public traffic until the policy is reviewed.

## Fresh Account Limit Test

Use a new test email that has not generated stories before.

Steps:

1. Open:

```text
https://ezhik-i-lisenok.ru
```

2. Register a new account.
3. Confirm email if Supabase requires confirmation.
4. Sign in.
5. Generate one story.
6. Confirm the account UI shows:

```text
Бесплатный: 1/1
```

7. Try to generate a second story.
8. Expected result:

```text
Лимит бесплатных историй исчерпан.
```

9. Click `Активировать тестовый тариф`.
10. Expected result:

```text
Семейный: 1/20
```

11. Generate another story.
12. Confirm usage increments and the story appears in My Library.

Verified on 2026-07-12:

- first story was generated on a fresh account;
- second free-tier generation was blocked by the limit;
- test family tariff was activated;
- generation worked after tariff activation.

## Vercel Logs

Open:

```text
Vercel -> hedgehog-fox-stories -> Logs
```

After a test generation, check:

- `/api/generate-story` returned `200`;
- no unhandled exception appears;
- AI fallback reason is expected when fallback happens;
- no secrets are printed in logs.

Successful requests write a safe structured `generation_succeeded` record with the
generation mode, provider, persistence mode, page count, usage counters, and duration.
Fallbacks and failures write only a short error name, status code, and message; no
authorization token, email, user id, story title, lesson, or page text is logged.
The JSON response also omits the user id and filters provider or database error details.

## Supabase Logs

Open:

```text
Supabase -> Project -> Logs
```

After a test generation, check:

- Auth has no repeated token errors;
- Database has no RLS denial for the expected user flow;
- `stories`, `story_pages`, and `generation_usage` writes succeed;
- `story_likes` actions do not create duplicate unique constraint errors during normal use.

Verified on 2026-07-13:

- Supabase API Gateway recorded `POST /rest/v1/rpc/create_generated_story_with_usage`;
- the request returned `200` with level `success`;
- the successful RPC call confirms the generated story and its usage update reached
  the atomic persistence path.

## AI Fallback Review

Generate 5-10 test stories with normal child-safe inputs.

After the test, open DevTools Console on the public site and run:

```js
window.HFAnalyticsService.getGenerationDiagnostics()
```

The report is stored only in the browser's localStorage and contains no story text,
email addresses, or API keys. It reports the number of successful AI responses,
fallbacks, browser mocks, the fallback rate, and the five latest fallback reasons.

Record:

- how many responses show `backend ai`;
- how many responses show `backend mock-fallback`;
- fallback reasons from DevTools Network response metadata.

If fallback happens often for normal prompts, review:

- AI prompt;
- JSON parsing;
- safety validator;
- model configuration in Vercel.
