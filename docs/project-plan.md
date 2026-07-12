# Project Plan

This file tracks the current implementation plan for "Ежонок и Лисёнок".

## Statuses

1. Backend generation scaffold - done.
2. Push latest commit - done.
3. Vercel AI environment variables - done.
4. Choose AI provider - done.
5. Test AI generation - done.
6. Improve backend AI validation - done.
7. Make Supabase story persistence atomic - done.
8. Prepare real subscription plans - done.
9. Connect payments - deferred until self-employed status is ready.
10. Improve account UI - done.
11. Improve "My Library" - done.
12. Public launch checklist - done.
13. Add generation waiting mini tasks - done.
14. Redesign the public site in the watercolor storybook style - done.
15. Add a full generation waiting screen with mini-games - done.

## Current Next Step

Run the operational/security audit before broader public sharing.

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

Atomic persistence is verified with:

```text
meta.persistenceMode = "rpc"
```

MVP subscription plans are documented:

```text
Бесплатный: 1 AI story per 30-day period
Пробный: 3 AI stories, future 7-day period
Семейный: 20 AI stories per 30-day period
Истёк: generation disabled, saved stories remain available
```

Payment backend scaffold is added:

```text
POST /api/create-checkout
POST /api/payment-webhook
PAYMENT_PROVIDER=yookassa supported
PAYMENTS_ENABLED=false by default until production credentials are configured
```

YooKassa backend flow is implemented:

```text
create-checkout creates a YooKassa redirect payment
payment-webhook verifies the payment through YooKassa API
payment-webhook creates an active family subscription in Supabase
```

YooKassa production activation is deferred because the project does not yet have the required self-employed payment requisites.

Account UI now shows login status, storage mode, tariff usage, payment status, and a manual sync refresh action.

My Library now has search, sorting, clearer counts, and empty states with direct actions.

The generation screen now shows child-friendly mini tasks while a story is being generated.

The generation waiting experience now includes three optional mini-games, saved rewards, story-ready/error notices, and keyboard-accessible controls.

The public site now uses a responsive watercolor storybook layout with a new hero, story showcase, parent value block, character cards, mobile navigation, and matching generator/library styling.

Public launch checklist is documented in `docs/launch-checklist.md`.

Public legal/trust pages are added:

```text
requisites.html
privacy.html
terms.html
```

Manual public-site browser verification was reported as passed on 2026-06-26.

Operational audit docs are prepared:

```text
docs/operational-audit.md
docs/supabase-rls-audit.sql
```

## Completion Rule

When an item is completed, update this file and mention the completed item in the user-facing status update.
