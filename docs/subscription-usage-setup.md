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

## RLS policies

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

create policy "Users can update own subscriptions"
on public.subscriptions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read own generation usage"
on public.generation_usage
for select
using (auth.uid() = user_id);

create policy "Users can insert own generation usage"
on public.generation_usage
for insert
with check (auth.uid() = user_id);

create policy "Users can update own generation usage"
on public.generation_usage
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

## Free limit

For `free` users:

- `generation_limit = 1`;
- `generations_used` starts at `0`;
- after one successful story save, `generations_used` becomes `1`;
- the second generation attempt is blocked until the user activates the mock subscription or a new period is created.

The frontend increments usage only after the generated story is successfully saved.

## Active limit

For `active` users:

- `generation_limit = 20`;
- the current MVP uses a 30-day period;
- activating the mock subscription updates `subscriptions.status = 'active'`;
- the current `generation_usage` row is created or updated with `generation_limit = 20`.

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
- if the RPC is not installed yet, backend uses the existing REST fallback;
- frontend refreshes the Supabase library after backend generation instead of saving the same story again;
- browser mock fallback still increments local usage on the frontend.

The frontend should not call real AI APIs directly.
