# Security Remediation Design

**Date:** 2026-08-08
**Status:** Approved design; implementation has not started.
**Source:** `SECURITY-AUDIT.md`, findings SEC-001 through SEC-009.

## Goal

Eliminate unbounded AI consumption and direct quota bypasses, make Supabase authorization reproducible, and add browser/deployment hardening without changing product flows or adding a new managed service.

## Chosen approach

Use Supabase/PostgreSQL as the sole durable authority for subscription entitlements, quotas, idempotency, concurrency reservations, and per-user rate windows. Vercel Functions remain the only components that can call paid providers and the only callers allowed to reserve or consume AI quota.

This intentionally does not add Redis, Upstash, a queue, or a new application framework. A queue may be considered later only if normal image traffic requires asynchronous processing.

## Explicit product policy

| Plan | Stories per billing period | Images per billing period | Concurrent story jobs | Concurrent image jobs |
| --- | ---: | ---: | ---: | ---: |
| `free` | 1 | 0 | 1 | 1 |
| `trial` | 3 | 0 | 1 | 1 |
| `active` / family | 20 | 20 | 1 | 1 |
| `expired` | 0 | 0 | 0 | 0 |

- An image regeneration, including `force: true`, consumes one image credit.
- Model, size, quality, page count and provider endpoint remain server-owned configuration; browser input cannot override them.
- A reservation expires in 10 minutes. The next reservation transaction releases any expired reservation for that user/resource before checking capacity. This avoids a cron dependency.
- One authenticated user may start at most 6 story requests and 12 image requests in a rolling 10-minute window. These are secondary abuse limits; periodic quota and the one-active-job lock are the primary financial controls.
- Supabase Auth dashboard configuration must require email confirmation, CAPTCHA, and its own signup/login/password-reset rate limits. This limits new-account abuse before an authenticated Vercel route is reached.

## Data model

### Existing tables retained

- `subscriptions` remains the payment state and current billing-period authority.
- `payment_events` remains the immutable YooKassa idempotency record.
- `stories`, `story_pages`, `story_likes` and private `story-illustrations` remain product data.
- Existing `generation_usage` is retained only temporarily for migration compatibility and UI migration; it is not an authorization source after this release.

### New `ai_usage_counters`

One row represents one user, one resource and one billing period.

```text
user_id uuid references auth.users
resource_kind text: story | image
period_start timestamptz
period_end timestamptz
limit_count integer >= 0
used_count integer >= 0
reserved_count integer >= 0
primary key (user_id, resource_kind, period_start)
```

The `period_start` comes from the current subscription row. `used_count + reserved_count <= limit_count` is checked while the row is locked.

### New `ai_generation_reservations`

```text
id uuid primary key
user_id uuid references auth.users
resource_kind text: story | image
idempotency_key uuid
status text: reserved | completed | released
counter_period_start timestamptz
expires_at timestamptz
created_at timestamptz
completed_at timestamptz nullable
unique (user_id, resource_kind, idempotency_key)
```

The database creates a reservation before a paid provider call. Repeating the same idempotency key returns the existing terminal result or conflicts while a matching request is active; it cannot create a second charge.

### New `api_rate_windows`

```text
user_id uuid references auth.users
action text: story | image | checkout | webhook
window_started_at timestamptz
request_count integer >= 0
primary key (user_id, action, window_started_at)
```

The Vercel backend updates it only through a service-role function. It uses 10-minute UTC buckets. IP-rate controls remain at Supabase Auth/Vercel WAF configuration because a user-controlled forwarded-address header is not a reliable sole identity source.

## Database functions and permissions

All functions set `search_path = public, pg_temp` and use explicit schema-qualified objects.

1. `reserve_ai_usage(p_user_id uuid, p_resource_kind text, p_idempotency_key uuid)`
   - Executable by `service_role` only.
   - Locks the latest valid subscription row for `p_user_id`.
   - Rejects expired/non-entitled plans.
   - Releases expired reservations for the same user/resource.
   - Upserts and locks the matching counter.
   - Enforces plan quota, one active reservation and the configured rolling rate window.
   - Inserts and returns one reservation ID.

2. `complete_ai_usage(p_reservation_id uuid)`
   - Executable by `service_role` only.
   - Locks reservation and counter; changes `reserved` to `completed`; decrements `reserved_count`; increments `used_count` exactly once.

3. `release_ai_usage(p_reservation_id uuid)`
   - Executable by `service_role` only.
   - Locks reservation and counter; changes `reserved` to `released`; decrements `reserved_count` exactly once.

4. `get_current_usage()`
   - Executable by `authenticated` only.
   - Reads `auth.uid()` only, returns a small JSON object with the current plan and remaining story/image counts.
   - Never creates rows or mutates quota.

Authenticated users receive no execute grant for reservation, completion, release, payment application, or generic story-finalisation functions. The old directly executable `create_generated_story_with_usage` function is revoked from `authenticated` and replaced by a server-only equivalent that requires a completed story reservation.

## Backend request flow

### Text story generation

```text
Browser -> POST /api/generate-story with Bearer JWT + X-Idempotency-Key
Vercel -> validate JWT, body and UUID key
Vercel -> reserve_ai_usage(user, story, key) using service role
Vercel -> call configured OpenAI-compatible provider
Vercel -> atomically save story/pages and complete reservation
Vercel -> release reservation on every provider, validation or persistence error
Vercel -> return saved story and remaining quota
```

### Image generation

```text
Browser -> POST /api/generate-story-illustration with Bearer JWT + key
Vercel -> verify owner can read the requested story/page through RLS
Vercel -> reserve_ai_usage(user, image, key) using service role
Vercel -> call OpenAI Images, upload to private Storage, save reference
Vercel -> complete reservation after all writes succeed
Vercel -> release reservation on every failure
```

`force: true` follows exactly the same reservation route as the first illustration. Returning an existing image without generation consumes no credit.

### Payment and subscription flow

The YooKassa webhook continues to re-fetch payment state from YooKassa and validates shop, status, paid flag, amount, currency and metadata. The payment SQL upserts one current subscription row and initializes/refreshed counters for both resources. A repeated provider payment remains a no-op through `payment_events` uniqueness.

### Usage status flow

The frontend uses `get_current_usage()` only to display remaining quota. It must treat the response as presentation data: each paid API independently reserves access server-side.

## Authorization and RLS

All user data policies live in versioned Supabase migrations.

- `stories`: owner can read/write/delete own private stories; public stories have an explicit read-only public policy.
- `story_pages`: access follows the owning story through an `exists` ownership predicate; no `USING (true)` policy.
- `story_likes`: user can read/insert/delete only a row where `user_id = auth.uid()`.
- `subscriptions`, `generation_usage`, `ai_usage_counters`, `ai_generation_reservations`, `api_rate_windows` and `payment_events`: browser roles receive only narrowly needed SELECT; write permission is server-only.
- `story-illustrations` stays private and permits authenticated reads only when the first object-path segment is `auth.uid()::text`.

The deployment pipeline must apply migrations to a non-production Supabase project first. Production migration remains a manual, explicitly approved operation; the implementation must not change production SQL automatically.

## Browser and Vercel hardening

- `vercel.json` adds CSP in Report-Only mode first, then enforced CSP after observing normal browser traffic.
- Add HSTS retention, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, strict `Permissions-Policy`, `X-Frame-Options: DENY`, and CSP `frame-ancestors 'none'`.
- API CORS responses add `Vary: Origin`, retain the exact production origin allowlist, and do not enable credentials.
- API errors return static public messages/codes; diagnostic objects remain in redacted server logs.
- The session remains current client-side Supabase Auth in this release. Moving refresh tokens to HttpOnly BFF cookies is an independent subsequent project because it changes the authentication architecture.

## Failure handling and observability

- No provider call occurs if reserve fails.
- Provider/storage/database failures release the reservation in a `finally` path; a 10-minute expiry recovers from process crashes.
- The server logs event type, resource kind, reservation ID, status, duration and provider request ID. It does not log bearer tokens, cookies, API keys, raw prompts, story pages, payment credentials or full personal data.
- Alert thresholds: reserve rejections, repeated idempotency conflicts, provider failures, webhook failures, and quota consumption above normal family use.

## Test strategy

1. Unit-test every migration function in a disposable Supabase project: free/trial/family/expired plan, quota exhausted, duplicate key, expiry release, and concurrent reservation attempts.
2. Test Vercel handlers with mocked providers: no provider call after reserve rejection; exactly one provider call for an idempotent retry; release after provider failure.
3. Run RLS tests with exactly two disposable accounts and assert User A cannot SELECT, INSERT, UPDATE or DELETE User B data, including Storage signed URL requests.
4. Test YooKassa duplicate delivery and forged payload; verify only a re-fetched valid payment can activate entitlement.
5. Run a browser header test for CSP, clickjacking prevention, CORS `Vary`, and public route behavior.

## Out of scope for this implementation plan

- Migration from client-side Supabase sessions to BFF HttpOnly cookies.
- A background queue, Redis, Upstash, or provider change.
- Migration execution against production, creation of real production test users, paid AI calls, or real payments.
