# Operational Audit

This document tracks the remaining checks before broader public sharing.

## Current Status

Completed:

- public site opens on HTTPS;
- manual browser checks were reported as passed on 2026-06-26;
- frontend does not contain real AI, YooKassa, or Supabase service role secrets;
- Supabase RLS is enabled on `stories`, `story_pages`, `story_likes`, `subscriptions`, and `generation_usage`;
- Supabase RLS policies exist on `stories`, `story_pages`, `story_likes`, `subscriptions`, and `generation_usage`;
- fresh-account generation limits were reported as passed on 2026-07-12;
- Vercel logged a successful `POST /api/generate-story` response with status `200` on 2026-07-12; the corresponding CORS `OPTIONS` request returned `204`, with no warnings, errors, or fatal logs in the reviewed window;
- local generation diagnostics are available for the AI fallback-rate review;
- `pictures/` and `export_chat_ezhik_lisenok.docx` are intentionally untracked.

Still requires owner-side verification:

- Supabase logs after generation;
- AI fallback rate after several generations.

## Supabase RLS Audit

Run this file in Supabase SQL Editor:

```text
docs/supabase-rls-audit.sql
```

Expected:

- `stories`, `story_pages`, `story_likes`, `subscriptions`, and `generation_usage` exist;
- RLS is enabled for all listed tables;
- each listed table has ownership policies;
- `create_generated_story_with_usage` exists.

Verified on 2026-07-11:

- all listed tables returned `rls_enabled = true`;
- all listed tables returned `audit_status = ok`;
- policy counts were greater than zero for all listed tables.

If any row returns:

```text
missing_table
rls_disabled
review_required
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
