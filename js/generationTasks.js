(function (window) {
  "use strict";

  const SUPPORTED_AGE_GROUPS = new Set(["5-6", "7-8", "9-10"]);
  const AGE_TASK_CONFIG = {
    "5-6": { difficulty: "easy", minOptions: 2, maxOptions: 3 },
    "7-8": { difficulty: "medium", minOptions: 3, maxOptions: 4 },
    "9-10": { difficulty: "hard", minOptions: 3, maxOptions: 4 }
  };

  const TASK_CATALOG = {
    "5-6": [
      {
        id: "counting-berries",
        type: "counting",
        text: "Сколько ягод на полянке, если их шесть?",
        visual: { operation: "count", count: 6, max: 10, emoji: "🍓" },
        options: ["4", "6", "8"],
        hint: "Посчитай ягоды по одной.",
        explanation: "На полянке шесть ягод."
      },
      {
        id: "comparison-apples",
        type: "comparison",
        text: "Где яблок больше: 7 или 4?",
        visual: { operation: "comparison", left: 7, right: 4, max: 10, emoji: "🍎" },
        options: ["7", "4", "Поровну"],
        hint: "Семь больше, чем четыре.",
        explanation: "Семь яблок — это больше, чем четыре."
      },
      {
        id: "sequence-steps",
        type: "sequence",
        text: "Продолжи ряд: 2, 3, 4, …",
        visual: { operation: "sequence", values: [2, 3, 4], step: 1, max: 10 },
        options: ["5", "3", "7"],
        hint: "Каждый раз прибавляем один.",
        explanation: "После 2, 3 и 4 будет 5."
      },
      {
        id: "color-sun",
        type: "color",
        text: "Какого цвета солнышко на ясном рисунке?",
        visual: { operation: "color", emoji: "☀️" },
        correctAnswer: "жёлтое",
        options: ["жёлтое", "синее", "фиолетовое"],
        hint: "Вспомни ясное небо и тёплый свет.",
        explanation: "Солнышко на рисунке обычно жёлтое."
      },
      {
        id: "shape-triangle",
        type: "shape",
        text: "Какая фигура похожа на крышу домика?",
        visual: { operation: "shape", sides: 3 },
        correctAnswer: "треугольник",
        options: ["треугольник", "круг", "квадрат"],
        hint: "У этой фигуры три уголка.",
        explanation: "У треугольника три стороны, как у простой крыши."
      },
      {
        id: "pair-mitten",
        type: "pair",
        text: "Что станет парой для варежки?",
        visual: { operation: "pair", emoji: "🧤" },
        correctAnswer: "другая варежка",
        options: ["другая варежка", "ложка", "мяч"],
        hint: "Варежки носят по две.",
        explanation: "У варежки есть парная варежка для другой руки."
      },
      {
        id: "letter-kot",
        type: "missing-letter",
        text: "Какую букву нужно поставить: К_Т?",
        visual: { operation: "missing-letter", word: "кот" },
        correctAnswer: "О",
        options: ["О", "А", "И"],
        hint: "Так зовут маленького домашнего зверька.",
        explanation: "В слове «кот» после К пишется буква О."
      }
    ],
    "7-8": [
      {
        id: "addition-8-7",
        type: "arithmetic",
        text: "Сколько будет 8 + 7?",
        visual: { operation: "add", left: 8, right: 7, symbol: "+", limit: 20 },
        options: ["15", "14", "16", "13"],
        hint: "Можно сначала прибавить 2, чтобы получить 10.",
        explanation: "8 + 7 = 15."
      },
      {
        id: "subtraction-18-9",
        type: "arithmetic",
        text: "Сколько будет 18 − 9?",
        visual: { operation: "subtract", left: 18, right: 9, symbol: "−", limit: 20 },
        options: ["9", "8", "10", "7"],
        hint: "Отсчитай назад девять шагов от 18.",
        explanation: "18 − 9 = 9."
      },
      {
        id: "multiply-5-3",
        type: "arithmetic",
        text: "Сколько будет 5 × 3?",
        visual: { operation: "multiply", left: 5, right: 3, symbol: "×", table: [2, 3, 5] },
        options: ["15", "10", "12", "18"],
        hint: "Это три группы по пять.",
        explanation: "5 × 3 = 15."
      },
      {
        id: "multiply-4-2",
        type: "arithmetic",
        text: "Сколько будет 4 × 2?",
        visual: { operation: "multiply", left: 4, right: 2, symbol: "×", table: [2, 3, 5] },
        options: ["8", "6", "10", "12"],
        hint: "Это две группы по четыре.",
        explanation: "4 × 2 = 8."
      },
      {
        id: "multiply-3-5",
        type: "arithmetic",
        text: "Сколько будет 3 × 5?",
        visual: { operation: "multiply", left: 3, right: 5, symbol: "×", table: [2, 3, 5] },
        options: ["15", "10", "12", "20"],
        hint: "Это пять групп по три.",
        explanation: "3 × 5 = 15."
      },
      {
        id: "sequence-3-6-9",
        type: "sequence",
        text: "Продолжи ряд: 3, 6, 9, …",
        visual: { operation: "sequence", values: [3, 6, 9], step: 3 },
        options: ["12", "10", "15", "18"],
        hint: "Каждый раз прибавляем три.",
        explanation: "После 3, 6 и 9 будет 12."
      },
      {
        id: "syllables-moloko",
        type: "syllables",
        text: "Сколько слогов в слове «молоко»?",
        visual: { operation: "syllables", word: "мо-ло-ко", count: 3 },
        correctAnswer: "3",
        options: ["3", "2", "4", "5"],
        hint: "Произнеси слово медленно: мо-ло-ко.",
        explanation: "В слове «молоко» три слога."
      },
      {
        id: "logic-nuts",
        type: "logic",
        text: "У Лисёнка 3 орешка, а у Ёжика на 2 орешка больше. Сколько орешков у Ёжика?",
        visual: { operation: "logic", base: 3, change: 2 },
        options: ["5", "4", "6", "3"],
        hint: "К трём орешкам добавь ещё два.",
        explanation: "3 + 2 = 5, значит у Ёжика пять орешков."
      }
    ],
    "9-10": [
      {
        id: "multiply-7-8",
        type: "arithmetic",
        text: "Сколько будет 7 × 8?",
        visual: { operation: "multiply", left: 7, right: 8, symbol: "×" },
        options: ["56", "54", "48", "64"],
        hint: "Вспомни таблицу умножения на семь или восемь.",
        explanation: "7 × 8 = 56."
      },
      {
        id: "divide-48-6",
        type: "arithmetic",
        text: "Сколько будет 48 ÷ 6?",
        visual: { operation: "divide", dividend: 48, divisor: 6, symbol: "÷" },
        options: ["8", "6", "7", "9"],
        hint: "Подумай, сколько раз по шесть помещается в сорока восьми.",
        explanation: "48 ÷ 6 = 8."
      },
      {
        id: "expression-4-5-3",
        type: "expression",
        text: "Реши выражение: 4 × 5 + 3.",
        visual: { operation: "two-step", left: 4, multiplier: 5, add: 3 },
        options: ["23", "35", "20", "17"],
        hint: "Сначала выполни умножение, затем сложение.",
        explanation: "4 × 5 = 20, а 20 + 3 = 23."
      },
      {
        id: "word-problem-baskets",
        type: "word-problem",
        text: "В трёх корзинах по 6 яблок. Два яблока друзья отдали. Сколько осталось?",
        visual: { operation: "word-problem", groups: 3, each: 6, givenAway: 2 },
        options: ["16", "18", "14", "12"],
        hint: "Сначала узнай, сколько яблок было во всех корзинах.",
        explanation: "3 × 6 = 18, затем 18 − 2 = 16."
      },
      {
        id: "classification-transport",
        type: "classification",
        text: "Какое слово лишнее: автобус, трамвай, велосипед, берёза?",
        visual: { operation: "classification" },
        correctAnswer: "берёза",
        options: ["берёза", "автобус", "трамвай", "велосипед"],
        hint: "Три слова называют транспорт.",
        explanation: "Берёза — дерево, а остальные слова называют транспорт."
      },
      {
        id: "spelling-poles",
        type: "spelling",
        text: "Выбери слово без ошибки.",
        visual: { operation: "spelling" },
        correctAnswer: "путешествие",
        options: ["путешествие", "путишествие", "путешэствие", "путешевствие"],
        hint: "Вспомни слово «путь».",
        explanation: "Правильно пишется: «путешествие»."
      },
      {
        id: "route-garden",
        type: "route",
        text: "От домика сделай два шага вправо и один вверх. К какой точке придёшь?",
        visual: { operation: "route", start: [0, 0], moves: [[1, 0], [1, 0], [0, 1]], finish: [2, 1] },
        correctAnswer: "Б",
        options: ["Б", "А", "В", "Г"],
        hint: "Сначала считай два шага вправо, потом один вверх.",
        explanation: "После двух шагов вправо и одного вверх получится точка Б."
      }
    ]
  };

  function normalizeAgeGroup(value) {
    const ageGroup = String(value || "").replaceAll("–", "-");
    return SUPPORTED_AGE_GROUPS.has(ageGroup) ? ageGroup : "5-6";
  }

  function normalizeAnswer(answer) {
    return String(answer == null ? "" : answer).trim().toLowerCase().replaceAll("ё", "е");
  }

  function getAgeTaskConfig(ageGroup) {
    return { ...AGE_TASK_CONFIG[normalizeAgeGroup(ageGroup)] };
  }

  function getRandomValue(random) {
    const value = Number((typeof random === "function" ? random : Math.random)());
    return Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.9999999999999999) : 0;
  }

  function shuffle(values, random) {
    const shuffled = [...values];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const selectedIndex = Math.floor(getRandomValue(random) * (index + 1));
      [shuffled[index], shuffled[selectedIndex]] = [shuffled[selectedIndex], shuffled[index]];
    }
    return shuffled;
  }

  function calculateAnswer(visual) {
    if (!visual || typeof visual !== "object") return null;

    if (visual.operation === "count") return visual.count;
    if (visual.operation === "comparison") return Math.max(visual.left, visual.right);
    if (visual.operation === "sequence") return visual.values.at(-1) + visual.step;
    if (visual.operation === "add") return visual.left + visual.right;
    if (visual.operation === "subtract") return visual.left - visual.right;
    if (visual.operation === "multiply") return visual.left * visual.right;
    if (visual.operation === "divide") return visual.dividend / visual.divisor;
    if (visual.operation === "logic") return visual.base + visual.change;
    if (visual.operation === "two-step") return visual.left * visual.multiplier + visual.add;
    if (visual.operation === "word-problem") return visual.groups * visual.each - visual.givenAway;
    return null;
  }

  function buildOptions(correctAnswer, options, random) {
    const uniqueOptions = [];
    [correctAnswer, ...(options || [])].forEach((option) => {
      const text = String(option);
      if (!uniqueOptions.some((value) => normalizeAnswer(value) === normalizeAnswer(text))) uniqueOptions.push(text);
    });
    return shuffle(uniqueOptions, random);
  }

  function createTask(ageGroup, template, random) {
    const derivedAnswer = calculateAnswer(template.visual);
    const correctAnswer = String(derivedAnswer == null ? template.correctAnswer : derivedAnswer);
    return {
      id: `${ageGroup}-${template.id}`,
      ageGroup,
      type: template.type,
      text: template.text,
      visual: {
        ...template.visual,
        ...(Array.isArray(template.visual?.values) ? { values: [...template.visual.values] } : {}),
        ...(Array.isArray(template.visual?.start) ? { start: [...template.visual.start] } : {}),
        ...(Array.isArray(template.visual?.finish) ? { finish: [...template.visual.finish] } : {}),
        ...(Array.isArray(template.visual?.moves) ? { moves: template.visual.moves.map((move) => [...move]) } : {})
      },
      options: buildOptions(correctAnswer, template.options, random),
      correctAnswer,
      hint: template.hint,
      explanation: template.explanation,
      difficulty: AGE_TASK_CONFIG[ageGroup].difficulty
    };
  }

  function createTaskSet(ageGroup, count = 3, random) {
    const normalizedAgeGroup = normalizeAgeGroup(ageGroup);
    const requestedCount = Math.max(0, Math.floor(Number(count)) || 0);
    const templates = TASK_CATALOG[normalizedAgeGroup];

    if (requestedCount > templates.length) {
      throw new RangeError(`Cannot create ${requestedCount} unique tasks for age group ${normalizedAgeGroup}.`);
    }

    const previousTaskIds = new Set();
    const generated = [];
    const startIndex = Math.floor(getRandomValue(random) * templates.length);

    for (let offset = 0; generated.length < requestedCount && offset < templates.length; offset += 1) {
      const task = createTask(normalizedAgeGroup, templates[(startIndex + offset) % templates.length], random);
      if (!previousTaskIds.has(task.id)) {
        previousTaskIds.add(task.id);
        generated.push(task);
      }
    }

    return generated;
  }

  function checkAnswer(task, answer) {
    const derivedAnswer = calculateAnswer(task?.visual);
    const expectedAnswer = derivedAnswer == null ? task?.correctAnswer : derivedAnswer;
    const correct = expectedAnswer != null && normalizeAnswer(answer) === normalizeAnswer(expectedAnswer);
    return {
      correct,
      correctAnswer: expectedAnswer == null ? "" : String(expectedAnswer),
      hint: task?.hint || "",
      explanation: task?.explanation || ""
    };
  }

  window.HFGenerationTasks = {
    createTaskSet,
    checkAnswer,
    getAgeTaskConfig,
    normalizeAnswer
  };
})(window);
