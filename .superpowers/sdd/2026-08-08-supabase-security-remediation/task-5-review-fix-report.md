# Task 5 review-fix report

## Scope

Resolved every Task 5 review finding in the illustration endpoint. This pass
used only local files and mocked Node fetch handlers: no remote, CLI, Docker,
or database operation was run.

## Changes

- Added `createInvalidRequestError()` in
  `api/generate-story-illustration.js`. It marks local request parsing and
  image-input validation failures with the stable `invalid_request` public
  code. The existing `toPublicError()` boundary therefore returns only the
  fixed 400 response and never exposes the local validation text.
- Updated all local image-input validation paths: invalid JSON, story ID, page
  number, generation mode, selected-reference count and validity, incompatible
  references, and missing iteration instructions.
- Added a table-driven regression test for invalid JSON, story ID, page
  number, and generation mode. It asserts the stable 400 payload and confirms
  the original validation detail is absent.
- Added distinct post-reservation failure tests for the page-link PATCH and
  `complete_ai_usage` RPC. Each verifies that the same pending reservation is
  released exactly once and the response is the redacted fixed
  `internal_error` payload.

## TDD evidence

The new validation regression test was run before the implementation change:

```text
node --test tests/generate-story-illustration.test.js
FAIL local image validation failures return a redacted invalid_request response
500 !== 400
```

The two late-failure tests passed against the existing catch/release flow,
confirming the previously implemented behavior while making it a permanent
regression contract.

## Verification

All commands completed locally after the change:

```text
node --test tests/generate-story-illustration.test.js  # 11 passed, 0 failed
node --test tests/*.test.js                            # 44 passed, 0 failed
node --check api/generate-story-illustration.js        # exit 0
git diff --check                                       # exit 0
```

## Commit

`fix: redact image validation failures`
