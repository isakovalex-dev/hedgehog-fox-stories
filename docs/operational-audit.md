# Operational Audit

This document tracks the remaining checks before broader public sharing.

## Current Status

Completed:

- public site opens on HTTPS;
- manual browser checks were reported as passed on 2026-06-26;
- frontend does not contain real AI, YooKassa, or Supabase service role secrets;
- `pictures/` and `export_chat_ezhik_lisenok.docx` are intentionally untracked.

Still requires owner-side verification:

- Supabase RLS policies;
- fresh-account generation limits;
- Vercel logs after generation;
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

Record:

- how many responses show `backend ai`;
- how many responses show `backend mock-fallback`;
- fallback reasons from DevTools Network response metadata.

If fallback happens often for normal prompts, review:

- AI prompt;
- JSON parsing;
- safety validator;
- model configuration in Vercel.
