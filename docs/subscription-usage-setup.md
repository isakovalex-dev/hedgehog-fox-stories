# Subscription and Generation Usage Setup

## Purpose

The MVP uses two Supabase tables for authenticated users:

- `subscriptions` stores the user's current tariff status.
- `generation_usage` stores how many mock stories the user has generated in the current period.

Anonymous users still use `localStorage`, because they do not have a stable Supabase `user_id`.

## SQL schema

```sql
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'free',
  provider text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generation_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  generations_used integer not null default 0,
  generation_limit integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx
  on public.subscriptions (user_id);

create index if not exists generation_usage_user_period_idx
  on public.generation_usage (user_id, period_start, period_end);
```

## Legacy RLS policies

```sql
alter table public.subscriptions enable row level security;
alter table public.generation_usage enable row level security;

create policy "Users can read own subscriptions"
on public.subscriptions
for select
using (auth.uid() = user_id);

create policy "Users can insert own subscriptions"
on public.subscriptions
for insert
with check (auth.uid() = user_id);


create policy "Users can read own generation usage"
on public.generation_usage
for select
using (auth.uid() = user_id);

create policy "Users can insert own generation usage"
on public.generation_usage
for insert
with check (auth.uid() = user_id);

```

These broad insert and update policies were suitable only for the early mock. Do not use them in production: they allow a browser user to change their own tariff or counter. Run `docs/supabase-production-hardening.sql` instead. It replaces browser writes with protected RPC functions.

## Free limit

For `free` users:

- `generation_limit = 1`;
- `generations_used` starts at `0`;
- after one successful story save, `generations_used` becomes `1`;
- the second generation attempt is blocked until a paid plan is activated by the payment webhook or a new period begins.

The frontend increments usage only after the generated story is successfully saved.

User-facing name: `Бесплатный`.

## Trial limit

For `trial` users:

- `generation_limit = 3`;
- recommended period for future production use: 7 days;
- payment is not required for this status in the MVP.

User-facing name: `Пробный`.

## Active limit

For `active` users:

- `generation_limit = 20`;
- the current MVP uses a 30-day period;
- a verified payment webhook updates `subscriptions.status = 'active'`;
- the protected access RPC creates or updates `generation_usage` with `generation_limit = 20`.

User-facing name: `Семейный`.

## Expired status

For `expired` users:

- `generation_limit = 0`;
- generation is blocked;
- saved library stories remain available.

User-facing name: `Истёк`.

## Why store limits in Supabase

`localStorage` is browser-local and can be edited by the user. It is useful for anonymous fallback, but it is not reliable for account-level limits.

Supabase storage makes limits:

- tied to the authenticated user;
- shared across devices;
- available for future backend checks;
- ready for real billing integration.

## Fallback

If the user is anonymous or Supabase is unavailable, the site falls back to `localStorage`.

The UI shows:

> Облачная подписка временно недоступна. Лимиты применяются только на этом устройстве.

Fallback keeps the site usable, but those limits are not authoritative.

## Next step

The next production step is a backend endpoint:

```text
POST /api/generate-story
```

That endpoint should:

1. authenticate the user;
2. read `subscriptions`;
3. read and lock/update `generation_usage`;
4. block requests over the limit;
5. call the real AI provider;
6. validate the JSON response;
7. save `stories` and `story_pages`;
8. save the generated story;
9. increment `generations_used`;
10. return the saved story to the frontend.

Current intermediate state:

- backend mock generation already validates auth and checks `generation_usage`;
- backend mock generation saves `stories` and `story_pages`;
- backend mock generation increments Supabase `generation_usage` only after story save succeeds;
- backend can call `create_generated_story_with_usage` RPC to save the story and increment usage in one transaction;
- the backend requires the protected RPC; it does not use a REST write fallback in production;
- frontend refreshes the Supabase library after backend generation instead of saving the same story again;
- browser mock fallback still increments local usage on the frontend.

The frontend should not call real AI APIs directly.
