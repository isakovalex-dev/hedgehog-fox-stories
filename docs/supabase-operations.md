## Local database verification

```bash
supabase start
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  --set ON_ERROR_STOP=1 \
  --file tests/supabase-security.sql
```

The command targets only the local Docker database. It must not be run with a production connection string.

## CSP staging rollout

The initial non-production deployment sends
`Content-Security-Policy-Report-Only`. Before enforcing it, browse the landing
page, authentication, story generation mock mode, library, illustration display,
and checkout return route. Record every Report-Only CSP violation in browser
DevTools and add only an explicitly observed, required source. Do not add a
wildcard source or `unsafe-inline` to `script-src`.

After 48 hours without a functional violation, replace the
`Content-Security-Policy-Report-Only` key in `vercel.json` with
`Content-Security-Policy`, keeping its value unchanged. Update
`tests/security-headers.test.js` to require the enforced header and to reject
the Report-Only header before deploying the enforced policy.

Verify headers on the non-production URL before and after promotion:

```bash
curl --silent --show-error --head "https://staging.example.invalid" | \
  rg -i "content-security-policy|strict-transport-security|x-content-type-options|referrer-policy|permissions-policy|x-frame-options|cross-origin-opener-policy"
```

Replace only `https://staging.example.invalid` with the real non-production URL.
