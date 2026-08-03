const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

global.window = {};
require(path.join(__dirname, "..", "js", "generationTasks.js"));
const tasks = window.HFGenerationTasks;

const EXPECTED_IDS = {
  "5-6": [
    "5-6-counting-berries",
    "5-6-comparison-apples",
    "5-6-sequence-steps",
    "5-6-color-sun",
    "5-6-shape-triangle",
    "5-6-pair-mitten",
    "5-6-letter-kot"
  ],
  "7-8": [
    "7-8-addition-8-7",
    "7-8-subtraction-18-9",
    "7-8-multiply-5-3",
    "7-8-multiply-4-2",
    "7-8-multiply-3-5",
    "7-8-sequence-3-6-9",
    "7-8-syllables-moloko",
    "7-8-logic-nuts"
  ],
  "9-10": [
    "9-10-multiply-7-8",
    "9-10-divide-48-6",
    "9-10-expression-4-5-3",
    "9-10-word-problem-baskets",
    "9-10-classification-transport",
    "9-10-spelling-poles",
    "9-10-route-garden"
  ]
};

function getFullCatalog(ageGroup) {
  return tasks.createTaskSet(ageGroup, EXPECTED_IDS[ageGroup].length, () => 0);
}

test("task catalog keeps stable unique identifiers with an answer in every age-appropriate option set", () => {
  Object.entries(EXPECTED_IDS).forEach(([ageGroup, expectedIds]) => {
    const generated = getFullCatalog(ageGroup);
    assert.deepEqual(generated.map((task) => task.id), expectedIds);
    assert.equal(new Set(generated.map((task) => task.id)).size, expectedIds.length);

    generated.forEach((task) => {
      assert.equal(task.ageGroup, ageGroup);
      assert.ok(task.options.includes(task.correctAnswer));
      assert.equal(new Set(task.options.map(tasks.normalizeAnswer)).size, task.options.length);
      assert.equal(tasks.checkAnswer(task, task.correctAnswer).correct, true);
      assert.equal(tasks.checkAnswer(task, "неверный ответ").correct, false);
    });
  });
});

test("5–6 catalog stays within early-learning operations and two or three answers", () => {
  const generated = getFullCatalog("5-6");
  assert.deepEqual(
    generated.map((task) => task.visual.operation),
    ["count", "comparison", "sequence", "color", "shape", "pair", "missing-letter"]
  );
  generated.forEach((task) => assert.ok(task.options.length >= 2 && task.options.length <= 3));

  const counting = generated[0].visual;
  const comparison = generated[1].visual;
  const sequence = generated[2].visual;
  assert.ok(counting.count <= 10);
  assert.ok(comparison.left <= 10 && comparison.right <= 10);
  assert.ok(sequence.values.every((value) => value <= 10));
});

test("7–8 catalog uses addition or subtraction to twenty, selected tables, sequences, syllables, and one-step logic", () => {
  const generated = getFullCatalog("7-8");
  assert.deepEqual(
    generated.map((task) => task.visual.operation),
    ["add", "subtract", "multiply", "multiply", "multiply", "sequence", "syllables", "logic"]
  );
  generated.forEach((task) => assert.ok(task.options.length >= 3 && task.options.length <= 4));

  const [addition, subtraction] = generated.map((task) => task.visual);
  const multiplicationTables = generated
    .filter((task) => task.visual.operation === "multiply")
    .map((task) => task.visual.right)
    .sort((left, right) => left - right);
  assert.ok(addition.left + addition.right <= 20);
  assert.ok(subtraction.left <= 20 && subtraction.left - subtraction.right >= 0);
  assert.deepEqual(multiplicationTables, [2, 3, 5]);
});

test("9–10 catalog uses multiplication, division, two-step math, word problems, classification, spelling, and routes", () => {
  const generated = getFullCatalog("9-10");
  assert.deepEqual(
    generated.map((task) => task.visual.operation),
    ["multiply", "divide", "two-step", "word-problem", "classification", "spelling", "route"]
  );
  generated.forEach((task) => assert.ok(task.options.length >= 3 && task.options.length <= 4));

  const multiplication = generated[0];
  multiplication.correctAnswer = "999";
  assert.equal(tasks.checkAnswer(multiplication, "56").correct, true);
  assert.equal(tasks.checkAnswer(multiplication, "55").correct, false);
});

test("injected random input selects the same stable task set without duplicate identifiers", () => {
  const first = tasks.createTaskSet("9-10", 3, () => 0.68).map((task) => task.id);
  const second = tasks.createTaskSet("9-10", 3, () => 0.68).map((task) => task.id);
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, first.length);
});
