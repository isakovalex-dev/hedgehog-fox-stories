const test = require("node:test");
const assert = require("node:assert/strict");
const { LEVELS, completeEncounter, createState, getEncounter, getEncounterAt, move, registerMistake } = require("../js/labyrinth-engine.js");

const STEPS = {
  up: { row: -1, column: 0 },
  down: { row: 1, column: 0 },
  left: { row: 0, column: -1 },
  right: { row: 0, column: 1 }
};

function markerPosition(map, marker) {
  for (let row = 0; row < map.length; row += 1) {
    const column = map[row].indexOf(marker);
    if (column !== -1) return { row, column };
  }
  throw new Error(`Missing ${marker}`);
}

function markerCount(map, marker) {
  return map.join("").split("").filter((tile) => tile === marker).length;
}

function routeToGoal(level) {
  const start = markerPosition(level.map, "S");
  const goal = markerPosition(level.map, "G");
  const queue = [{ position: start, directions: [] }];
  const seen = new Set([`${start.row}:${start.column}`]);

  while (queue.length) {
    const current = queue.shift();
    if (current.position.row === goal.row && current.position.column === goal.column) return current.directions;

    for (const [direction, step] of Object.entries(STEPS)) {
      const position = { row: current.position.row + step.row, column: current.position.column + step.column };
      const key = `${position.row}:${position.column}`;
      if (seen.has(key) || level.map[position.row]?.[position.column] === "#" || !level.map[position.row]?.[position.column]) continue;
      seen.add(key);
      queue.push({ position, directions: [...current.directions, direction] });
    }
  }

  return null;
}

function settleEncounter(state) {
  return state.pendingEncounter ? completeEncounter(state, state.pendingEncounter) : state;
}

function completeRoute(levelId, hero = "hedgehog") {
  const level = LEVELS.find((item) => item.id === levelId);
  let state = settleEncounter(createState(levelId, hero));
  for (const direction of routeToGoal(level)) {
    state = settleEncounter(move(state, direction));
  }
  return state;
}

test("moves the selected hero along the new forest maze without mutating the current state", () => {
  const current = settleEncounter(createState("easy", "hedgehog"));
  const next = move(current, "up");

  assert.deepEqual(current.position, { row: 9, column: 1 });
  assert.deepEqual(next.position, { row: 8, column: 1 });
  assert.equal(next.hero, "hedgehog");
  assert.equal(next.moved, true);
});

test("keeps the hero on the current tile when a direction leads into an orthogonal wall", () => {
  const current = settleEncounter(createState("easy", "fox"));
  const next = move(current, "left");

  assert.deepEqual(next.position, current.position);
  assert.equal(next.moved, false);
  assert.equal(next.message, "Там густые кусты. Попробуй другую тропинку.");
});

test("reveals only nearby squares around the new lower-left entry", () => {
  const current = createState("easy", "hedgehog");
  const next = move(settleEncounter(current), "up");

  assert.equal(current.discovered.includes("7:1"), false);
  assert.equal(next.discovered.includes("7:1"), true);
  assert.equal(next.discovered.includes("8:2"), true);
  assert.equal(current.position.row, 9);
});

test("keeps encounter metadata stable at the entry and a real branch", () => {
  const level = LEVELS.find((item) => item.id === "easy");
  let state = createState("easy", "hedgehog");
  const entry = getEncounterAt("easy", state.position);

  assert.equal(state.pendingEncounter, entry.id);
  assert.deepEqual(getEncounter("easy", entry.id), entry);

  state = settleEncounter(state);
  for (const direction of ["up", "up", "right", "right", "right", "right", "right", "right", "up", "up", "left", "left", "left", "left", "up", "up", "right", "right", "right", "right"]) {
    state = move(state, direction);
  }

  const branch = getEncounterAt("easy", state.position);
  assert.equal(branch.id, "easy-sun-ticket");
  assert.equal(branch.kind, "ticket");
  assert.equal(level.map[branch.row][branch.column], ".");
  assert.equal(state.pendingEncounter, branch.id);
});

test("publishes named orthogonal maps with fixed 4:3 assets and grid bounds", () => {
  const expectedLevels = [
    ["easy", "Лесной старт", "3–5 лет", "assets/labyrinth/storybook/forest-start-maze-v2.png", 11],
    ["medium", "Таинственный лес", "6–7 лет", "assets/labyrinth/storybook/mystery-forest-maze-v2.png", 13],
    ["hard", "Горная пещера", "8–10 лет", "assets/labyrinth/storybook/mountain-cave-maze-v2.png", 15]
  ];

  for (const [id, title, age, art, size] of expectedLevels) {
    const level = LEVELS.find((item) => item.id === id);
    assert.equal(level.displayTitle, title);
    assert.equal(level.age, age);
    assert.equal(level.art, art);
    assert.equal(level.map.length, size);
    assert.deepEqual(level.gridBounds, id === "easy"
      ? { left: 10, top: 8, right: 90, bottom: 92 }
      : id === "medium"
        ? { left: 8, top: 8, right: 92, bottom: 92 }
        : { left: 7, top: 7, right: 93, bottom: 93 });
  }
});

test("each orthogonal map is rectangular with one reachable start and goal", () => {
  for (const level of LEVELS) {
    assert.equal(new Set(level.map.map((line) => line.length)).size, 1, `${level.id} must have equal row lengths`);
    assert.equal(markerCount(level.map, "S"), 1, `${level.id} must have one start`);
    assert.equal(markerCount(level.map, "G"), 1, `${level.id} must have one goal`);
    assert.ok(level.gridBounds.left >= 0 && level.gridBounds.left < level.gridBounds.right && level.gridBounds.right <= 100);
    assert.ok(level.gridBounds.top >= 0 && level.gridBounds.top < level.gridBounds.bottom && level.gridBounds.bottom <= 100);

    const directions = routeToGoal(level);
    assert.ok(directions?.length, `${level.id} must have a cardinal route to the chest`);

    let position = markerPosition(level.map, "S");
    for (const direction of directions) {
      const step = STEPS[direction];
      position = { row: position.row + step.row, column: position.column + step.column };
      assert.notEqual(level.map[position.row][position.column], "#", `${level.id} route cannot cross a wall`);
    }
    assert.deepEqual(position, markerPosition(level.map, "G"));
  }
});

test("starts every journey with three hearts, two possible hints, and no premature prize", () => {
  const state = createState("medium", "fox");

  assert.equal(state.lives, 3);
  assert.equal(state.maxLives, 3);
  assert.deepEqual(state.seenEncounters, []);
  assert.equal(state.prize, null);
  assert.equal(Object.hasOwn(state, "findings"), false);
});

test("hints never become prizes before the final chest", () => {
  const level = LEVELS.find((item) => item.id === "easy");
  let state = settleEncounter(createState("easy", "hedgehog"));

  assert.equal(state.prize, null);
  for (const direction of ["up", "up", "right", "right", "right", "right", "right", "right", "up", "up", "left", "left", "left", "left", "up", "up", "right", "right", "right", "right"]) {
    state = move(state, direction);
  }
  state = settleEncounter(state);

  assert.equal(state.seenEncounters.length, 2);
  assert.equal(state.prize, null);
  assert.equal(Object.hasOwn(state, "findings"), false);

  state = completeRoute(level.id);
  assert.equal(state.completed, true);
  assert.deepEqual(state.prize, level.prize);
});

test("records a hint only once when its popup completion is repeated", () => {
  const state = createState("easy", "hedgehog");
  const entry = getEncounter("easy", state.pendingEncounter);
  const settled = completeEncounter(state, entry.id);
  const repeated = completeEncounter(settled, entry.id);

  assert.deepEqual(settled.seenEncounters, [entry.id]);
  assert.deepEqual(repeated.seenEncounters, [entry.id]);
  assert.equal(settled.prize, null);
});

test("takes one heart for a wall or a gentle mistake without moving below zero hearts", () => {
  const entryState = createState("easy", "fox");
  const ready = settleEncounter(entryState);
  const wall = move(ready, "left");
  let exhausted = wall;

  for (let count = 0; count < 4; count += 1) exhausted = registerMistake(exhausted, "Попробуй ещё раз.");

  assert.equal(wall.lives, 2);
  assert.equal(ready.lives, 3);
  assert.deepEqual(wall.position, ready.position);
  assert.equal(exhausted.lives, 0);
  assert.deepEqual(exhausted.position, ready.position);
  assert.deepEqual(exhausted.seenEncounters, ready.seenEncounters);
});

test("completes every orthogonal route with the chest as its only prize", () => {
  for (const level of LEVELS) {
    const state = completeRoute(level.id, "fox");
    assert.equal(state.completed, true, `${level.id} should complete at G`);
    assert.deepEqual(state.prize, level.prize);
    assert.equal(state.message, "Сундук найден!");
    assert.equal(Object.hasOwn(state, "findings"), false);
  }
});
