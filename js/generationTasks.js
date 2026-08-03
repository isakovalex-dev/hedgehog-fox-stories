(function (window) {
  "use strict";

  const SUPPORTED_AGE_GROUPS = new Set(["5-6", "7-8", "9-10"]);

  const AGE_TASK_CONFIG = {
    "5-6": {
      difficulty: "easy",
      arithmetic: {
        add: [[2, 3], [4, 2]],
        multiply: [[2, 3], [3, 2]]
      }
    },
    "7-8": {
      difficulty: "medium",
      arithmetic: {
        add: [[14, 8], [17, 6]],
        multiply: [[4, 5], [3, 6]]
      }
    },
    "9-10": {
      difficulty: "hard",
      arithmetic: {
        add: [[36, 27], [48, 19]],
        multiply: [[6, 7], [8, 9]]
      }
    }
  };

  const NON_MATH_TEMPLATES = {
    "5-6": [
      {
        id: "strawberry-color",
        type: "knowledge",
        text: "Какого цвета спелая клубника?",
        visual: { emoji: "🍓" },
        options: ["красный", "синий", "фиолетовый", "серый"],
        correctAnswer: "красный",
        hint: "Вспомни цвет ягоды на картинке.",
        explanation: "Спелая клубника обычно красная."
      },
      {
        id: "kitten",
        type: "knowledge",
        text: "Как называется детёныш кошки?",
        visual: { emoji: "🐱" },
        options: ["котёнок", "щенок", "телёнок", "утёнок"],
        correctAnswer: "котёнок",
        hint: "Это маленькая кошка.",
        explanation: "Детёныша кошки называют котёнком."
      }
    ],
    "7-8": [
      {
        id: "bee-home",
        type: "knowledge",
        text: "Как называется дом пчёл?",
        visual: { emoji: "🐝" },
        options: ["улей", "берлога", "гнездо", "нора"],
        correctAnswer: "улей",
        hint: "В нём пчёлы хранят мёд.",
        explanation: "Пчёлы живут в улье."
      },
      {
        id: "extra-word",
        type: "classification",
        text: "Какое слово лишнее: берёза, дуб, стол, клён?",
        visual: { emoji: "🌳" },
        options: ["стол", "берёза", "дуб", "клён"],
        correctAnswer: "стол",
        hint: "Три слова называют деревья.",
        explanation: "Берёза, дуб и клён — деревья, а стол — предмет мебели."
      }
    ],
    "9-10": [
      {
        id: "synonym",
        type: "word",
        text: "Какое слово близко по смыслу к слову «смелый»?",
        visual: { emoji: "🦁" },
        options: ["храбрый", "сонный", "тихий", "мокрый"],
        correctAnswer: "храбрый",
        hint: "Так можно назвать человека, который не боится трудностей.",
        explanation: "Слова «смелый» и «храбрый» близки по смыслу."
      },
      {
        id: "planet",
        type: "knowledge",
        text: "Какая планета известна как Красная планета?",
        visual: { emoji: "🪐" },
        options: ["Марс", "Земля", "Венера", "Нептун"],
        correctAnswer: "Марс",
        hint: "Это четвёртая планета от Солнца.",
        explanation: "Марс называют Красной планетой из-за цвета его поверхности."
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
    return AGE_TASK_CONFIG[normalizeAgeGroup(ageGroup)];
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

  function buildOptions(correctAnswer, distractors, random) {
    const options = [String(correctAnswer)];

    distractors.forEach((distractor) => {
      const option = String(distractor);
      if (!options.some((value) => normalizeAnswer(value) === normalizeAnswer(option))) options.push(option);
    });

    return shuffle(options, random);
  }

  function createFixedTask(ageGroup, template, random) {
    return {
      id: `${ageGroup}-${template.id}`,
      ageGroup,
      type: template.type,
      text: template.text,
      visual: { ...template.visual },
      options: shuffle(template.options, random),
      correctAnswer: template.correctAnswer,
      hint: template.hint,
      explanation: template.explanation,
      difficulty: getAgeTaskConfig(ageGroup).difficulty
    };
  }

  function calculateArithmeticAnswer(visual) {
    const left = Number(visual?.left);
    const right = Number(visual?.right);

    if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
    if (visual.operation === "add") return left + right;
    if (visual.operation === "multiply") return left * right;
    return null;
  }

  function createArithmeticTask(ageGroup, operation, random) {
    const config = getAgeTaskConfig(ageGroup);
    const pairs = config.arithmetic[operation];
    const [left, right] = pairs[Math.floor(getRandomValue(random) * pairs.length)];
    const visual = {
      left,
      right,
      operation,
      symbol: operation === "multiply" ? "×" : "+"
    };
    const answer = calculateArithmeticAnswer(visual);
    const distractors = operation === "multiply"
      ? [answer + left, answer - right, left + right]
      : [answer + 1, answer - 1, left * right];

    return {
      id: `${ageGroup}-arithmetic-${operation}-${left}-${right}`,
      ageGroup,
      type: "arithmetic",
      text: `Сколько будет ${left} ${visual.symbol} ${right}?`,
      visual,
      options: buildOptions(answer, distractors, random),
      correctAnswer: String(answer),
      hint: operation === "multiply" ? "Это несколько одинаковых групп." : "Сложи числа по порядку.",
      explanation: `${left} ${visual.symbol} ${right} = ${answer}.`,
      difficulty: config.difficulty
    };
  }

  function createTaskSet(ageGroup, count = 3, random) {
    const normalizedAgeGroup = normalizeAgeGroup(ageGroup);
    const requestedCount = Math.max(0, Math.floor(Number(count)) || 0);
    const templates = NON_MATH_TEMPLATES[normalizedAgeGroup];
    const factories = [
      ...templates.map((template) => () => createFixedTask(normalizedAgeGroup, template, random)),
      () => createArithmeticTask(normalizedAgeGroup, "add", random),
      () => createArithmeticTask(normalizedAgeGroup, "multiply", random)
    ];

    if (requestedCount > factories.length) {
      throw new RangeError(`Cannot create ${requestedCount} unique tasks for age group ${normalizedAgeGroup}.`);
    }

    const previousTaskIds = new Set();
    const tasks = [];
    const startIndex = Math.floor(getRandomValue(random) * factories.length);

    for (let offset = 0; tasks.length < requestedCount && offset < factories.length; offset += 1) {
      const task = factories[(startIndex + offset) % factories.length]();
      if (!previousTaskIds.has(task.id)) {
        previousTaskIds.add(task.id);
        tasks.push(task);
      }
    }

    return tasks;
  }

  function checkAnswer(task, answer) {
    const expectedAnswer = task?.type === "arithmetic"
      ? calculateArithmeticAnswer(task.visual)
      : task?.correctAnswer;
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
