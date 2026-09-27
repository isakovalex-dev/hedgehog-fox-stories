const test = require("node:test");
const assert = require("node:assert/strict");
const { LEVELS, completeEncounter, createState, getEncounter, getEncounterAt, move } = require("../js/labyrinth-engine.js");

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
