# Project Plan

This file tracks the current implementation plan for "Ежонок и Лисёнок".

## Statuses

1. Backend generation scaffold - done.
2. Push latest commit - done.
3. Vercel AI environment variables - done.
4. Choose AI provider - done.
5. Test AI generation - not started.
6. Improve backend AI validation - not started.
7. Make Supabase story persistence atomic - not started.
8. Prepare real subscription plans - not started.
9. Connect payments - not started.
10. Improve account UI - not started.
11. Improve "My Library" - not started.
12. Public launch checklist - not started.

## Current Next Step

Add real AI credentials to Vercel, enable generation for a short test, and create several test stories.

Chosen provider for the first test:

```text
AI_API_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-5.4-mini
```

Keep `AI_GENERATION_ENABLED=false` until the API key is added and the test window starts.

## Completion Rule

When an item is completed, update this file and mention the completed item in the user-facing status update.
