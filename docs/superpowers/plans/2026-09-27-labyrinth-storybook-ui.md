# Storybook Labyrinth Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing maze into the approved full-screen watercolor storybook game with three illustrated maps, gentle hearts, three discoveries, modal encounters, and a two-step ending.

**Architecture:** Keep the vanilla static-site stack and the pure UMD engine. The engine owns immutable map state, hearts, discoveries, events, and completion; `labyrinth-game.js` owns screen phase, DOM, focus, time display, and input. CSS turns the invisible logical grid into a single illustrated playfield with fog overlay, HUD, paper dialogs, and responsive controls.

**Tech Stack:** Plain HTML, CSS, JavaScript, Node `node:test`, Playwright, existing static build script, ImageGen raster assets.

**Spec:** `docs/superpowers/specs/2026-09-27-labyrinth-storybook-ui-design.md`

## Global Constraints

- Preserve hero choice, three difficulties, fog reveal, final-only chest, required entry/branch encounters, keyboard/WASD/buttons/adjacent tap/swipe.
- Use no runtime dependencies, backend, external fonts, or copied pixels from the supplied reference screenshots.
- Hearts start at 3, decrease on a wrong answer or wall, never go below 0, and never create a game-over state.
- Every level has exactly three counted discoveries: entry encounter, branch encounter, and final chest.
- Maintain semantic buttons, `aria-modal`, `inert`, focus trapping, 44×44px touch targets, reduced-motion support, and playable 375px layout.
- Work only in `/Users/a1234/.codex/worktrees/maze-game/ezhik-i-lisenok`; do not alter the user's original dirty checkout.

## Review Focus

- Repeated wrong answers and wall contacts at zero hearts must never create negative hearts, reset progress, or lock the child out; Task 2 owns regression tests.
- Each of the three level cards and both heroes must open a usable game state with an entry event; Task 3 owns Playwright coverage.
- Mandatory puzzles, ticket dialogs, and the final chest dialog must block hidden background actions and retain focus; Task 3 owns keyboard and direct-click regression coverage.
- A native touch swipe can emit a compatibility click after pointerup; it must still cause exactly one move; Task 3 owns mobile gesture coverage.
- Missing or slow decorative art must leave an operable map and readable HUD; Task 4 owns visual fallback and static-build verification.

---

### Task 1: Create three original storybook map assets

**Files:**
- Create: `assets/labyrinth/storybook/forest-trail.png`
- Create: `assets/labyrinth/storybook/river-valley.png`
- Create: `assets/labyrinth/storybook/mountain-pass.png`

**Interfaces:**
- Consumes: art direction, subject matter, and composition requirements from the approved spec.
- Produces: three 4:3 PNG files used later as `LEVELS[*].art` background paths and card previews.

- [ ] **Step 1: Read `imagegen` skill instructions and the existing `assets/illustration-style-profile.json` completely**

  Confirm that generated art follows the project’s warm watercolor storybook direction and leaves a safe upper edge for the HUD.

- [ ] **Step 2: Generate `forest-trail.png`**

  Use a 4:3 children’s watercolor forest map: a warm winding path begins at bottom-left beside a wooden «Старт» sign, crosses a small bridge, and ends at a glowing closed chest high on the right; include trees, flowers, rocks, and room for fog. Do not include UI, text other than the painted sign, grid lines, characters, or a finished-game overlay.

- [ ] **Step 3: Generate `river-valley.png` and `mountain-pass.png`**

  Keep the same palette and perspective. `river-valley` adds a clear stream, bridges, a modest waterfall, and a sunny chest clearing. `mountain-pass` adds stone stairs, rope bridges, pines, cliffs, a cave, and a chest near the upper pass. Both reserve an uncluttered top edge for the HUD and a start area near bottom-left.

- [ ] **Step 4: Inspect and normalize each asset**

  Inspect all three images at full size; keep only images that read as a coherent set and have no generated labels or interface controls. Use `sips` to normalize each to a 4:3 raster no wider than 1600px while retaining the PNG files specified above.

- [ ] **Step 5: Verify asset deliverable**

  Run: `sips -g pixelWidth -g pixelHeight assets/labyrinth/storybook/*.png`

  Expected: three readable PNGs with the same 4:3 dimensions and no build/runtime dependencies.

- [ ] **Step 6: Commit the art set**

  ```bash
  git add assets/labyrinth/storybook
  git commit -m "feat: add storybook labyrinth maps"
  ```

### Task 2: Extend the pure engine with presentation metadata, hearts, and discoveries

**Files:**
- Modify: `js/labyrinth-engine.js:8-259`
- Modify: `tests/labyrinth-engine.test.js:1-97`

**Interfaces:**
- Consumes: Task 1 art paths and the existing `createState`, `move`, `completeEncounter`, `getLevel`, and `getEncounter` API.
- Produces: `LEVELS` entries with `displayTitle`, `age`, `difficulty`, `art`, `summary`, exactly two counted `encounters`, and three total discoveries; `registerMistake(state, message)`; states with `lives`, `maxLives`, and `findings`.

- [ ] **Step 1: Write failing unit tests for presentation and gentle scoring**

  Add tests that assert each level has its specified storybook title/art/age, exactly three discoverable IDs, a 3-heart initial state, idempotent encounter findings, wall-loss behavior, `registerMistake`, and a final chest that becomes the third finding only on `G`.

- [ ] **Step 2: Run the unit test file to verify red state**

  Run: `node --test tests/labyrinth-engine.test.js`

  Expected: failures for absent `lives`, `findings`, presentation fields, and `registerMistake`.

- [ ] **Step 3: Implement presentation metadata and discovery IDs in `LEVELS`**

  Rename levels exactly to `Лесная тропинка`, `Долина ручьёв`, and `Горный перевал`, with ages `3–5 лет`, `6–7 лет`, `8–10 лет`; assign the three Task 1 art paths and summaries. Retain only entry and branch encounters per level, each with a unique `findingId`; define the chest as the level’s third `goalFindingId`.

- [ ] **Step 4: Implement the immutable score API**

  `createState(levelId, hero)` returns `lives: 3`, `maxLives: 3`, and `findings: []`. `move(state, direction)` calls the same non-mutating state path as today, but a wall move lowers `lives` by one to a minimum of zero. Add `registerMistake(state, message)` that also lowers hearts to a minimum of zero while preserving position/discovered/findings. `completeEncounter(state, encounterId)` adds that encounter’s `findingId` once; a `G` move appends the goal finding and `prize` once.

- [ ] **Step 5: Run engine tests to verify green state**

  Run: `node --test tests/labyrinth-engine.test.js`

  Expected: all original path/fog/final behavior and new hearts/discoveries tests pass.

- [ ] **Step 6: Commit the engine unit**

  ```bash
  git add js/labyrinth-engine.js tests/labyrinth-engine.test.js
  git commit -m "feat: add labyrinth hearts and discoveries"
  ```

### Task 3: Rebuild the game controller around the storybook screen flow

**Files:**
- Modify: `js/labyrinth-game.js:1-267`
- Modify: `tests/labyrinth.spec.mjs:1-127`

**Interfaces:**
- Consumes: Task 2’s level metadata, `state.lives`, `state.findings`, `registerMistake`, final chest state, existing movement/event API, `assets/create/create-hedgehog.png`, and `assets/game/fox-catcher.webp`.
- Produces: state phases `hero`, `level`, `play`, `treasure`, and `complete`; semantic hooks `data-screen`, `data-level`, `data-hero`, `data-finding-count`, `data-lives`, and `#labyrinthBoard` for tests and styling.

- [ ] **Step 1: Write failing browser scenarios for the new flow**

  Replace the default-level-only helpers with `openTrail(page, heroId, levelTitle)`. Add focused scenarios that select both heroes, open each named level, show `0/3` and three hearts, reduce a heart for a wrong entry answer without moving/resetting, collect entry+branch+chest as `3/3`, reach the `treasure` then `complete` phase, and dispatch a CDP touch swipe followed by a map click to assert one move.

- [ ] **Step 2: Run the focused Playwright file to verify red state**

  Run: `npm run test:e2e -- tests/labyrinth.spec.mjs`

  Expected: failures because current combined selection screen, HUD, heart count, treasure step, and completion screen do not exist.

- [ ] **Step 3: Add phase-aware render functions to `labyrinth-game.js`**

  Replace `renderSelection()` with `renderHeroSelection()`, `renderLevelSelection()`, `renderPlayfield()`, `renderTreasureDialog()`, and `renderCompletion()`. Keep a single document event delegation path. Use `assets/create/create-hedgehog.png` and `assets/game/fox-catcher.webp` in the two hero cards and HUD. Hero cards and level cards set phase without navigation; `start()` creates the Task 2 state and begins a session timer.

- [ ] **Step 4: Render the illustrated board and its HUD**

  Render the invisible coordinate buttons inside `#labyrinthBoard`; attach the selected level’s `art` path as an inline CSS custom property. Render decorative fog cells and path footprints separately from accessible coordinate buttons. The HUD shows portrait, hearts based on `game.lives`, and `game.findings.length/3`; use text labels so state is not colour-only.

- [ ] **Step 5: Integrate gentle mistakes and staged finish**

  On a wrong puzzle answer call `engine.registerMistake`, retain the modal, and update the heart HUD. Preserve existing modal `inert`, direct-action guard, and Tab trap. On `G`, show a chest/treasure dialog first; its «Дальше» action switches to the completion screen, records completed level, calculates `max(1, game.lives)` stars, and exposes the next available-level action.

- [ ] **Step 6: Preserve all input paths**

  Retain arrow/WASD, directional buttons, adjacent tile taps, and pointer swipe with the 24px threshold and 450ms compatibility-click suppression. Make the CDP `Input.dispatchTouchEvent` regression scenario from Step 1 pass. Add a pause dialog that explains these three controls and uses the same accessible modal guard without affecting progress.

- [ ] **Step 7: Run browser tests to verify green state**

  Run: `npm run test:e2e -- tests/labyrinth.spec.mjs`

  Expected: hero/level selection, hearts/discoveries, blocked modal, fog, all input methods, chest, completion, and mobile scenarios pass.

- [ ] **Step 8: Commit the controller unit**

  ```bash
  git add js/labyrinth-game.js tests/labyrinth.spec.mjs
  git commit -m "feat: add storybook labyrinth game flow"
  ```

### Task 4: Replace the page styling with the approved illustrated game interface

**Files:**
- Modify: `labyrinth.css:1-815`
- Modify: `labyrinth.html:1-25`
- Modify: `tests/labyrinth.spec.mjs` with one storybook-structure/mobile-geometry scenario

**Interfaces:**
- Consumes: Task 1 asset paths and Task 3’s screen/semantic hooks.
- Produces: responsive `storybook-*` styling for hero/level pickers, playfield/HUD/fog, dialogs, final screen, controls, and a safe map-art fallback.

- [ ] **Step 1: Write/extend the browser test for visual structure and mobile geometry**

  Add `renders storybook playfield and keeps phone controls in viewport`: assert that `#labyrinthBoard[data-art]` has the selected art path, the HUD, heart controls, `0/3` finding label, and four direction controls are visible; at `375×812`, all required controls and the dialog remain within the viewport and have at least 44px in both directions.

- [ ] **Step 2: Run the visual-structure test to verify red state**

  Run: `npm run test:e2e -- tests/labyrinth.spec.mjs --grep 'renders storybook playfield'`

  Expected: failures for absent storybook component classes and HUD layout.

- [ ] **Step 3: Replace `labyrinth.css` with the scoped storybook design system**

  Implement the six colour tokens from the spec, compact paper picker screens, image-forward level cards, 4:3 playfield, non-grid-looking fog, top HUD, lower-corner controls, paper dialogs, glowing chest state, and completion tableau. Respect `prefers-reduced-motion`; retain visible focus outlines and use a light illustrated/colour fallback behind missing map art.

- [ ] **Step 4: Update resource loading in `labyrinth.html`**

  Preload the default forest map, preserve the brand/back links and skip link, and set all three CSS/JS version query strings to `v=20260927-storybook-1` so the existing local preview cannot serve stale UI after the redesign.

- [ ] **Step 5: Run the browser test to verify green state**

  Run: `npm run test:e2e -- tests/labyrinth.spec.mjs`

  Expected: all full-flow and 375px assertions pass with the final UI.

- [ ] **Step 6: Perform visual review on desktop and phone sizes**

  Open `http://localhost:4319/labyrinth.html` after the final build at a desktop width and 375px width. Confirm that map art is the visual focus, туман reads as soft watercolor rather than a dark veil, all dialogs fit, and the completion composition resembles the approved references without copying their pixels.

- [ ] **Step 7: Commit the visual unit**

  ```bash
  git add labyrinth.css labyrinth.html tests/labyrinth.spec.mjs
  git commit -m "feat: style storybook labyrinth interface"
  ```

### Task 5: End-to-end verification and delivery refresh

**Files:**
- Modify: no source file (verification-only)
- Build output: `dist/`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: current static preview at `http://localhost:4319/labyrinth.html` and verified commits in the isolated worktree.

- [ ] **Step 1: Run the complete regression and build suite**

  Run: `node --test tests/labyrinth-engine.test.js && npm run test:e2e -- tests/labyrinth.spec.mjs && npm run build && git diff --check`

  Expected: all unit tests, Playwright tests, static build, and whitespace check succeed.

- [ ] **Step 2: Verify the served preview uses the new resource versions**

  Run: `curl -fsS http://localhost:4319/labyrinth.html | rg 'labyrinth-(game|engine).*storybook'`

  Expected: the HTML references the current cache-busted storybook JS/CSS assets.

- [ ] **Step 3: Review the branch before delivery**

  Run: `git status --short && git log --oneline -8`

  Expected: no uncommitted source changes; history has the art, engine, flow, and UI commits.

- [ ] **Step 4: Deliver the local test link and isolation note**

  Tell the user that the game is testable at `http://localhost:4319/labyrinth.html` and that implementation remains isolated until they ask to integrate it with the primary checkout.
