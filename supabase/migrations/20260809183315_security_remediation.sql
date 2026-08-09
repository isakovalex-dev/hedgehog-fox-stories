begin;

do $$
begin
  if exists (
    select 1
      from public.subscriptions
     group by user_id
    having count(*) > 1
  ) then
    raise exception 'subscriptions contains duplicate user_id values; reconcile them before security_remediation';
  end if;
end;
$$;

alter table public.subscriptions
  alter column user_id set not null;

alter table public.subscriptions
  drop constraint if exists subscriptions_user_id_key;

alter table public.subscriptions
  add constraint subscriptions_user_id_key unique (user_id);

-- These objects were absent from the authoritative baseline. They are new,
-- versioned application prerequisites rather than reconstructed history.
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

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'story-illustrations',
  'story-illustrations',
  false,
  5242880,
  array['image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.ai_usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_kind text not null check (resource_kind in ('story', 'image')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  limit_count integer not null check (limit_count >= 0),
  used_count integer not null default 0 check (used_count >= 0),
  reserved_count integer not null default 0 check (reserved_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, resource_kind, period_start),
  check (period_end > period_start),
  check (used_count + reserved_count <= limit_count)
);

create table if not exists public.ai_generation_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_kind text not null check (resource_kind in ('story', 'image')),
  idempotency_key uuid not null,
  status text not null default 'reserved' check (status in ('reserved', 'completed', 'released')),
  counter_period_start timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  released_at timestamptz,
  unique (user_id, resource_kind, idempotency_key),
  check (expires_at > created_at)
);

create index if not exists ai_generation_reservations_active_idx
  on public.ai_generation_reservations (user_id, resource_kind, expires_at)
  where status = 'reserved';

create table if not exists public.api_rate_windows (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('story', 'image', 'checkout', 'webhook')),
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, action, window_started_at)
);

create index if not exists api_rate_windows_expiry_idx
  on public.api_rate_windows (window_started_at);

alter table public.stories enable row level security;
alter table public.story_pages enable row level security;
alter table public.story_likes enable row level security;
alter table public.subscriptions enable row level security;
alter table public.generation_usage enable row level security;
alter table public.payment_events enable row level security;
alter table public.ai_usage_counters enable row level security;
alter table public.ai_generation_reservations enable row level security;
alter table public.api_rate_windows enable row level security;

revoke all on table public.subscriptions, public.generation_usage,
  public.payment_events, public.ai_usage_counters,
  public.ai_generation_reservations, public.api_rate_windows
  from anon, authenticated;
grant select on table public.subscriptions, public.generation_usage,
  public.ai_usage_counters to authenticated;

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('stories', 'story_pages', 'story_likes', 'subscriptions',
                         'generation_usage', 'payment_events', 'ai_usage_counters',
                         'ai_generation_reservations', 'api_rate_windows')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end;
$$;

create policy stories_public_read on public.stories
  for select to anon, authenticated
  using (visibility = 'public');
create policy stories_owner_read on public.stories
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy stories_owner_insert on public.stories
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy stories_owner_update on public.stories
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy stories_owner_delete on public.stories
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy story_pages_read_via_story on public.story_pages
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.stories s
       where s.id = story_pages.story_id
         and (s.visibility = 'public' or s.user_id = (select auth.uid()))
    )
  );
create policy story_pages_owner_insert on public.story_pages
  for insert to authenticated
  with check (
    exists (
      select 1 from public.stories s
       where s.id = story_pages.story_id and s.user_id = (select auth.uid())
    )
  );
create policy story_pages_owner_update on public.story_pages
  for update to authenticated
  using (
    exists (
      select 1 from public.stories s
       where s.id = story_pages.story_id and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.stories s
       where s.id = story_pages.story_id and s.user_id = (select auth.uid())
    )
  );
create policy story_pages_owner_delete on public.story_pages
  for delete to authenticated
  using (
    exists (
      select 1 from public.stories s
       where s.id = story_pages.story_id and s.user_id = (select auth.uid())
    )
  );

create policy story_likes_owner_read on public.story_likes
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy story_likes_owner_insert on public.story_likes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy story_likes_owner_delete on public.story_likes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy subscriptions_owner_read on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy generation_usage_owner_read on public.generation_usage
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy ai_usage_counters_owner_read on public.ai_usage_counters
  for select to authenticated
  using ((select auth.uid()) = user_id);

alter table storage.objects enable row level security;
drop policy if exists story_illustrations_owner_read on storage.objects;
create policy story_illustrations_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'story-illustrations'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create or replace function public.reserve_ai_usage(
  p_user_id uuid,
  p_resource_kind text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_subscription public.subscriptions%rowtype;
  v_counter public.ai_usage_counters%rowtype;
  v_existing public.ai_generation_reservations%rowtype;
  v_limit integer;
  v_action_limit integer;
  v_window_start timestamptz;
  v_rate_count integer;
  v_released integer := 0;
begin
  if p_user_id is null or p_resource_kind not in ('story', 'image') or p_idempotency_key is null then
    raise exception 'invalid reservation arguments';
  end if;

  select * into v_subscription
    from public.subscriptions
   where user_id = p_user_id
   for update;

  if not found then
    insert into public.subscriptions (
      user_id, status, provider, current_period_start, current_period_end
    ) values (
      p_user_id, 'free', 'system', v_now, v_now + interval '30 days'
    ) returning * into v_subscription;
  elsif v_subscription.status in ('active', 'trial')
    and coalesce(v_subscription.current_period_end, '-infinity'::timestamptz) <= v_now then
    update public.subscriptions
       set status = 'expired', updated_at = v_now
     where id = v_subscription.id
    returning * into v_subscription;
  elsif v_subscription.status = 'free'
    and coalesce(v_subscription.current_period_end, '-infinity'::timestamptz) <= v_now then
    update public.subscriptions
       set current_period_start = v_now,
           current_period_end = v_now + interval '30 days',
           updated_at = v_now
     where id = v_subscription.id
    returning * into v_subscription;
  end if;

  v_limit := case
    when v_subscription.status = 'active' and p_resource_kind = 'story' then 20
    when v_subscription.status = 'active' and p_resource_kind = 'image' then 20
    when v_subscription.status = 'trial' and p_resource_kind = 'story' then 3
    when v_subscription.status = 'free' and p_resource_kind = 'story' then 1
    else 0
  end;

  if v_limit = 0 then
    return jsonb_build_object(
      'allowed', false, 'code', 'entitlement_inactive', 'retry_after_seconds', null,
      'reservation', null,
      'subscription', jsonb_build_object('status', v_subscription.status,
        'period_start', v_subscription.current_period_start,
        'period_end', v_subscription.current_period_end),
      'usage', jsonb_build_object('resource_kind', p_resource_kind,
        'limit_count', 0, 'used_count', 0, 'reserved_count', 0, 'remaining_count', 0)
    );
  end if;

  insert into public.ai_usage_counters (
    user_id, resource_kind, period_start, period_end, limit_count
  ) values (
    p_user_id, p_resource_kind, v_subscription.current_period_start,
    v_subscription.current_period_end, v_limit
  ) on conflict (user_id, resource_kind, period_start) do update
    set limit_count = excluded.limit_count,
        period_end = excluded.period_end,
        updated_at = v_now;

  select * into v_counter
    from public.ai_usage_counters
   where user_id = p_user_id
     and resource_kind = p_resource_kind
     and period_start = v_subscription.current_period_start
   for update;

  update public.ai_generation_reservations
     set status = 'released', released_at = v_now
   where user_id = p_user_id
     and resource_kind = p_resource_kind
     and counter_period_start = v_counter.period_start
     and status = 'reserved'
     and expires_at <= v_now;
  get diagnostics v_released = row_count;

  if v_released > 0 then
    update public.ai_usage_counters
       set reserved_count = greatest(0, reserved_count - v_released), updated_at = v_now
     where user_id = v_counter.user_id
       and resource_kind = v_counter.resource_kind
       and period_start = v_counter.period_start
    returning * into v_counter;
  end if;

  select * into v_existing
    from public.ai_generation_reservations
   where user_id = p_user_id
     and resource_kind = p_resource_kind
     and idempotency_key = p_idempotency_key
   for update;

  if found then
    return jsonb_build_object(
      'allowed', false, 'code', 'idempotency_replayed', 'retry_after_seconds', null,
      'reservation', jsonb_build_object('id', v_existing.id, 'status', v_existing.status,
        'expires_at', v_existing.expires_at),
      'subscription', jsonb_build_object('status', v_subscription.status,
        'period_start', v_subscription.current_period_start,
        'period_end', v_subscription.current_period_end),
      'usage', jsonb_build_object('resource_kind', p_resource_kind,
        'limit_count', v_counter.limit_count, 'used_count', v_counter.used_count,
        'reserved_count', v_counter.reserved_count,
        'remaining_count', v_counter.limit_count - v_counter.used_count - v_counter.reserved_count)
    );
  end if;

  v_action_limit := case when p_resource_kind = 'story' then 6 else 12 end;
  v_window_start := to_timestamp(floor(extract(epoch from v_now) / 600) * 600);
  insert into public.api_rate_windows (user_id, action, window_started_at, request_count)
  values (p_user_id, p_resource_kind, v_window_start, 1)
  on conflict (user_id, action, window_started_at) do update
    set request_count = public.api_rate_windows.request_count + 1,
        updated_at = v_now
    where public.api_rate_windows.request_count < v_action_limit
  returning request_count into v_rate_count;

  if v_rate_count is null then
    return jsonb_build_object(
      'allowed', false, 'code', 'rate_limited', 'retry_after_seconds',
        greatest(1, extract(epoch from (v_window_start + interval '10 minutes') - v_now)::integer),
      'reservation', null,
      'subscription', jsonb_build_object('status', v_subscription.status,
        'period_start', v_subscription.current_period_start,
        'period_end', v_subscription.current_period_end),
      'usage', jsonb_build_object('resource_kind', p_resource_kind,
        'limit_count', v_counter.limit_count, 'used_count', v_counter.used_count,
        'reserved_count', v_counter.reserved_count,
        'remaining_count', v_counter.limit_count - v_counter.used_count - v_counter.reserved_count)
    );
  end if;

  if exists (
    select 1 from public.ai_generation_reservations
     where user_id = p_user_id and resource_kind = p_resource_kind
       and counter_period_start = v_counter.period_start and status = 'reserved'
  ) then
    return jsonb_build_object(
      'allowed', false, 'code', 'job_in_progress', 'retry_after_seconds', 600,
      'reservation', null,
      'subscription', jsonb_build_object('status', v_subscription.status,
        'period_start', v_subscription.current_period_start,
        'period_end', v_subscription.current_period_end),
      'usage', jsonb_build_object('resource_kind', p_resource_kind,
        'limit_count', v_counter.limit_count, 'used_count', v_counter.used_count,
        'reserved_count', v_counter.reserved_count,
        'remaining_count', v_counter.limit_count - v_counter.used_count - v_counter.reserved_count)
    );
  end if;

  if v_counter.used_count + v_counter.reserved_count >= v_counter.limit_count then
    return jsonb_build_object(
      'allowed', false, 'code', 'quota_exhausted', 'retry_after_seconds', null,
      'reservation', null,
      'subscription', jsonb_build_object('status', v_subscription.status,
        'period_start', v_subscription.current_period_start,
        'period_end', v_subscription.current_period_end),
      'usage', jsonb_build_object('resource_kind', p_resource_kind,
        'limit_count', v_counter.limit_count, 'used_count', v_counter.used_count,
        'reserved_count', v_counter.reserved_count, 'remaining_count', 0)
    );
  end if;

  insert into public.ai_generation_reservations (
    user_id, resource_kind, idempotency_key, counter_period_start, expires_at
  ) values (
    p_user_id, p_resource_kind, p_idempotency_key, v_counter.period_start,
    v_now + interval '10 minutes'
  ) returning * into v_existing;

  update public.ai_usage_counters
     set reserved_count = reserved_count + 1, updated_at = v_now
   where user_id = v_counter.user_id
     and resource_kind = v_counter.resource_kind
     and period_start = v_counter.period_start
  returning * into v_counter;

  return jsonb_build_object(
    'allowed', true, 'code', 'reserved', 'retry_after_seconds', null,
    'reservation', jsonb_build_object('id', v_existing.id, 'status', v_existing.status,
      'expires_at', v_existing.expires_at),
    'subscription', jsonb_build_object('status', v_subscription.status,
      'period_start', v_subscription.current_period_start,
      'period_end', v_subscription.current_period_end),
    'usage', jsonb_build_object('resource_kind', p_resource_kind,
      'limit_count', v_counter.limit_count, 'used_count', v_counter.used_count,
      'reserved_count', v_counter.reserved_count,
      'remaining_count', v_counter.limit_count - v_counter.used_count - v_counter.reserved_count)
  );
end;
$$;

create or replace function public.complete_ai_usage(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_reservation public.ai_generation_reservations%rowtype;
  v_counter public.ai_usage_counters%rowtype;
begin
  select * into v_reservation
    from public.ai_generation_reservations
   where id = p_reservation_id
   for update;
  if not found then
    raise exception 'reservation not found';
  end if;

  select * into v_counter
    from public.ai_usage_counters
   where user_id = v_reservation.user_id
     and resource_kind = v_reservation.resource_kind
     and period_start = v_reservation.counter_period_start
   for update;
  if not found then
    raise exception 'counter not found';
  end if;

  if v_reservation.status <> 'reserved' then
    return jsonb_build_object(
      'completed', false,
      'usage', jsonb_build_object(
        'resource_kind', v_counter.resource_kind,
        'limit_count', v_counter.limit_count,
        'used_count', v_counter.used_count,
        'reserved_count', v_counter.reserved_count,
        'remaining_count', v_counter.limit_count - v_counter.used_count - v_counter.reserved_count
      )
    );
  end if;

  update public.ai_generation_reservations
     set status = 'completed', completed_at = v_now
   where id = v_reservation.id;

  update public.ai_usage_counters
     set reserved_count = reserved_count - 1,
         used_count = used_count + 1,
         updated_at = v_now
   where user_id = v_counter.user_id
     and resource_kind = v_counter.resource_kind
     and period_start = v_counter.period_start
  returning * into v_counter;

  return jsonb_build_object(
    'completed', true,
    'usage', jsonb_build_object(
      'resource_kind', v_counter.resource_kind,
      'limit_count', v_counter.limit_count,
      'used_count', v_counter.used_count,
      'reserved_count', v_counter.reserved_count,
      'remaining_count', v_counter.limit_count - v_counter.used_count - v_counter.reserved_count
    )
  );
end;
$$;

create or replace function public.release_ai_usage(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_reservation public.ai_generation_reservations%rowtype;
  v_counter public.ai_usage_counters%rowtype;
begin
  select * into v_reservation
    from public.ai_generation_reservations
   where id = p_reservation_id
   for update;
  if not found then
    raise exception 'reservation not found';
  end if;

  select * into v_counter
    from public.ai_usage_counters
   where user_id = v_reservation.user_id
     and resource_kind = v_reservation.resource_kind
     and period_start = v_reservation.counter_period_start
   for update;
  if not found then
    raise exception 'counter not found';
  end if;

  if v_reservation.status <> 'reserved' then
    return jsonb_build_object(
      'released', false,
      'usage', jsonb_build_object(
        'resource_kind', v_counter.resource_kind,
        'limit_count', v_counter.limit_count,
        'used_count', v_counter.used_count,
        'reserved_count', v_counter.reserved_count,
        'remaining_count', v_counter.limit_count - v_counter.used_count - v_counter.reserved_count
      )
    );
  end if;

  update public.ai_generation_reservations
     set status = 'released', released_at = v_now
   where id = v_reservation.id;

  update public.ai_usage_counters
     set reserved_count = reserved_count - 1,
         updated_at = v_now
   where user_id = v_counter.user_id
     and resource_kind = v_counter.resource_kind
     and period_start = v_counter.period_start
  returning * into v_counter;

  return jsonb_build_object(
    'released', true,
    'usage', jsonb_build_object(
      'resource_kind', v_counter.resource_kind,
      'limit_count', v_counter.limit_count,
      'used_count', v_counter.used_count,
      'reserved_count', v_counter.reserved_count,
      'remaining_count', v_counter.limit_count - v_counter.used_count - v_counter.reserved_count
    )
  );
end;
$$;

create or replace function public.create_story_from_reservation(
  p_reservation_id uuid,
  p_title text,
  p_age_group text,
  p_mood text,
  p_lesson text,
  p_visibility text,
  p_pages jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_reservation public.ai_generation_reservations%rowtype;
  v_counter public.ai_usage_counters%rowtype;
  v_story public.stories%rowtype;
  v_pages jsonb;
begin
  if jsonb_typeof(p_pages) <> 'array' or jsonb_array_length(p_pages) < 1 then
    raise exception 'story pages are required';
  end if;
  if jsonb_array_length(p_pages) > 7 then
    raise exception 'story cannot contain more than 7 pages';
  end if;

  select * into v_reservation
    from public.ai_generation_reservations
   where id = p_reservation_id
   for update;
  if not found or v_reservation.resource_kind <> 'story' then
    raise exception 'story reservation not found';
  end if;
  if v_reservation.status <> 'reserved' then
    raise exception 'story reservation is not pending';
  end if;

  select * into v_counter
    from public.ai_usage_counters
   where user_id = v_reservation.user_id
     and resource_kind = 'story'
     and period_start = v_reservation.counter_period_start
   for update;
  if not found or v_counter.reserved_count < 1 then
    raise exception 'story counter is not reserved';
  end if;

  insert into public.stories (
    user_id, title, age_group, mood, lesson, visibility
  ) values (
    v_reservation.user_id,
    left(trim(coalesce(p_title, 'Новая история')), 120),
    case
      when p_age_group in ('5-6', '7-8', '9-10', '5-7', '8-10') then p_age_group
      else '5-6'
    end,
    left(trim(coalesce(p_mood, '')), 80),
    left(trim(coalesce(p_lesson, '')), 160),
    case when p_visibility in ('private', 'public', 'unlisted') then p_visibility else 'private' end
  ) returning * into v_story;

  insert into public.story_pages (
    story_id, page_number, text, scene_tag, image_url, image_prompt
  )
  select
    v_story.id,
    row_number() over (),
    left(trim(coalesce(page_item->>'text', '')), 700),
    coalesce(nullif(page_item->>'scene_tag', ''), 'forest_day'),
    coalesce(page_item->>'image_url', ''),
    left(coalesce(page_item->>'image_prompt', ''), 240)
  from jsonb_array_elements(p_pages) as page_item;

  update public.ai_generation_reservations
     set status = 'completed', completed_at = v_now
   where id = v_reservation.id;
  update public.ai_usage_counters
     set reserved_count = reserved_count - 1,
         used_count = used_count + 1,
         updated_at = v_now
   where user_id = v_counter.user_id
     and resource_kind = 'story'
     and period_start = v_counter.period_start
  returning * into v_counter;

  select coalesce(jsonb_agg(to_jsonb(page_row) order by page_row.page_number), '[]'::jsonb)
    into v_pages
    from public.story_pages page_row
   where page_row.story_id = v_story.id;

  return jsonb_build_object(
    'story', to_jsonb(v_story),
    'pages', v_pages,
    'usage', jsonb_build_object(
      'resource_kind', 'story',
      'limit_count', v_counter.limit_count,
      'used_count', v_counter.used_count,
      'reserved_count', v_counter.reserved_count,
      'remaining_count', v_counter.limit_count - v_counter.used_count - v_counter.reserved_count
    )
  );
end;
$$;

create or replace function public.get_current_usage()
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_subscription public.subscriptions%rowtype;
  v_story public.ai_usage_counters%rowtype;
  v_image public.ai_usage_counters%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  select * into v_subscription
    from public.subscriptions
   where user_id = v_user_id
     and (current_period_end is null or current_period_end > v_now)
   limit 1;

  if not found then
    return jsonb_build_object(
      'subscription', jsonb_build_object('status', 'free', 'period_start', null, 'period_end', null),
      'story', jsonb_build_object('limit_count', 1, 'used_count', 0, 'reserved_count', 0, 'remaining_count', 1),
      'image', jsonb_build_object('limit_count', 0, 'used_count', 0, 'reserved_count', 0, 'remaining_count', 0)
    );
  end if;

  select * into v_story from public.ai_usage_counters
   where user_id = v_user_id and resource_kind = 'story'
     and period_start = v_subscription.current_period_start;
  select * into v_image from public.ai_usage_counters
   where user_id = v_user_id and resource_kind = 'image'
     and period_start = v_subscription.current_period_start;

  return jsonb_build_object(
    'subscription', jsonb_build_object('status', v_subscription.status,
      'period_start', v_subscription.current_period_start,
      'period_end', v_subscription.current_period_end),
    'story', jsonb_build_object(
      'limit_count', coalesce(v_story.limit_count,
        case when v_subscription.status = 'active' then 20 when v_subscription.status = 'trial' then 3 when v_subscription.status = 'free' then 1 else 0 end),
      'used_count', coalesce(v_story.used_count, 0),
      'reserved_count', coalesce(v_story.reserved_count, 0),
      'remaining_count', coalesce(v_story.limit_count - v_story.used_count - v_story.reserved_count,
        case when v_subscription.status = 'active' then 20 when v_subscription.status = 'trial' then 3 when v_subscription.status = 'free' then 1 else 0 end)
    ),
    'image', jsonb_build_object(
      'limit_count', coalesce(v_image.limit_count, case when v_subscription.status = 'active' then 20 else 0 end),
      'used_count', coalesce(v_image.used_count, 0),
      'reserved_count', coalesce(v_image.reserved_count, 0),
      'remaining_count', coalesce(v_image.limit_count - v_image.used_count - v_image.reserved_count,
        case when v_subscription.status = 'active' then 20 else 0 end)
    )
  );
end;
$$;

create or replace function public.enforce_api_rate_limit(
  p_user_id uuid,
  p_action text,
  p_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
begin
  if p_user_id is null or p_action <> 'checkout' or p_limit <> 5 then
    raise exception 'invalid rate-limit arguments';
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from v_now) / 600) * 600);
  insert into public.api_rate_windows (user_id, action, window_started_at, request_count)
  values (p_user_id, p_action, v_window_start, 1)
  on conflict (user_id, action, window_started_at) do update
    set request_count = public.api_rate_windows.request_count + 1,
        updated_at = v_now
    where public.api_rate_windows.request_count < p_limit
  returning request_count into v_count;

  if v_count is null then
    return jsonb_build_object(
      'allowed', false,
      'code', 'rate_limited',
      'retry_after_seconds', greatest(1,
        extract(epoch from (v_window_start + interval '10 minutes') - v_now)::integer)
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'code', 'allowed',
    'retry_after_seconds', null
  );
end;
$$;

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
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
  v_subscription_id uuid;
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

  insert into public.ai_usage_counters (
    user_id, resource_kind, period_start, period_end, limit_count, used_count, reserved_count
  )
  values
    (p_user_id, 'story', v_period_start, v_period_end, 20, 0, 0),
    (p_user_id, 'image', v_period_start, v_period_end, 20, 0, 0)
  on conflict (user_id, resource_kind, period_start) do nothing;

  return jsonb_build_object(
    'already_processed', false,
    'subscription_updated', true
  );
end;
$$;


revoke all on function public.reserve_ai_usage(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.complete_ai_usage(uuid)
  from public, anon, authenticated;
revoke all on function public.release_ai_usage(uuid)
  from public, anon, authenticated;
revoke all on function public.enforce_api_rate_limit(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.create_story_from_reservation(uuid, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.apply_yookassa_payment(text, uuid, text, numeric, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.create_generated_story_with_usage(uuid, text, text, text, text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.get_generation_access()
  from public, anon, authenticated, service_role;

grant execute on function public.reserve_ai_usage(uuid, text, uuid) to service_role;
grant execute on function public.complete_ai_usage(uuid) to service_role;
grant execute on function public.release_ai_usage(uuid) to service_role;
grant execute on function public.enforce_api_rate_limit(uuid, text, integer) to service_role;
grant execute on function public.create_story_from_reservation(uuid, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.apply_yookassa_payment(text, uuid, text, numeric, text, timestamptz) to service_role;
revoke all on function public.get_current_usage() from public, anon;
grant execute on function public.get_current_usage() to authenticated;

commit;
