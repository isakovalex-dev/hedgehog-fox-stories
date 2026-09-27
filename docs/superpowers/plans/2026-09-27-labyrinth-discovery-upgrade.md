# Labyrinth Discovery Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the labyrinth into an illustrated discovery map with fog, in-map encounters, final-only rewards and swipe movement.

**Architecture:** Extend the pure movement engine with discovered cells and level encounter metadata. The page controller owns modal state and pointer gesture interpretation; CSS renders the reference-aligned map, fog and paper event cards.

**Tech Stack:** Vanilla JavaScript, static HTML/CSS, Node built-in test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-labyrinth-discovery-upgrade-design.md`

## Global Constraints

- No new dependencies or network calls.
- The final prize belongs only to the goal cell.
- Encounters are modal overlays above the board; they never navigate away.
- Keyboard, buttons, tile taps and one-direction finger swipes must work.

## Review Focus

- Swiping must not cause a second move through the subsequent click event.
- An unsolved entry encounter must not permit a map move.
- A previously completed encounter must not reopen after a rerender.
- Fog must never hide the current hero or the final result screen.
- Incorrect answers must not reset a child’s current position or progress.

### Task 1: Discovery-map engine

**Files:**
- Modify: `js/labyrinth-engine.js`, `tests/labyrinth-engine.test.js`

- [ ] Write failing tests for nearby-cell discovery, final-only goal prize and stable encounter metadata.
- [ ] Run `node --test tests/labyrinth-engine.test.js` and verify the new assertions fail.
- [ ] Extend immutable game state and levels with discovery and encounter data.
- [ ] Run the unit tests and verify they pass.

### Task 2: Illustrated map and modal encounters

**Files:**
- Modify: `labyrinth.html`, `labyrinth.css`, `js/labyrinth-game.js`, `tests/labyrinth.spec.mjs`
- Create: `assets/labyrinth/forest-friends.webp`

- [ ] Write failing browser coverage for the entry encounter, fog, a branch modal and final reward.
- [ ] Run targeted Playwright coverage and verify it fails.
- [ ] Build the map presentation and in-place encounter overlay using the engine contract.
- [ ] Verify the tests pass.

### Task 3: Touch navigation and final responsive verification

**Files:**
- Modify: `js/labyrinth-game.js`, `labyrinth.css`, `tests/labyrinth.spec.mjs`

- [ ] Add a failing pointer swipe test that expects exactly one move.
- [ ] Implement pointer gesture handling with click suppression.
- [ ] Verify engine, Playwright coverage and static build.
