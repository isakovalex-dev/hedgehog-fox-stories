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
      'generation_usage',
      'payment_events',
      'ai_usage_counters',
      'ai_generation_reservations',
      'api_rate_windows'
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

-- Function ACL audit. The legacy functions may still exist for migration
-- compatibility, but no browser role or service_role may execute them.
with expected_functions(function_name, authenticated_execute, service_role_execute) as (
  values
    ('reserve_ai_usage', false, true),
    ('complete_ai_usage', false, true),
    ('release_ai_usage', false, true),
    ('enforce_api_rate_limit', false, true),
    ('create_story_from_reservation', false, true),
    ('get_current_usage', true, false),
    ('apply_yookassa_payment', false, true),
    ('create_generated_story_with_usage', false, false),
    ('get_generation_access', false, false)
), function_privileges as (
  select
    expected_functions.*,
    p.oid,
    pg_get_function_identity_arguments(p.oid) as arguments,
    p.prosecdef as security_definer,
    p.proacl as function_acl,
    has_function_privilege('anon', p.oid, 'execute') as anon_execute,
    has_function_privilege('authenticated', p.oid, 'execute') as actual_authenticated_execute,
    has_function_privilege('service_role', p.oid, 'execute') as actual_service_role_execute
  from expected_functions
  left join pg_proc p
    on p.proname = expected_functions.function_name
   and p.pronamespace = 'public'::regnamespace
)
select
  function_name,
  arguments,
  security_definer,
  function_acl,
  anon_execute,
  actual_authenticated_execute as authenticated_execute,
  actual_service_role_execute as service_role_execute,
  case
    when oid is null then 'missing_function'
    when anon_execute or actual_authenticated_execute <> authenticated_execute
      then 'browser_execute_grant'
    when actual_service_role_execute <> service_role_execute
      then 'service_role_grant_mismatch'
    else 'ok'
  end as audit_status
from function_privileges
order by function_name, arguments;

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
