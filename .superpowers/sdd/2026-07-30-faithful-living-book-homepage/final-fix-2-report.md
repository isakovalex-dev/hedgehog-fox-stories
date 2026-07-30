# Final fix 2 report

## Status

Implemented all six reviewed code fixes on top of `175537e` without changing APIs,
the discovery storage schema, story content, source labels, or the two production
games. User-owned untracked files remained untouched.

## Findings verified and fixed

1. **Journey semantics**
   - Root cause: `renderJourney()` compared saved `discovery.storyId` values with
     the single canonical `storyId` on each journey point.
   - `HFJourneyService.getDiscoveredPlaceIds()` now derives normalized place IDs
     from `discovery.place`.
   - `HFJourneyService.getJourneyProgress()` matches journey points by `place.id`
     and clamps progress to `0..1`.
   - Storage remains one discovery per story with the existing fields
     `storyId`, `place`, `keepsake`, and `discoveredAt`.
   - Behavioral coverage uses the two built-in meadow stories
     `warm-wind-map` and `rustling-grass` plus `user-meadow-story`; all three
     discoveries resolve to one discovered place and progress `0.25`.

2. **Accessible journey state**
   - Each map point now derives one `status` value and uses it in both the visible
     status and the accessible name: `Исследовано` or `В путь`.

3. **Normal-text contrast**
   - Darkened both rust tokens to `#9a4f2f`.
   - WCAG calculations in the test suite:
     - on journey paper `#f7f2e5`: `5.317:1`;
     - on homepage paper `#f4ebd4`: `5.004:1`;
     - on light homepage paper `#fbf5e6`: `5.464:1`.

4. **Progressive story links**
   - `#storyList` now contains six ordinary built-in story links in source HTML.
   - Normal JavaScript continues to replace the fallback with rendered cards.
   - Source labels remain exactly `Моя история` and `История от автора`.

5. **Route-aware homepage isolation**
   - A synchronous bootstrap keeps `home-page` only for `/` and `/index.html`,
     including correct handling of the `?route=` 404 fallback.
   - `applyRoute()` synchronizes the class before story-route rendering.
   - Numbered book cards are emitted only when `activeRoute === "home"`.
   - Homepage-only brand artwork and book-route decoration are hidden outside
     home so internal layouts retain their pre-book appearance.

6. **About/legal isolation**
   - Compared the pages against merge-base
     `69268e55b2f92361660aed227c2229ccc8fbe7bd`.
   - Removed journey token/theme imports and `journey-theme` body classes from
     `about.html`, `privacy.html`, `terms.html`, and `requisites.html`.
   - Restored their legacy Cormorant Garamond font request.
   - Preserved ordinary application routes, analytics hooks/scripts, content,
     and the intrinsic artwork-proportion fix (moved to scoped legacy CSS).

## TDD evidence

Each production change followed a focused RED then GREEN run:

- shared-place journey test failed because
  `getDiscoveredPlaceIds` did not exist, then passed `4/4`;
- accessible-state contract failed on the missing shared status, then passed;
- contrast test failed at `3.23:1`, then passed above `5.00:1`;
- source fallback test failed with zero links, then passed with six;
- route bootstrap/card-isolation tests failed, then passed;
- standalone-page theme and artwork tests failed, then passed;
- final self-review guard for book-only internal-route DOM failed, then passed.

Focused final result: `43/43`.

## Verification

- `npm run verify`: `49/49` tests passed and static build succeeded.
- `git diff --check`: clean.
- Local rewrite-aware HTTP smoke returned `200` for:
  `/`, `/stories`, `/create`, `/library`, `/stories/sea-bench`,
  `/about.html`, `/privacy.html`, `/terms.html`, `/requisites.html`.
- The root HTTP response contains all six unique ordinary story links.
- Self-review confirmed no API, storage-field, story-content, source-label,
  analytics-hook, route, or production-game drift.

## Browser limitation

Fresh visual screenshots, computed geometry, and the requested interactive no-JS
browser check could not be produced in this environment. The Browser runtime
initialized, but URL selection returned `No browser is available`; the required
troubleshooting discovery returned an empty backend list (`[]`). No unrelated
browser implementation was substituted. Automated route-state tests, contrast
calculation, build verification, and local HTTP smoke evidence are included
above, but fresh browser screenshots remain the only verification gap.
