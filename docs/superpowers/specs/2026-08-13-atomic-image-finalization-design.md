# Atomic Image Finalization Design

**Date:** 2026-08-13
**Status:** Approved for implementation
**Scope:** Correct two image-generation races found in the final security review. This extends, but does not replace, `2026-08-08-security-remediation-design.md`.

## Goal

Make the final image-generation state durable and race-safe. A successful image credit must always correspond to the page reference that selected the uploaded object, and error recovery must never delete a completed image or overwrite a newer page image.

## Context

The current handler uploads an object, updates `story_pages.image_url`, then calls `complete_ai_usage`. Those are separate operations. If the database commits completion but its response is lost, the handler cannot distinguish success from failure and may delete the paid object. A compensating update that restores the old `image_url` can also overwrite a newer successful forced or iteration generation.

## Decision

Add one server-only PostgreSQL function:

```sql
public.finalize_image_generation(
  p_reservation_id uuid,
  p_page_id uuid,
  p_expected_image_url text,
  p_new_image_url text
) returns jsonb
```

The Vercel image handler uploads the WebP object first, then calls this function instead of PATCHing `story_pages` and separately calling `complete_ai_usage`.

The function is the sole operation that changes a page to the uploaded image and consumes the matching image reservation. It is `SECURITY DEFINER`, has `search_path = public, pg_temp`, is revoked from `PUBLIC`, `anon`, and `authenticated`, and is granted only to `service_role`.

## Transaction behaviour

The function performs all of the following in one PostgreSQL transaction:

1. Validates that the reservation exists, has resource kind `image`, and resolves its immutable usage-counter key.
2. Locks the usage counter, then the reservation, matching the existing global lock order.
3. Handles terminal states without changing the page:
   - a completed reservation returns `completed: true` with `idempotency_replayed: true`;
   - a released reservation returns a safe rejection;
   - an expired reservation is released and its reserved count is decremented exactly once.
4. Locks the requested page and verifies through `stories.user_id` that it belongs to the reservation user.
5. Validates that the new reference is a `storage://story-illustrations/<reservation-user-id>/...webp` path.
6. Uses `image_url IS NOT DISTINCT FROM p_expected_image_url` when updating the page. The update therefore succeeds only if the page still has the value read before the provider call.
7. Only after that compare-and-swap succeeds, sets the reservation to `completed`, decrements `reserved_count`, and increments `used_count`.

If the page no longer has the expected reference, the function releases the reservation and returns `completed: false, code: 'page_changed'`; it never touches the newer page value.

## Handler behaviour

The handler tracks three states: finalization not started, finalization rejected by a database response, and finalization outcome unknown because the RPC did not return a valid response.

- Before finalization, provider or upload failures release the reservation. An uploaded but unlinked object is deleted when its path is known.
- A database rejection (`reservation_expired`, `page_changed`, ownership failure, or released reservation) has already released the reservation in the transaction. The handler deletes only the new unlinked object; it does not update `story_pages` and does not call `release_ai_usage` again.
- On successful finalization, the handler returns the generated image and quota usage. A replayed successful finalization is also success and does not increment usage again.
- When the RPC response is lost or malformed, the outcome is unknown. The handler returns the existing static 500 response and deliberately performs neither object deletion nor reservation release. This can leave a recoverable orphan or a short-lived reservation, but it cannot delete a completed paid image or free a consumed credit.

The handler removes the old `saveImageReference` and restoration compensation path. It never PATCHes `story_pages` directly.

## Error handling and observability

Client-visible errors remain the existing static `internal_error` response; database codes and upstream responses remain server-only. The handler logs the existing redacted event shape and adds an outcome marker only, never a key, bearer token, prompt, page text, or provider body.

The existing ten-minute reservation expiry remains the recovery path for an unknown operation that did not commit. Cleanup of a confirmed database rejection is best effort and logs only a redacted error classification.

## Test strategy

1. Add a failing Node unit test for the new service-role RPC helper and its exact parameter body.
2. Add failing handler tests proving that a successful finalization performs no REST page PATCH, a database rejection deletes only the newly uploaded object without a second release, and an unknown finalizer result performs neither delete nor release.
3. Extend the SQL contract to assert the function signature, function grants, `SECURITY DEFINER` search path, counter-to-reservation lock order, ownership predicate, idempotent completed result, and `IS NOT DISTINCT FROM` compare-and-swap.
4. Keep the existing local SQL contract, real two-session concurrency script, RLS/ACL audit, advisors, staging, and production rollout gates. The local Docker lifecycle fault currently prevents treating those runtime gates as passed.

## Non-goals

- No new queue, Redis, storage bucket, background worker, or managed service.
- No remote Supabase query, migration application, credential access, paid provider request, or staging/production deployment during implementation.
- No change to browser-facing authentication, plan limits, or the story-generation finalizer.
