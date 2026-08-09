-- Supabase RLS audit for "Ежонок и Лисёнок".
-- Run this in Supabase SQL Editor.
-- The result should be reviewed before broader public sharing.

with expected_tables(table_name) as (
  values
    ('stories'),
    ('story_pages'),
    ('story_likes'),
    ('subscriptions'),
    ('generation_usage'),
    ('payment_events'),
    ('ai_usage_counters'),
    ('ai_generation_reservations'),
    ('api_rate_windows')
),
rls_status as (
  select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
)
select
  expected_tables.table_name,
  coalesce(rls_status.rls_enabled, false) as rls_enabled,
  coalesce(rls_status.rls_forced, false) as rls_forced,
  case
    when rls_status.table_name is null then 'missing_table'
    when rls_status.rls_enabled then 'ok'
    else 'rls_disabled'
  end as audit_status
from expected_tables
left join rls_status using (table_name)
order by expected_tables.table_name;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'stories',
    'story_pages',
    'story_likes',
    'subscriptions',
    'generation_usage',
    'payment_events',
    'ai_usage_counters',
    'ai_generation_reservations',
    'api_rate_windows'
  )
order by tablename, policyname;

with policy_counts as (
  select
    tablename,
    count(*) as policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'stories',
      'story_pages',
      'story_likes',
      'subscriptions',
      'generation_usage'
    )
  group by tablename
),
expected_tables(table_name, minimum_policy_count) as (
  values
    ('stories', 5),
    ('story_pages', 4),
    ('story_likes', 3),
    ('subscriptions', 1),
    ('generation_usage', 1),
    ('payment_events', 0),
    ('ai_usage_counters', 1),
    ('ai_generation_reservations', 0),
    ('api_rate_windows', 0)
)
select
  expected_tables.table_name,
  coalesce(policy_counts.policy_count, 0) as policy_count,
  expected_tables.minimum_policy_count,
  case
    when coalesce(policy_counts.policy_count, 0) >= expected_tables.minimum_policy_count then 'ok'
    else 'review_required'
  end as audit_status
from expected_tables
left join policy_counts on policy_counts.tablename = expected_tables.table_name
order by expected_tables.table_name;

select
  routine_schema,
  routine_name,
  routine_type,
  data_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'create_generated_story_with_usage';

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type,
  case
    when p.prosecdef then 'security_definer'
    else 'security_invoker'
  end as security_mode
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'create_generated_story_with_usage';

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proacl as function_acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'reserve_ai_usage',
    'complete_ai_usage',
    'release_ai_usage',
    'enforce_api_rate_limit',
    'create_story_from_reservation',
    'get_current_usage',
    'apply_yookassa_payment',
    'create_generated_story_with_usage',
    'get_generation_access'
  )
order by p.proname, pg_get_function_identity_arguments(p.oid);

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname = 'story_illustrations_owner_read';
