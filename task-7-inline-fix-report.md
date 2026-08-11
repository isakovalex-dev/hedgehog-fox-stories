# Task 7 — P1 inline-script remediation

## Cause

The global report-only CSP is intentionally promotable to an enforced policy
with `script-src 'self'`. Five static pages still contained executable inline
scripts, which the enforced policy would block.

## Changes

- Restored the About page click-tracking code as `js/aboutAnalytics.js`.
- Replaced the Vercel Analytics inline bootstrap on `about.html`,
  `privacy.html`, `requisites.html`, `terms.html`, and `endless-flight.html`
  with the existing external `/js/vercel-analytics.js?v=1` bootstrap.
- Added a global static HTML regression test. It discovers every root-level
  `.html` page and rejects every non-empty inline `<script>` body.
- Kept the CSP unchanged: it does not permit `unsafe-inline` for scripts.

## Verification

Run from the repository root:

```bash
node --test tests/security-headers.test.js
npm run build
node --test tests/*.test.js
git diff --check
```

Verified on 2026-08-11:

- security header tests: 5 passed
- full Node test suite: 54 passed
- static build: passed
- whitespace check: passed
