# Task 7 review-fix report

## Review findings resolved

1. The approved browser-header contract is present in `vercel.json` and is
   covered by `tests/security-headers.test.js`: HSTS, `nosniff`,
   `strict-origin-when-cross-origin`, the approved Permissions-Policy,
   `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, and the
   exact Report-Only CSP including `https://va.vercel-scripts.com` in
   `connect-src`. The enforced `Content-Security-Policy` header remains absent
   during observation.
2. `docs/supabase-operations.md` defines the required 48-hour non-production
   Report-Only observation period and the promotion procedure: replace
   `Content-Security-Policy-Report-Only` with `Content-Security-Policy`, retain
   the value, and never ship both headers together.
3. `404.html` now loads `/js/notFoundRedirect.js` and
   `/js/vercelAnalytics.js` with root-relative paths. This keeps both assets
   reachable when Vercel serves the document for a nested unknown URL such as
   `/missing/path`. The redirect preserves the requested path, query string,
   and fragment in `/?route=...`.

## TDD evidence

The new test `404 redirect and analytics scripts stay reachable from a nested
missing URL` was added before the 404 markup and external files. It failed
because the 404 page did not reference the required root-relative assets. The
minimal 404 and external-script changes made it pass.

## Local verification

```text
node --test tests/security-headers.test.js  # 4 passed
npm run build                               # passed
node --test tests/*.test.js                 # 53 passed
git diff --check                            # passed
```

No remote, deployment, database, or Docker operation was run.
