# Task 4 review-fix report

## Scope

Resolved the Task 4 P0/P2 finalizer contract mismatch locally. No remote,
Supabase CLI, Docker, database, credential, or network operations were used.

## Changes

- `api/generate-story.js` now supplies `finalizeStoryReservation()` with its
  approved flattened contract: `reservationId`, `title`, `ageGroup`, `mood`,
  `lesson`, `visibility`, and a nonempty `pages` array.
- The finalizer page payload is explicitly converted from generated camelCase
  fields to the SQL RPC's snake_case fields: `page_number`, `text`,
  `scene_tag`, `image_url`, and `image_prompt`.
- The existing reservation release and error behavior is unchanged.
- `tests/generate-story-security.test.js` now asserts the complete
  `create_story_from_reservation` request body, including all metadata, private
  visibility, page content, and snake_case page keys.

## TDD evidence

The strengthened focused test was run before the production fix:

```bash
node --test tests/generate-story-security.test.js
```

It failed in the accepted-request case with HTTP 500 instead of 200 because the
new complete RPC-body assertion rejected the previous `p_pages: null` payload.

## Verification

All commands were local in the Task 4 worktree:

```bash
node --test tests/generate-story-security.test.js
node --test tests/create-story-contract.test.js
node --test tests/*.test.js
node --check api/generate-story.js
git diff --check
```

Results: focused security tests passed (4/4), story contract tests passed (1/1),
and the full Node suite passed (36/36). Syntax and diff checks exited successfully.

## No-remote evidence

The tests replace `global.fetch` with local handlers for the provider and
Supabase URLs; they do not issue network requests. No remote or database tooling
was invoked during this review fix.

## Commit

`fix: finalize generated stories atomically`
