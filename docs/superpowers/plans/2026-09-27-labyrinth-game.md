# Labyrinth Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an accessible, standalone children’s labyrinth game themed to the existing «Ежонок и Лисёнок» site.

**Architecture:** A DOM-independent engine owns level definitions and movement rules. A small page controller renders selection, board and result states, while CSS supplies the project-aligned paper map presentation.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node built-in test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-labyrinth-game-design.md`

## Global Constraints

- No new package dependencies or network calls.
- Three difficulty levels; keyboard, touch and pointer controls.
- Use existing project visual language and safe localStorage fallback.

## Review Focus

- A wall click or keypress must leave the player in place and describe the dead end.
- Reaching the goal must finish once and unlock the selected trail.
- Keyboard focus must remain usable after board rerenders.
- Missing or blocked localStorage must not prevent play.
- A narrow screen must retain one visible, tappable movement control per direction.

### Task 1: Movement engine

**Files:**
- Create: `js/labyrinth-engine.js`
- Test: `tests/labyrinth-engine.test.js`

- [ ] Write failing tests for valid movement, walls, finish detection and every level’s valid start/goal.
- [ ] Run `node --test tests/labyrinth-engine.test.js` and verify the expected missing-module failure.
- [ ] Implement immutable `createState(levelId, hero)` and `move(state, direction)` exports.
- [ ] Run the unit test again and verify it passes.

### Task 2: Playable page

**Files:**
- Create: `labyrinth.html`, `labyrinth.css`, `js/labyrinth-game.js`
- Modify: `index.html`
- Test: `tests/labyrinth.spec.mjs`

- [ ] Write a Playwright test for hero selection, level selection, keyboard movement and the result state.
- [ ] Run the targeted Playwright test and verify it fails because the page does not exist.
- [ ] Implement the static page, controller and home-page link using the engine contract from Task 1.
- [ ] Run unit and Playwright tests and verify both pass.

### Task 3: Visual and responsive verification

**Files:**
- Modify: `labyrinth.css`, `tests/labyrinth.spec.mjs`

- [ ] Add mobile-sized Playwright coverage for visible movement controls.
- [ ] Make only the responsive CSS changes needed for the test.
- [ ] Run the full relevant test suite and build.
