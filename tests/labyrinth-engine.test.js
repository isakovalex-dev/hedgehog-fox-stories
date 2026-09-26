const test = require("node:test");
const assert = require("node:assert/strict");
const { LEVELS, createState, move } = require("../js/labyrinth-engine.js");

test("moves the selected hero to an open neighbouring tile without mutating the current state", () => {
  const current = createState("easy", "hedgehog");
  const next = move(current, "right");

  assert.deepEqual(current.position, { row: 1, column: 1 });
  assert.deepEqual(next.position, { row: 1, column: 2 });
  assert.equal(next.hero, "hedgehog");
  assert.equal(next.moved, true);
});

test("keeps the hero on the current tile when a direction leads into a wall", () => {
  const current = createState("easy", "fox");
  const next = move(current, "up");

  assert.deepEqual(next.position, current.position);
  assert.equal(next.moved, false);
  assert.equal(next.message, "Там густые кусты. Попробуй другую тропинку.");
});

test("marks a trail complete when the hero reaches its finding", () => {
  let current = createState("easy", "fox");
  for (const direction of ["right", "right", "right", "right"]) current = move(current, direction);

  assert.equal(current.completed, true);
  assert.equal(current.message, "Находка найдена!");
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
