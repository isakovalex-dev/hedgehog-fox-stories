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

-- The harness seeds these auth identities before this script runs.
select pg_temp.assert_true(
  exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'ai_usage_counters'
       and policyname = 'ai_usage_counters_owner_read'
  ),
  'counter owner-read policy is installed'
);

select pg_temp.assert_true(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'reserve_ai_usage'
  ),
  'reserve_ai_usage exists'
);

rollback;
