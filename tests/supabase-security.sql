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

-- Image finalization changes the page and its image reservation atomically.
insert into public.stories (id, user_id, title, age_group, mood, lesson, visibility)
values ('44444444-4444-4444-4444-444444444444',
        '22222222-2222-2222-2222-222222222222',
        'Image finalization story', '5-6', '', '', 'private')
on conflict (id) do update set user_id = excluded.user_id;
insert into public.story_pages (id, story_id, page_number, text, scene_tag, image_url)
values
  ('55555555-5555-5555-5555-555555555555',
   '44444444-4444-4444-4444-444444444444', 1, 'CAS page', 'forest_day',
   'storage://story-illustrations/22222222-2222-2222-2222-222222222222/old-ref.webp'),
  ('66666666-6666-6666-6666-666666666666',
   '44444444-4444-4444-4444-444444444444', 2, 'Expired page', 'forest_day',
   'storage://story-illustrations/22222222-2222-2222-2222-222222222222/expired-old.webp'),
  ('77777777-7777-7777-7777-777777777777',
   '44444444-4444-4444-4444-444444444444', 3, 'Null URL page', 'forest_day',
   null)
on conflict (id) do update set image_url = excluded.image_url;
insert into storage.objects (bucket_id, name, owner_id)
values
  ('story-illustrations', '22222222-2222-2222-2222-222222222222/old-ref.webp',
   '22222222-2222-2222-2222-222222222222'),
  ('story-illustrations', '22222222-2222-2222-2222-222222222222/completed.webp',
   '22222222-2222-2222-2222-222222222222'),
  ('story-illustrations', '22222222-2222-2222-2222-222222222222/newer.webp',
   '22222222-2222-2222-2222-222222222222'),
  ('story-illustrations', '22222222-2222-2222-2222-222222222222/expired-old.webp',
   '22222222-2222-2222-2222-222222222222'),
  ('story-illustrations', '22222222-2222-2222-2222-222222222222/expired-new.webp',
   '22222222-2222-2222-2222-222222222222'),
  ('story-illustrations', '22222222-2222-2222-2222-222222222222/nullable-completed.webp',
   '22222222-2222-2222-2222-222222222222')
on conflict do nothing;

select public.reserve_ai_usage(
  '22222222-2222-2222-2222-222222222222', 'image',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba1'::uuid
);
select pg_temp.assert_true(
  (public.finalize_image_generation(
    (select id from public.ai_generation_reservations
      where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba1'::uuid),
    '55555555-5555-5555-5555-555555555555',
    'storage://story-illustrations/22222222-2222-2222-2222-222222222222/old-ref.webp',
    'storage://story-illustrations/22222222-2222-2222-2222-222222222222/completed.webp'
  )->>'completed') = 'true'
  and (select image_url from public.story_pages
        where id = '55555555-5555-5555-5555-555555555555') =
      'storage://story-illustrations/22222222-2222-2222-2222-222222222222/completed.webp'
  and (select used_count = 2 and reserved_count = 0 from public.ai_usage_counters
       where user_id = '22222222-2222-2222-2222-222222222222'
         and resource_kind = 'image'
       order by period_start desc limit 1),
  'successful image finalization changes the URL and consumes exactly one credit'
);
select pg_temp.assert_true(
  (public.finalize_image_generation(
    (select id from public.ai_generation_reservations
      where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba1'::uuid),
    '55555555-5555-5555-5555-555555555555',
    'storage://story-illustrations/22222222-2222-2222-2222-222222222222/old-ref.webp',
    'storage://story-illustrations/22222222-2222-2222-2222-222222222222/completed.webp'
  )->>'idempotency_replayed') = 'true'
  and (select used_count = 2 from public.ai_usage_counters
       where user_id = '22222222-2222-2222-2222-222222222222'
         and resource_kind = 'image'
       order by period_start desc limit 1),
  'completed image finalization replays without consuming another credit'
);

select public.reserve_ai_usage(
  '22222222-2222-2222-2222-222222222222', 'image',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba6'::uuid
);
select pg_temp.expect_error(
  $$select public.finalize_image_generation(
    (select id from public.ai_generation_reservations
      where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba6'::uuid),
    '77777777-7777-7777-7777-777777777777'::uuid,
    null::text,
    null::text
  )$$,
  'a null image URL is rejected before page or reservation changes'
);
select pg_temp.assert_true(
  (select image_url is null from public.story_pages
    where id = '77777777-7777-7777-7777-777777777777')
  and (select status = 'reserved' from public.ai_generation_reservations
       where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba6'::uuid)
  and (select used_count = 2 and reserved_count = 1 from public.ai_usage_counters
       where user_id = '22222222-2222-2222-2222-222222222222'
         and resource_kind = 'image'
       order by period_start desc limit 1),
  'null image URL leaves the page and reservation unchanged'
);
select public.release_ai_usage(
  (select id from public.ai_generation_reservations
    where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba6'::uuid)
);

update public.story_pages
   set image_url = 'storage://story-illustrations/22222222-2222-2222-2222-222222222222/newer.webp'
 where id = '55555555-5555-5555-5555-555555555555';
select public.reserve_ai_usage(
  '22222222-2222-2222-2222-222222222222', 'image',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba2'::uuid
);
select pg_temp.assert_true(
  (public.finalize_image_generation(
    (select id from public.ai_generation_reservations
      where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba2'::uuid),
    '55555555-5555-5555-5555-555555555555',
    'storage://story-illustrations/22222222-2222-2222-2222-222222222222/completed.webp',
    'storage://story-illustrations/22222222-2222-2222-2222-222222222222/old-ref.webp'
  )->>'code') = 'page_changed'
  and (select image_url from public.story_pages
        where id = '55555555-5555-5555-5555-555555555555') =
      'storage://story-illustrations/22222222-2222-2222-2222-222222222222/newer.webp'
  and (select status = 'released' from public.ai_generation_reservations
       where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba2'::uuid)
  and (select reserved_count = 0 from public.ai_usage_counters
       where user_id = '22222222-2222-2222-2222-222222222222'
         and resource_kind = 'image'
       order by period_start desc limit 1),
  'CAS conflict preserves the newer URL and releases the reservation once'
);
select pg_temp.assert_true(
  (public.finalize_image_generation(
    (select id from public.ai_generation_reservations
      where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba2'::uuid),
    '55555555-5555-5555-5555-555555555555',
    'storage://story-illustrations/22222222-2222-2222-2222-222222222222/completed.webp',
    'storage://story-illustrations/22222222-2222-2222-2222-222222222222/old-ref.webp'
  )->>'code') = 'reservation_terminal'
  and (select used_count = 2 and reserved_count = 0 from public.ai_usage_counters
       where user_id = '22222222-2222-2222-2222-222222222222'
         and resource_kind = 'image'
       order by period_start desc limit 1),
  'CAS conflict retry is terminal and does not release capacity twice'
);

select public.reserve_ai_usage(
  '22222222-2222-2222-2222-222222222222', 'image',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba3'::uuid
);
update public.ai_generation_reservations
   set created_at = now() - interval '20 minutes',
       expires_at = now() - interval '1 second'
 where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba3'::uuid;
select pg_temp.assert_true(
  (public.finalize_image_generation(
    (select id from public.ai_generation_reservations
      where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba3'::uuid),
    '66666666-6666-6666-6666-666666666666',
    'storage://story-illustrations/22222222-2222-2222-2222-222222222222/expired-old.webp',
    'storage://story-illustrations/22222222-2222-2222-2222-222222222222/expired-new.webp'
  )->>'code') = 'reservation_expired'
  and (select image_url from public.story_pages
        where id = '66666666-6666-6666-6666-666666666666') =
      'storage://story-illustrations/22222222-2222-2222-2222-222222222222/expired-old.webp'
  and (select status = 'released' from public.ai_generation_reservations
       where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba3'::uuid)
  and (select reserved_count = 0 from public.ai_usage_counters
       where user_id = '22222222-2222-2222-2222-222222222222'
         and resource_kind = 'image'
       order by period_start desc limit 1),
  'expired image reservation preserves the URL and does not leak reserved capacity'
);
select pg_temp.assert_true(
  (public.finalize_image_generation(
    (select id from public.ai_generation_reservations
      where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba3'::uuid),
    '66666666-6666-6666-6666-666666666666',
    'storage://story-illustrations/22222222-2222-2222-2222-222222222222/expired-old.webp',
    'storage://story-illustrations/22222222-2222-2222-2222-222222222222/expired-new.webp'
  )->>'code') = 'reservation_terminal'
  and (select used_count = 2 and reserved_count = 0 from public.ai_usage_counters
       where user_id = '22222222-2222-2222-2222-222222222222'
         and resource_kind = 'image'
       order by period_start desc limit 1),
  'expired reservation retry is terminal and does not release capacity twice'
);

insert into public.stories (id, user_id, title, age_group, mood, lesson, visibility)
values ('88888888-8888-8888-8888-888888888888',
        '11111111-1111-1111-1111-111111111111',
        'User A image page', '5-6', '', '', 'private')
on conflict (id) do update set user_id = excluded.user_id;
insert into public.story_pages (id, story_id, page_number, text, scene_tag, image_url)
values ('99999999-9999-9999-9999-999999999999',
        '88888888-8888-8888-8888-888888888888', 1, 'Foreign page', 'forest_day',
        'storage://story-illustrations/11111111-1111-1111-1111-111111111111/foreign-old.webp')
on conflict (id) do update set image_url = excluded.image_url;
select public.reserve_ai_usage(
  '22222222-2222-2222-2222-222222222222', 'image',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba4'::uuid
);
select pg_temp.assert_true(
  (public.finalize_image_generation(
    (select id from public.ai_generation_reservations
      where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba4'::uuid),
    '99999999-9999-9999-9999-999999999999',
    'storage://story-illustrations/11111111-1111-1111-1111-111111111111/foreign-old.webp',
    'storage://story-illustrations/22222222-2222-2222-2222-222222222222/old-ref.webp'
  )->>'code') = 'page_not_owned'
  and (select image_url from public.story_pages
       where id = '99999999-9999-9999-9999-999999999999') =
      'storage://story-illustrations/11111111-1111-1111-1111-111111111111/foreign-old.webp'
  and (select status = 'released' from public.ai_generation_reservations
       where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba4'::uuid)
  and (select used_count = 2 and reserved_count = 0 from public.ai_usage_counters
       where user_id = '22222222-2222-2222-2222-222222222222'
         and resource_kind = 'image'
       order by period_start desc limit 1),
  'foreign page is unchanged and its reservation is released once'
);
select pg_temp.assert_true(
  (public.finalize_image_generation(
    (select id from public.ai_generation_reservations
      where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba4'::uuid),
    '99999999-9999-9999-9999-999999999999',
    'storage://story-illustrations/11111111-1111-1111-1111-111111111111/foreign-old.webp',
    'storage://story-illustrations/22222222-2222-2222-2222-222222222222/old-ref.webp'
  )->>'code') = 'reservation_terminal'
  and (select used_count = 2 and reserved_count = 0 from public.ai_usage_counters
       where user_id = '22222222-2222-2222-2222-222222222222'
         and resource_kind = 'image'
       order by period_start desc limit 1),
  'foreign-page retry is terminal and does not release capacity twice'
);

select public.reserve_ai_usage(
  '22222222-2222-2222-2222-222222222222', 'image',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba7'::uuid
);
select pg_temp.assert_true(
  (public.finalize_image_generation(
    (select id from public.ai_generation_reservations
      where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba7'::uuid),
    '77777777-7777-7777-7777-777777777777',
    null::text,
    'storage://story-illustrations/22222222-2222-2222-2222-222222222222/nullable-completed.webp'
  )->>'completed') = 'true'
  and (select image_url from public.story_pages
        where id = '77777777-7777-7777-7777-777777777777') =
      'storage://story-illustrations/22222222-2222-2222-2222-222222222222/nullable-completed.webp'
  and (select status = 'completed' from public.ai_generation_reservations
       where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba7'::uuid)
  and (select used_count = 3 and reserved_count = 0 from public.ai_usage_counters
       where user_id = '22222222-2222-2222-2222-222222222222'
         and resource_kind = 'image'
       order by period_start desc limit 1),
  'nullable page URL finalization succeeds and consumes exactly one credit'
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

select pg_temp.assert_true(
  to_regprocedure('public.finalize_image_generation(uuid, uuid, text, text)') is not null,
  'the exact four-argument image finalizer exists'
);
select pg_temp.assert_true(
  (select p.prosecdef
     from pg_proc p
    where p.oid = to_regprocedure('public.finalize_image_generation(uuid, uuid, text, text)')),
  'the image finalizer is SECURITY DEFINER'
);
select pg_temp.assert_true(
  (select coalesce(p.proconfig, array[]::text[]) @> array['search_path=public, pg_temp']
     from pg_proc p
    where p.oid = to_regprocedure('public.finalize_image_generation(uuid, uuid, text, text)')),
  'the image finalizer pins search_path to public, pg_temp'
);
select pg_temp.assert_true(
  not exists (
    select 1
      from pg_proc p
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
     where p.oid = to_regprocedure('public.finalize_image_generation(uuid, uuid, text, text)')
       and acl.grantee = 0
       and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC has no execute privilege on the image finalizer'
);
select pg_temp.assert_true(
  not has_function_privilege(
    'anon',
    'public.finalize_image_generation(uuid, uuid, text, text)',
    'EXECUTE'
  ),
  'anon has no execute privilege on the image finalizer'
);
select pg_temp.assert_true(
  not has_function_privilege(
    'authenticated',
    'public.finalize_image_generation(uuid, uuid, text, text)',
    'EXECUTE'
  ),
  'authenticated has no execute privilege on the image finalizer'
);
select pg_temp.assert_true(
  has_function_privilege(
    'service_role',
    'public.finalize_image_generation(uuid, uuid, text, text)',
    'EXECUTE'
  ),
  'service_role can execute the image finalizer'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.assert_true(
  not has_function_privilege(
    'authenticated',
    'public.finalize_image_generation(uuid, uuid, text, text)',
    'EXECUTE'
  ),
  'authenticated has no execute privilege on image finalization RPC'
);
select pg_temp.expect_error(
  $$select public.reserve_ai_usage(
    '11111111-1111-1111-1111-111111111111', 'story',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::uuid)$$,
  'authenticated cannot execute a service-role-only reservation RPC'
);
select pg_temp.expect_error(
  $$select public.finalize_image_generation(
    (select id from public.ai_generation_reservations
      where idempotency_key = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbba1'::uuid),
    '55555555-5555-5555-5555-555555555555'::uuid,
    'storage://story-illustrations/22222222-2222-2222-2222-222222222222/completed.webp',
    'storage://story-illustrations/22222222-2222-2222-2222-222222222222/completed.webp'
  )$$,
  'authenticated cannot execute a service-role-only image finalization RPC'
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
