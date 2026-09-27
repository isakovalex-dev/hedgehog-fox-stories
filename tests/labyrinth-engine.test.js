const test = require("node:test");
const assert = require("node:assert/strict");
const { LEVELS, completeEncounter, createState, getEncounter, getEncounterAt, move, registerMistake } = require("../js/labyrinth-engine.js");

test("moves the selected hero to an open neighbouring tile without mutating the current state", () => {
  const current = createState("easy", "hedgehog");
  const ready = completeEncounter(current, current.pendingEncounter);
  const next = move(ready, "right");

  assert.deepEqual(current.position, { row: 1, column: 1 });
  assert.deepEqual(next.position, { row: 1, column: 2 });
  assert.equal(next.hero, "hedgehog");
  assert.equal(next.moved, true);
});

test("keeps the hero on the current tile when a direction leads into a wall", () => {
  const current = createState("easy", "fox");
  const next = move(completeEncounter(current, current.pendingEncounter), "up");

  assert.deepEqual(next.position, current.position);
  assert.equal(next.moved, false);
  assert.equal(next.message, "Там густые кусты. Попробуй другую тропинку.");
});

test("marks a trail complete when the hero reaches its finding", () => {
  let current = createState("easy", "fox");
  current = completeEncounter(current, current.pendingEncounter);
  for (const direction of ["right", "right", "right", "right"]) {
    current = move(current, direction);
    current = completeEncounter(current, current.pendingEncounter);
  }

  assert.equal(current.completed, true);
  assert.equal(current.message, "Находка найдена!");
});

test("reveals only the nearby map around the hero without changing the old state", () => {
  const current = createState("easy", "hedgehog");
  const next = move(completeEncounter(current, current.pendingEncounter), "right");

  assert.deepEqual(current.discovered, ["0:1", "1:0", "1:1", "1:2", "2:1"]);
  assert.equal(current.discovered.includes("1:3"), false);
  assert.equal(next.discovered.includes("1:3"), true);
  assert.equal(next.discovered.includes("0:2"), true);
});

test("keeps the prize hidden until the goal cell is reached", () => {
  let current = createState("easy", "fox");
  current = completeEncounter(current, current.pendingEncounter);

  assert.equal(current.prize, null);
  for (const direction of ["right", "right", "right", "right"]) {
    current = move(current, direction);
    current = completeEncounter(current, current.pendingEncounter);
  }

  assert.deepEqual(current.prize, LEVELS.find((level) => level.id === "easy").prize);
});

test("provides stable entry and branch encounter metadata", () => {
  let current = createState("easy", "hedgehog");
  const entry = getEncounterAt("easy", current.position);

  assert.equal(current.pendingEncounter, entry.id);
  assert.deepEqual(getEncounter("easy", entry.id), entry);

  current = completeEncounter(current, entry.id);
  current = move(current, "right");
  current = move(current, "right");
  const branch = getEncounterAt("easy", current.position);

  assert.equal(current.pendingEncounter, branch.id);
  assert.equal(branch.kind, "ticket");
  assert.equal(current.seenEncounters.includes(entry.id), true);
  assert.equal(current.seenEncounters.includes(branch.id), false);
});

test("every trail has a passable start and finding inside its map", () => {
  for (const level of LEVELS) {
    const state = createState(level.id, "hedgehog");
    assert.equal(level.map[state.position.row][state.position.column], "S");
    assert.equal(level.map[state.goal.row][state.goal.column], "G");

    const queue = [state.position];
    const visited = new Set([`${state.position.row}:${state.position.column}`]);
    while (queue.length) {
      const current = queue.shift();
      for (const next of [[current.row - 1, current.column], [current.row + 1, current.column], [current.row, current.column - 1], [current.row, current.column + 1]]) {
        const [row, column] = next;
        const key = `${row}:${column}`;
        if (visited.has(key) || level.map[row]?.[column] === "#") continue;
        visited.add(key); queue.push({ row, column });
      }
    }
    assert.ok(visited.has(`${state.goal.row}:${state.goal.column}`), `${level.id} should have a route to its finding`);
  }
});

test("publishes the three illustrated storybook trails with three discoveries each", () => {
  const expectedLevels = [
    ["easy", "Лесная тропинка", "3–5 лет", "assets/labyrinth/storybook/forest-trail.png"],
    ["medium", "Долина ручьёв", "6–7 лет", "assets/labyrinth/storybook/river-valley.png"],
    ["hard", "Горный перевал", "8–10 лет", "assets/labyrinth/storybook/mountain-pass.png"]
  ];

  for (const [id, title, age, art] of expectedLevels) {
    const level = LEVELS.find((item) => item.id === id);
    const discoveryIds = [...level.encounters.map((encounter) => encounter.findingId), level.goalFindingId];

    assert.equal(level.displayTitle, title);
    assert.equal(level.age, age);
    assert.equal(level.art, art);
    assert.equal(level.encounters.length, 2);
    assert.equal(new Set(discoveryIds).size, 3);
  }
});

test("starts every journey with three gentle hearts and an empty finding pouch", () => {
  const state = createState("medium", "fox");

  assert.equal(state.lives, 3);
  assert.equal(state.maxLives, 3);
  assert.deepEqual(state.findings, []);
});

test("adds an encounter finding once even if its popup completion is repeated", () => {
  const state = createState("easy", "hedgehog");
  const entry = getEncounter("easy", state.pendingEncounter);
  const found = completeEncounter(state, entry.id);
  const repeated = completeEncounter(found, entry.id);

  assert.deepEqual(found.findings, [entry.findingId]);
  assert.deepEqual(repeated.findings, [entry.findingId]);
  assert.deepEqual(state.findings, []);
});

test("takes one heart for a wall or a gentle mistake without moving the hero below zero hearts", () => {
  const entryState = createState("easy", "fox");
  const ready = completeEncounter(entryState, entryState.pendingEncounter);
  const wall = move(ready, "up");
  let exhausted = wall;

  for (let count = 0; count < 4; count += 1) exhausted = registerMistake(exhausted, "Попробуй ещё раз.");

  assert.equal(wall.lives, 2);
  assert.equal(ready.lives, 3);
  assert.deepEqual(wall.position, ready.position);
  assert.equal(exhausted.lives, 0);
  assert.deepEqual(exhausted.position, ready.position);
  assert.deepEqual(exhausted.findings, ready.findings);
});

test("keeps the chest hidden until G and records it as the third finding exactly once", () => {
  const level = LEVELS.find((item) => item.id === "easy");
  let current = createState("easy", "fox");
  current = completeEncounter(current, current.pendingEncounter);

  for (const direction of ["right", "right"]) {
    current = move(current, direction);
    current = completeEncounter(current, current.pendingEncounter);
  }

  assert.equal(current.prize, null);
  assert.equal(current.findings.length, 2);
  for (const direction of ["right", "right"]) current = move(current, direction);

  assert.equal(current.completed, true);
  assert.deepEqual(current.prize, level.prize);
  assert.deepEqual(current.findings, [level.encounters[0].findingId, level.encounters[1].findingId, level.goalFindingId]);
  assert.equal(move(current, "left").findings.length, 3);
});
