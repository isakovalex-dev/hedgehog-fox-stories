-- RETIRED — DO NOT RUN.
--
-- This pre-migration script grants browser access to the legacy
-- create_generated_story_with_usage and get_generation_access RPCs. It is kept
-- only as historical context. It is superseded by the versioned migration
-- supabase/migrations/20260810003928_security_remediation.sql, which revokes
-- those legacy entry points and uses server-only reservations instead.
-- Do not run this file in local, non-production, or production environments.

begin;

alter table public.subscriptions enable row level security;
alter table public.generation_usage enable row level security;

-- Remove all browser write policies on billing-related tables, including policies
-- created by an earlier MVP setup under a different name.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname, tablename
      from pg_policies
     where schemaname = 'public'
       and tablename in ('subscriptions', 'generation_usage')
       and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format('drop policy if exists %I on public.%I', policy_row.policyname, policy_row.tablename);
  end loop;
end;
$$;

drop policy if exists "Users can read own subscriptions" on public.subscriptions;
create policy "Users can read own subscriptions"
on public.subscriptions
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own generation usage" on public.generation_usage;
create policy "Users can read own generation usage"
on public.generation_usage
for select to authenticated
using ((select auth.uid()) = user_id);

-- This RPC has no user-controlled parameters. It creates the initial free period
-- when necessary and returns only the current user's access state.
create or replace function public.get_generation_access()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_subscription public.subscriptions%rowtype;
  v_usage public.generation_usage%rowtype;
  v_status text;
  v_limit integer;
  v_period_start timestamptz := now();
  v_period_end timestamptz := now() + interval '30 days';
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
    into v_subscription
    from public.subscriptions
   where user_id = v_user_id
   order by updated_at desc, created_at desc
   limit 1
   for update;

  if not found then
    insert into public.subscriptions (
      user_id, status, provider, current_period_start, current_period_end
    )
    values (
      v_user_id, 'free', 'system', v_period_start, v_period_end
    )
    returning * into v_subscription;
  elsif v_subscription.status = 'free'
        and coalesce(v_subscription.current_period_end, '-infinity'::timestamptz) < now() then
    update public.subscriptions
       set current_period_start = v_period_start,
           current_period_end = v_period_end,
           updated_at = now()
     where id = v_subscription.id
     returning * into v_subscription;
  elsif v_subscription.status in ('active', 'trial')
        and coalesce(v_subscription.current_period_end, '-infinity'::timestamptz) < now() then
    update public.subscriptions
       set status = 'expired',
           updated_at = now()
     where id = v_subscription.id
     returning * into v_subscription;
  end if;

  v_status := coalesce(v_subscription.status, 'free');
  v_limit := case
    when v_status = 'active' then 20
    when v_status = 'trial' then 3
    when v_status = 'expired' then 0
    else 1
  end;

  select *
    into v_usage
    from public.generation_usage
   where user_id = v_user_id
     and period_end >= now()
   order by period_start desc, created_at desc
   limit 1
   for update;

  if not found then
    insert into public.generation_usage (
      user_id, period_start, period_end, generations_used, generation_limit
    )
    values (
      v_user_id,
      coalesce(v_subscription.current_period_start, v_period_start),
      coalesce(v_subscription.current_period_end, v_period_end),
      0,
      v_limit
    )
    returning * into v_usage;
  elsif v_usage.generation_limit <> v_limit then
    update public.generation_usage
       set generation_limit = v_limit,
           updated_at = now()
     where id = v_usage.id
     returning * into v_usage;
  end if;

  return jsonb_build_object(
    'subscription', to_jsonb(v_subscription),
    'usage', to_jsonb(v_usage)
  );
end;
$$;

-- The function already verifies auth.uid() and that p_usage_id belongs to it.
-- SECURITY DEFINER lets it update protected usage rows atomically.
alter function public.create_generated_story_with_usage(
  uuid, text, text, text, text, text, jsonb
) security definer;
alter function public.create_generated_story_with_usage(
  uuid, text, text, text, text, text, jsonb
) set search_path = public, pg_temp;

revoke all on function public.get_generation_access() from public, anon;
grant execute on function public.get_generation_access() to authenticated;

revoke all on function public.create_generated_story_with_usage(
  uuid, text, text, text, text, text, jsonb
) from public, anon;
grant execute on function public.create_generated_story_with_usage(
  uuid, text, text, text, text, text, jsonb
) to authenticated;

commit;

-- Expected result after deployment:
-- 1. The browser may SELECT only its own subscriptions and generation_usage rows.
-- 2. POST /api/generate-story calls get_generation_access(), then uses the
--    transactional create_generated_story_with_usage() RPC to save the story.
-- 3. Direct browser PATCH/POST calls to subscriptions or generation_usage fail.
