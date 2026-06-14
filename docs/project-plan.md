# Project Plan

This file tracks the current implementation plan for "Ежонок и Лисёнок".

## Statuses

1. Backend generation scaffold - done.
2. Push latest commit - done.
3. Vercel AI environment variables - done.
4. Choose AI provider - done.
5. Test AI generation - done.
6. Improve backend AI validation - done.
7. Make Supabase story persistence atomic - in progress.
8. Prepare real subscription plans - not started.
9. Connect payments - not started.
10. Improve account UI - not started.
11. Improve "My Library" - not started.
12. Public launch checklist - not started.

## Current Next Step

Run `docs/supabase-rpc-generated-story.sql` in Supabase SQL Editor, then verify that backend responses use `meta.persistenceMode = "rpc"`.

Chosen provider for the first test:

```text
AI_API_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-flash
```

Use `AI_GENERATION_ENABLED=true` only during the test window.

Latest verified result:

```text
История создана: backend ai. Сохранена в Supabase.
```

Backend AI validation now normalizes generated stories, replaces unknown scene tags, rejects unsafe generated text, and falls back to mock generation when AI output is invalid.

## Completion Rule

When an item is completed, update this file and mention the completed item in the user-facing status update.
