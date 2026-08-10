#!/usr/bin/env bash
set -euo pipefail

# This test is intentionally local-only. It opens two independent psql
# sessions as service_role and races the first free reservation for one user.
database_url="${SUPABASE_LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
test_user_id='44444444-4444-4444-4444-444444444444'
key_one='44444444-4444-4444-4444-444444444441'
key_two='44444444-4444-4444-4444-444444444442'
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

psql "$database_url" --set ON_ERROR_STOP=1 <<SQL
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '$test_user_id', '00000000-0000-0000-0000-000000000000', 'authenticated',
  'authenticated', 'task2-concurrent@example.invalid', '', now(), '{}'::jsonb,
  '{}'::jsonb, now(), now()
) on conflict (id) do nothing;
delete from public.ai_generation_reservations where user_id = '$test_user_id';
delete from public.ai_usage_counters where user_id = '$test_user_id';
delete from public.subscriptions where user_id = '$test_user_id';
SQL

run_reservation() {
  local key="$1"
  local output="$2"
  psql "$database_url" --set ON_ERROR_STOP=1 --tuples-only --no-align <<SQL >"$output"
begin;
set local role service_role;
select public.reserve_ai_usage('$test_user_id', 'story', '$key'::uuid);
select pg_sleep(2);
commit;
SQL
}

run_reservation "$key_one" "$work_dir/one.out" &
first_pid=$!
sleep 0.2
run_reservation "$key_two" "$work_dir/two.out" &
second_pid=$!
wait "$first_pid"
wait "$second_pid"

psql "$database_url" --set ON_ERROR_STOP=1 <<SQL
do \\$\$
declare
  v_reserved integer;
begin
  select count(*) into v_reserved
    from public.ai_generation_reservations
   where user_id = '$test_user_id' and resource_kind = 'story' and status = 'reserved';
  if v_reserved <> 1 then
    raise exception 'expected exactly one concurrent reservation, got %', v_reserved;
  end if;
end;
\$\$;
SQL

printf 'two-session service_role reservation test passed\n'
