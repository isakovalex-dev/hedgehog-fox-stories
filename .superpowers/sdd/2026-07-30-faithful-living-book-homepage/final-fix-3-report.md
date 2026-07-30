# Final fix 3 report

## Status

Implemented and verified the merge-blocking navigation isolation and real no-JavaScript story destinations from base `20cb389`.

## Root causes

- The shared responsive navigation block in `styles.css` had moved from the standalone-page boundary of `980px` to `1100px`. At `1024px`, that global block changed `.nav-links` to a full-width grid on `about.html` and the legal pages.
- The source fallback links used `/stories/:id`, but Vercel rewrites every such route to `index.html`. With JavaScript disabled, no reader was rendered.

## Changes

- Restored the shared navigation collapse boundary to `max-width: 980px`.
- Extended collapsed navigation only for `.home-page` from `981px` through `1279px`; the normal full homepage navigation still begins at `1280px`.
- Added `stories-static.html`, a standalone, readable archive with:
  - one `h1`;
  - skip and navigation links;
  - six anchored `article` elements with `h2` headings;
  - all 30 story paragraphs copied unchanged from `js/storyService.js`;
  - scoped readable typography using the existing stylesheet and no dependency.
- Changed only the source-HTML fallback links to `/stories-static.html#<story-id>`.
- Left JavaScript-rendered story cards and their `/stories/:id` routes unchanged.
- The existing build copies root HTML files, so `stories-static.html` is present at `dist/stories-static.html` and does not match the `/stories/:path*` rewrite.

## TDD evidence

Focused RED run:

```text
node --test --test-name-pattern='source HTML sends|static story archive|shared navigation collapses|homepage keeps the collapsed navigation' tests/ui-contract.test.js
tests 4; pass 0; fail 4
```

The failures named the missing static archive, old SPA fallback links, global `1100px` breakpoint, and missing homepage-only `981–1279px` contract.

Focused GREEN run:

```text
tests 4; pass 4; fail 0
```

## Final verification

- `npm run verify` — exit 0; 51 tests passed, 0 failed; production build completed.
- `dist/stories-static.html` — present after build.
- `git diff --check` — exit 0.
- System Google Chrome, headless, viewport `1024×900`, JavaScript enabled:
  - homepage hamburger is visible;
  - real pointer click focuses `#navMenuButton`, changes `aria-expanded` to `true`, and shows the grid menu;
  - homepage fallback is replaced by exactly six story cards;
  - the six dynamic title links remain `/stories/:id`;
  - `about.html`, `privacy.html`, `requisites.html`, and `terms.html` retain horizontal flex navigation, automatic grid row, and non-full-width link groups.
- Separate system Google Chrome launched with `--blink-settings=scriptEnabled=false`:
  - all six homepage fallback links were clicked with DevTools input events;
  - every click landed at `/stories-static.html#<matching-id>`;
  - every destination exposed the matching titled article and all five readable paragraphs.

## Self-review

- No story wording, source label, API, storage, dynamic reader, or game route changed.
- No standalone page was redesigned.
- No new dependency or Vercel rewrite was added.
- User-owned untracked files were not touched or staged.
