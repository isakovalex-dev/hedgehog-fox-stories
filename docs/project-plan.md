# Project Plan

This file tracks the current implementation plan for "Ежонок и Лисёнок".

## Statuses

1. Backend generation scaffold - done.
2. Push latest commit - done.
3. Vercel AI environment variables - done.
4. Choose AI provider - done.
5. Test AI generation - in progress.
6. Improve backend AI validation - not started.
7. Make Supabase story persistence atomic - not started.
8. Prepare real subscription plans - not started.
9. Connect payments - not started.
10. Improve account UI - not started.
11. Improve "My Library" - not started.
12. Public launch checklist - not started.

## Current Next Step

Redeploy the frontend timeout/status fix, then create several test stories and confirm whether the result is `backend ai` or `backend mock-fallback`.

Chosen provider for the first test:

```text
AI_API_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-flash
```

Use `AI_GENERATION_ENABLED=true` only during the test window.

## Completion Rule

When an item is completed, update this file and mention the completed item in the user-facing status update.
