begin;

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_payment_id text not null,
  event_type text not null,
  payment_status text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null check (currency = 'RUB'),
  paid_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create index if not exists payment_events_user_id_created_at_idx
  on public.payment_events (user_id, created_at desc);

alter table public.payment_events enable row level security;

revoke all on table public.payment_events from anon, authenticated;
grant select, insert, update on table public.payment_events to service_role;

create or replace function public.apply_yookassa_payment(
  p_provider_payment_id text,
  p_user_id uuid,
  p_plan text,
  p_amount numeric,
  p_currency text,
  p_paid_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event_id uuid;
  v_subscription_id uuid;
  v_usage_id uuid;
  v_period_start timestamptz := coalesce(p_paid_at, now());
  v_period_end timestamptz := coalesce(p_paid_at, now()) + interval '30 days';
begin
  if nullif(trim(p_provider_payment_id), '') is null then
    raise exception 'Provider payment id is required';
  end if;

  if p_plan <> 'family' then
    raise exception 'Unsupported payment plan';
  end if;

  if p_currency <> 'RUB' or p_amount <> 299.00 then
    raise exception 'Unexpected payment amount';
  end if;

  insert into public.payment_events (
    provider,
    provider_payment_id,
    event_type,
    payment_status,
    user_id,
    plan,
    amount,
    currency,
    paid_at
  )
  values (
    'yookassa',
    trim(p_provider_payment_id),
    'payment.succeeded',
    'succeeded',
    p_user_id,
    p_plan,
    p_amount,
    p_currency,
    v_period_start
  )
  on conflict (provider, provider_payment_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return jsonb_build_object(
      'already_processed', true,
      'subscription_updated', false
    );
  end if;

  select id
    into v_subscription_id
    from public.subscriptions
   where user_id = p_user_id
   order by updated_at desc, created_at desc
   limit 1
   for update;

  if found then
    update public.subscriptions
       set status = 'active',
           provider = 'yookassa',
           provider_subscription_id = trim(p_provider_payment_id),
           current_period_start = v_period_start,
           current_period_end = v_period_end,
           updated_at = now()
     where id = v_subscription_id;
  else
    insert into public.subscriptions (
      user_id,
      status,
      provider,
      provider_subscription_id,
      current_period_start,
      current_period_end
    )
    values (
      p_user_id,
      'active',
      'yookassa',
      trim(p_provider_payment_id),
      v_period_start,
      v_period_end
    )
    returning id into v_subscription_id;
  end if;

  select id
    into v_usage_id
    from public.generation_usage
   where user_id = p_user_id
     and period_end >= now()
   order by period_start desc
   limit 1
   for update;

  if found then
    update public.generation_usage
       set period_start = v_period_start,
           period_end = v_period_end,
           generations_used = 0,
           generation_limit = 20,
           updated_at = now()
     where id = v_usage_id;
  else
    insert into public.generation_usage (
      user_id,
      period_start,
      period_end,
      generations_used,
      generation_limit
    )
    values (
      p_user_id,
      v_period_start,
      v_period_end,
      0,
      20
    )
    returning id into v_usage_id;
  end if;

  return jsonb_build_object(
    'already_processed', false,
    'subscription_updated', true
  );
end;
$$;

revoke all on function public.apply_yookassa_payment(text, uuid, text, numeric, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_yookassa_payment(text, uuid, text, numeric, text, timestamptz)
  to service_role;

commit;
