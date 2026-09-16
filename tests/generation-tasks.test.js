const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

global.window = {};
require(path.join(__dirname, "..", "js", "generationTasks.js"));
const tasks = window.HFGenerationTasks;

const TASKS_BY_AGE = {
  "5-6": [
    ["5-6-01", "Сколько грибочков?", "5"],
    ["5-6-02", "Где ягод больше?", "Справа"],
    ["5-6-03", "У Ёжика 3 яблока, а у Лисёнка 2. Сколько яблок всего?", "5"],
    ["5-6-04", "Какое число пропущено?\n1 — 2 — 3 — ? — 5", "4"],
    ["5-6-05", "Какой первый звук в слове МАК?", "М"],
    ["5-6-06", "Какой последний звук в слове КОТ?", "Т"],
    ["5-6-07", "Сколько слогов в слове ЛИСА?", "2"],
    ["5-6-08", "Что начинается со звука [С]?", "СОК"],
    ["5-6-09", "Что лишнее?", "Ромашка"],
    ["5-6-10", "Продолжи ряд\nкрасный круг → синий квадрат → красный круг → синий квадрат → красный круг → ?", "синий квадрат"],
    ["5-6-11", "Что дальше?\nбольшой круг → маленький круг → большой круг → ?", "маленький круг"],
    ["5-6-12", "Назови одним словом\nяблоко, груша, слива", "Фрукты"]
  ],
  "7-8": [
    ["7-8-01", "8 + 7 = ?", "15"],
    ["7-8-02", "16 − 9 = ?", "7"],
    ["7-8-03", "□ + 6 = 14", "8"],
    ["7-8-04", "На ветке сидели 9 птиц.\n4 птицы улетели.\nСколько птиц осталось?", "5"],
    ["7-8-05", "Сколько слогов в слове МАШИНА?", "3"],
    ["7-8-06", "На какой слог падает ударение в слове МОЛОКО́?", "3"],
    ["7-8-07", "Вставь букву: Ж_РАФ", "И"],
    ["7-8-08", "В каком слове нужен Ь?", "КОНЬ"],
    ["7-8-09", "Продолжи ряд\n2, 5, 8, 11, ?", "14"],
    ["7-8-10", "Закончи пару\nРыба — вода, птица — ?", "Небо"],
    ["7-8-11", "Что лишнее?", "Берёза"],
    ["7-8-12", "Карандаш не красный и не синий. Какого он цвета?", "Зелёный"]
  ],
  "9-10": [
    ["9-10-01", "7 × 8 = ?", "56"],
    ["9-10-02", "63 ÷ 9 = ?", "7"],
    ["9-10-03", "36 + 24 ÷ 6 = ?", "40"],
    ["9-10-04", "В четырёх коробках лежит по 6 карандашей.\n5 карандашей взяли.\nСколько осталось?", "19"],
    ["9-10-05", "Какое слово поможет проверить безударную гласную в слове «леса́»?", "Лес"],
    ["9-10-06", "Какую букву нужно вставить в слове ГРИ_? Проверочное слово — ГРИБЫ.", "Б"],
    ["9-10-07", "Какой частью речи является слово БЫСТРЫЙ?", "Прилагательное"],
    ["9-10-08", "Какая общая часть у слов: лес, лесной, лесник?", "ЛЕС"],
    ["9-10-09", "Продолжи ряд\n3, 6, 12, 24, ?", "48"],
    ["9-10-10", "Аня выше Бори.\nБоря выше Вовы.\nКто ниже всех?", "Вова"],
    ["9-10-11", "Ёжик прошёл:\n3 клетки вверх,\n2 клетки вправо,\n3 клетки вниз.\n\nГде он оказался относительно старта?", "2 клетки справа"],
    ["9-10-12", "Есть 2 шарфа и 3 шапки.\nСколько разных комплектов «шарф + шапка» можно составить?", "6"]
  ]
};

function getFullCatalog(ageGroup) {
  return tasks.createTaskSet(ageGroup, TASKS_BY_AGE[ageGroup].length, () => 0);
}

test("each age catalog matches the approved questions, answers, and local illustration paths", () => {
  Object.entries(TASKS_BY_AGE).forEach(([ageGroup, expectedTasks]) => {
    const generated = getFullCatalog(ageGroup);
    assert.deepEqual(
      generated.map(({ id, text, correctAnswer }) => [id, text, correctAnswer]),
      expectedTasks
    );

    generated.forEach((task, index) => {
      assert.equal(task.ageGroup, ageGroup);
      assert.equal(task.image, `/images/generation-tasks/${ageGroup}/task-${String(index + 1).padStart(2, "0")}.webp`);
      const imagePath = path.join(__dirname, "..", "public", task.image);
      assert.equal(fs.existsSync(imagePath), true);
      assert.equal(fs.readFileSync(imagePath).subarray(0, 4).toString("ascii"), "RIFF");
      assert.ok(task.options.includes(task.correctAnswer));
      assert.equal(task.answerBounds.length, task.options.length);
      task.answerBounds.forEach(([x, y, width, height]) => {
        assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0);
        assert.ok(x + width <= 320 && y + height <= 320);
      });
      assert.equal(new Set(task.options.map(tasks.normalizeAnswer)).size, task.options.length);
      assert.equal(tasks.checkAnswer(task, task.correctAnswer).correct, true);
      assert.equal(tasks.checkAnswer(task, "неверный ответ").correct, false);
    });
  });
});

test("static build publishes task illustrations at their browser URLs", () => {
  const projectRoot = path.join(__dirname, "..");
  execFileSync(process.execPath, ["scripts/build-static.mjs"], { cwd: projectRoot, stdio: "pipe" });

  assert.equal(
    fs.existsSync(path.join(projectRoot, "dist", "images", "generation-tasks", "5-6", "task-12.webp")),
    true
  );
});

test("image-backed task options keep the artwork order so invisible hitboxes match", () => {
  const kotTask = getFullCatalog("5-6").find((task) => task.id === "5-6-06");

  assert.ok(kotTask);
  assert.deepEqual(kotTask.options, ["К", "О", "Т"]);
  assert.equal(tasks.checkAnswer(kotTask, "Т").correct, true);
  assert.equal(tasks.checkAnswer(kotTask, "К").correct, false);
});

test("next task never repeats either of the two most recently shown task identifiers", () => {
  const shown = ["7-8-01", "7-8-02"];
  const next = tasks.pickNextTask("7-8", shown, () => 0);

  assert.equal(next.id, "7-8-03");
  assert.equal(shown.includes(next.id), false);
});

test("answer checking uses the stored answer instead of recalculating from image metadata", () => {
  const task = getFullCatalog("9-10")[2];
  assert.equal(task.correctAnswer, "40");
  assert.equal(tasks.checkAnswer(task, "40").correct, true);
  assert.equal(tasks.checkAnswer(task, "60").correct, false);
});
