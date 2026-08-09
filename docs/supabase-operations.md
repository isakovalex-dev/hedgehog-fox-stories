## Local database verification

```bash
supabase start
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  --set ON_ERROR_STOP=1 \
  --file tests/supabase-security.sql
```

The command targets only the local Docker database. It must not be run with a production connection string.
