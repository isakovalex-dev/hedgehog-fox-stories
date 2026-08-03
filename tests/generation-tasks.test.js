const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

global.window = {};
require(path.join(__dirname, "..", "js", "generationTasks.js"));
const tasks = window.HFGenerationTasks;

test("every age group receives valid unique tasks with a correct answer", () => {
  ["5-6", "7-8", "9-10"].forEach((ageGroup) => {
    const generated = tasks.createTaskSet(ageGroup, 3, () => 0.25);
    assert.equal(generated.length, 3);
    assert.equal(new Set(generated.map((task) => task.id)).size, 3);
    generated.forEach((task) => {
      assert.equal(task.ageGroup, ageGroup);
      assert.ok(task.options.includes(task.correctAnswer));
      assert.equal(tasks.checkAnswer(task, task.correctAnswer).correct, true);
      assert.equal(tasks.checkAnswer(task, "wrong").correct, false);
    });
  });
});

test("arithmetic tasks calculate their own answer instead of trusting display text", () => {
  const task = tasks.createTaskSet("9-10", 3, () => 0.74).find((item) => item.type === "arithmetic");
  assert.ok(task);
  assert.equal(
    tasks.checkAnswer(task, String(task.visual.left * task.visual.right)).correct,
    task.visual.operation === "multiply"
  );
});
