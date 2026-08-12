begin;

create or replace function pg_temp.assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if coalesce(p_condition, false) is not true then
    raise exception 'assertion failed: %', p_message;
  end if;
end;
$$;

create or replace function pg_temp.expect_error(p_sql text, p_message text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception when others then
    return;
  end;
  raise exception 'assertion failed: %', p_message;
end;
$$;

-- Fixed local-only identities used consistently throughout this contract.
do $$
declare
  v_user_a constant uuid := '11111111-1111-1111-1111-111111111111';
  v_user_b constant uuid := '22222222-2222-2222-2222-222222222222';
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values
    (v_user_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'task2-user-a@example.invalid', '', '{}'::jsonb,
     '{}'::jsonb, now(), now()),
    (v_user_b, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'task2-user-b@example.invalid', '', '{}'::jsonb,
     '{}'::jsonb, now(), now())
  on conflict (id) do nothing;
end;
$$;

select pg_temp.assert_true(
  exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'payment_events' and c.relrowsecurity
  ),
  'payment_events exists with RLS enabled'
);
select pg_temp.assert_true(
  not has_table_privilege('anon', 'public.payment_events', 'select')
  and not has_table_privilege('authenticated', 'public.payment_events', 'select'),
  'payment_events has no browser select grants'
);
select pg_temp.assert_true(
  exists (
    select 1 from storage.buckets
     where id = 'story-illustrations'
       and public = false
       and file_size_limit = 5242880
       and allowed_mime_types = array['image/webp']
  ),
  'story-illustrations is private and WebP-only with a 5 MiB limit'
);
select pg_temp.assert_true(
  exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'story_illustrations_owner_read'
  ),
  'story illustration owner-read policy is installed'
);

-- Entitlement limits: free = 1/0, trial = 3/0, active = 20/20, expired = 0/0.
insert into public.subscriptions (
  user_id, status, provider, current_period_start, current_period_end
)
values
  ('11111111-1111-1111-1111-111111111111', 'free', 'system', now(), now() + interval '30 days'),
  ('22222222-2222-2222-2222-222222222222', 'trial', 'system', now(), now() + interval '30 days')
on conflict (user_id) do update
set status = excluded.status,
    provider = excluded.provider,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    updated_at = now();

select pg_temp.assert_true(
  (public.reserve_ai_usage('11111111-1111-1111-1111-111111111111', 'story',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid)->'usage'->>'limit_count')::integer = 1,
  'free receives one story credit'
);
select pg_temp.assert_true(
  (public.reserve_ai_usage('11111111-1111-1111-1111-111111111111', 'image',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid)->>'code') = 'entitlement_inactive',
  'free receives no image credits'
);
select pg_temp.assert_true(
  (public.reserve_ai_usage('22222222-2222-2222-2222-222222222222', 'story',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid)->'usage'->>'limit_count')::integer = 3,
  'trial receives three story credits'
);
select pg_temp.assert_true(
  (public.reserve_ai_usage('22222222-2222-2222-2222-222222222222', 'image',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid)->>'code') = 'entitlement_inactive',
  'trial receives no image credits'
);

insert into public.subscriptions (
  user_id, status, provider, current_period_start, current_period_end
)
values (
  '22222222-2222-2222-2222-222222222222', 'active', 'yookassa', now(), now() + interval '30 days'
)
on conflict (user_id) do update
set status = excluded.status, provider = excluded.provider,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end, updated_at = now();

select public.release_ai_usage(
  (select id from public.ai_generation_reservations
    where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid)
);
select pg_temp.assert_true(
  (public.reserve_ai_usage('22222222-2222-2222-2222-222222222222', 'story',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'::uuid)->'usage'->>'limit_count')::integer = 20,
  'active receives twenty story credits'
);
select public.release_ai_usage(
  (select id from public.ai_generation_reservations
    where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'::uuid)
);
select pg_temp.assert_true(
  (public.reserve_ai_usage('22222222-2222-2222-2222-222222222222', 'image',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'::uuid)->'usage'->>'limit_count')::integer = 20,
  'active receives twenty image credits'
);
select public.release_ai_usage(
  (select id from public.ai_generation_reservations
    where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'::uuid)
);

update public.subscriptions
   set status = 'expired', current_period_end = now() - interval '1 second'
 where user_id = '22222222-2222-2222-2222-222222222222';
select pg_temp.assert_true(
  (public.reserve_ai_usage('22222222-2222-2222-2222-222222222222', 'story',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5'::uuid)->>'code') = 'entitlement_inactive',
  'expired receives no story credits'
);

-- Reservation behaviour: duplicate requests replay; only one pending row survives;
-- release restores capacity; completing a reservation only increments once.
update public.subscriptions
   set status = 'active', current_period_start = now(), current_period_end = now() + interval '30 days'
 where user_id = '22222222-2222-2222-2222-222222222222';

select pg_temp.assert_true(
  (public.reserve_ai_usage('22222222-2222-2222-2222-222222222222', 'story',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb6'::uuid)->>'code') = 'reserved',
  'first reservation is allowed'
);
select pg_temp.assert_true(
  (public.reserve_ai_usage('22222222-2222-2222-2222-222222222222', 'story',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb6'::uuid)->>'code') = 'idempotency_replayed',
  'same idempotency key is replayed'
);
select pg_temp.assert_true(
  (public.reserve_ai_usage('22222222-2222-2222-2222-222222222222', 'story',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb7'::uuid)->>'code') = 'job_in_progress'
  and (select count(*) from public.ai_generation_reservations
       where user_id = '22222222-2222-2222-2222-222222222222'
         and resource_kind = 'story' and status = 'reserved') = 1,
  'parallel-equivalent reservation attempts leave one pending story reservation'
);
select public.release_ai_usage(
  (select id from public.ai_generation_reservations
    where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb6'::uuid)
);
select pg_temp.assert_true(
  (select reserved_count from public.ai_usage_counters
    where user_id = '22222222-2222-2222-2222-222222222222'
      and resource_kind = 'story'
    order by period_start desc limit 1) = 0,
  'release restores one reservation capacity'
);
select public.reserve_ai_usage(
  '22222222-2222-2222-2222-222222222222', 'image',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8'::uuid
);
select public.complete_ai_usage(
  (select id from public.ai_generation_reservations
    where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8'::uuid)
);
select public.complete_ai_usage(
  (select id from public.ai_generation_reservations
    where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8'::uuid)
);
select pg_temp.assert_true(
  (select used_count from public.ai_usage_counters
    where user_id = '22222222-2222-2222-2222-222222222222'
      and resource_kind = 'image'
    order by period_start desc limit 1) = 1,
  'complete increments usage exactly once'
);

-- Finalization must reclaim an expired reservation without creating a story
-- or consuming its credit.
select public.reserve_ai_usage(
  '22222222-2222-2222-2222-222222222222', 'story',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb9'::uuid
);
update public.ai_generation_reservations
   set created_at = now() - interval '20 minutes',
       expires_at = now() - interval '1 second'
 where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb9'::uuid;
select pg_temp.assert_true(
  (public.create_story_from_reservation(
    (select id from public.ai_generation_reservations
      where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb9'::uuid),
    'expired', '5-6', '', '', 'private',
    '[{"text":"expired","scene_tag":"forest_day"}]'::jsonb
  )->>'code') = 'reservation_expired',
  'expired story reservation is rejected before story creation'
);
select pg_temp.assert_true(
  (select status = 'released' from public.ai_generation_reservations
    where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb9'::uuid)
  and not exists (select 1 from public.stories where title = 'expired'),
  'expired finalization releases its reservation without creating a story'
);

insert into public.stories (id, user_id, title, age_group, mood, lesson, visibility)
values ('33333333-3333-3333-3333-333333333333',
        '22222222-2222-2222-2222-222222222222',
        'User B private story', '5-6', '', '', 'private')
on conflict (id) do nothing;
insert into public.story_pages (story_id, page_number, text, scene_tag)
values ('33333333-3333-3333-3333-333333333333', 1, 'Private page', 'forest_day')
on conflict do nothing;
insert into public.story_likes (story_id, user_id)
values ('33333333-3333-3333-3333-333333333333',
        '22222222-2222-2222-2222-222222222222')
on conflict do nothing;
insert into storage.objects (bucket_id, name, owner_id)
values ('story-illustrations', '22222222-2222-2222-2222-222222222222/private.webp',
        '22222222-2222-2222-2222-222222222222')
on conflict do nothing;

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.expect_error(
  $$select public.reserve_ai_usage(
    '11111111-1111-1111-1111-111111111111', 'story',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::uuid)$$,
  'authenticated cannot execute a service-role-only reservation RPC'
);
select pg_temp.expect_error(
  $$insert into public.stories (user_id, title, age_group, mood, lesson, visibility)
    values ('22222222-2222-2222-2222-222222222222', 'forbidden', '5-6', '', '', 'private')$$,
  'User A cannot write User B stories'
);
select pg_temp.expect_error(
  $$insert into public.story_pages (story_id, page_number, text, scene_tag)
    values ('33333333-3333-3333-3333-333333333333', 2, 'forbidden', 'forest_day')$$,
  'User A cannot write User B story pages'
);
select pg_temp.expect_error(
  $$insert into public.story_likes (story_id, user_id)
    values ('33333333-3333-3333-3333-333333333333',
            '22222222-2222-2222-2222-222222222222')$$,
  'User A cannot write User B story likes'
);
select pg_temp.expect_error(
  $$update public.ai_usage_counters set used_count = 0
      where user_id = '22222222-2222-2222-2222-222222222222'$$,
  'User A cannot write User B counters'
);
select pg_temp.assert_true(
  not exists (select 1 from public.stories where id = '33333333-3333-3333-3333-333333333333'),
  'User A cannot read User B private stories'
);
select pg_temp.assert_true(
  not exists (select 1 from public.story_pages
    where story_id = '33333333-3333-3333-3333-333333333333'),
  'User A cannot read User B private pages'
);
select pg_temp.assert_true(
  not exists (select 1 from public.ai_usage_counters
    where user_id = '22222222-2222-2222-2222-222222222222'),
  'User A cannot read User B counters'
);
select pg_temp.assert_true(
  not exists (select 1 from public.story_likes
    where user_id = '22222222-2222-2222-2222-222222222222'),
  'User A cannot read User B story likes'
);
select pg_temp.assert_true(
  not exists (select 1 from storage.objects
    where bucket_id = 'story-illustrations'
      and name = '22222222-2222-2222-2222-222222222222/private.webp'),
  'User A cannot read User B story illustration objects'
);
reset role;

rollback;
