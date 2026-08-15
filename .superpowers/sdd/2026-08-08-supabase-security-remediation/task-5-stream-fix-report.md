# Task 5 stream-size fix report

## Scope

Resolved the P1 from `task-5-re-review.md`: an illustration request supplied
as a stream and exceeding 8 KiB no longer loses its client-error status at
the public error boundary.

## Root cause

`readStreamBody()` rejected oversized bodies with a local HTTP 413 error that
had no public error code. `toPublicError()` intentionally redacts unknown
errors as `internal_error`, which changed the response to HTTP 500.

## Changes

- Marked the oversized-body error as the existing safe `invalid_request`
  public error while retaining its 413 status.
- Preserved HTTP 413 for this explicitly marked `invalid_request` error in
  `toPublicError()`; other invalid requests keep their fixed HTTP 400 status.
- Added a regression test using a real Node `Readable` request stream whose
  JSON payload exceeds 8 KiB. It verifies the redacted 413 response, stable
  `invalid_request` code, absence of the local message, zero downstream
  requests, and `Vary: Origin`.

## TDD evidence

Before the implementation change, the new test failed with the expected
status-loss symptom:

```text
Expected values to be strictly equal:
500 !== 413
```

## Verification

All checks were local and used mocked fetch handlers; no remote service,
database, Docker, or deployment action was used.

```text
node --test tests/generate-story-illustration.test.js  # 12 passed, 0 failed
node --test tests/*.test.js                            # 45 passed, 0 failed
node --check api/generate-story-illustration.js        # passed
node --check api/_ai-usage.js                          # passed
git diff --check                                       # passed
```

## Commit

`fix: preserve image payload size errors`
