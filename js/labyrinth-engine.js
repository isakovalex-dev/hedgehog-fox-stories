(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.HFLabyrinthEngine = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const LEVELS = [
    {
      id: "easy",
      title: "Лесной старт",
      displayTitle: "Лесной старт",
      label: "Лёгкий",
      difficulty: "Лёгкий",
      age: "3–5 лет",
      art: "assets/labyrinth/storybook/forest-start-background-v3.png",
      gridBounds: { left: 10, top: 8, right: 90, bottom: 92 },
      summary: "Короткий лабиринт с понятными поворотами.",
      prize: {
        icon: "✦",
        title: "Сундучок лесных секретов",
        description: "В нём лежат тёплый листик, звёздочка и добрые слова для следующего путешествия."
      },
      encounters: [
        {
          id: "easy-entry-puzzle",
          row: 9,
          column: 1,
          kind: "puzzle",
          title: "Записка у входа",
          icon: "❦",
          prompt: "У Ёжика две шишки и один желудь. Сколько находок в корзинке?",
          answers: ["2", "3", "4"],
          correctAnswer: 1,
          success: "Верно! Первая тропинка ведёт вверх."
        },
        {
          id: "easy-sun-ticket",
          row: 3,
          column: 7,
          kind: "ticket",
          title: "Билетик развилки",
          icon: "✦",
          prompt: "На билетике нарисована стрелка: после поворота посмотри в сторону сундука.",
          buttonLabel: "Взять билетик",
          success: "Билетик подскажет дорогу, а приз ждёт только в сундуке."
        }
      ],
      map: [
        "###########",
        "#####.###G#",
        "#####.###.#",
        "###.......#",
        "###.###.###",
        "###.....###",
        "#######.###",
        "#.......###",
        "#.#########",
        "#S....#####",
        "###########"
      ]
    },
    {
      id: "medium",
      title: "Таинственный лес",
      displayTitle: "Таинственный лес",
      label: "Средний",
      difficulty: "Средний",
      age: "6–7 лет",
      art: "assets/labyrinth/storybook/mystery-forest-background-v3.png",
      gridBounds: { left: 8, top: 8, right: 92, bottom: 92 },
      summary: "Больше ходов, ручьи и мостики.",
      prize: {
        icon: "✦",
        title: "Фонарик таинственного леса",
        description: "Его мягкий свет поможет друзьям замечать тропинки даже у самых тихих ручьёв."
      },
      encounters: [
        {
          id: "medium-entry-puzzle",
          row: 11,
          column: 1,
          kind: "puzzle",
          title: "Записка у входа",
          icon: "❦",
          prompt: "На дорожке лежат три круглых камешка и один листик. Чего больше: камешков или листиков?",
          answers: ["Камешков", "Листиков", "Поровну"],
          correctAnswer: 0,
          success: "Верно! Камешки показали первую тропинку вверх."
        },
        {
          id: "medium-lantern-ticket",
          row: 5,
          column: 5,
          kind: "ticket",
          title: "Билетик мостика",
          icon: "✧",
          prompt: "На билетике горит фонарик. Он советует не спешить у следующей развилки.",
          buttonLabel: "Взять билетик",
          success: "Тёплый свет подсказал, куда смотреть дальше."
        }
      ],
      map: [
        "#############",
        "###########G#",
        "###########.#",
        "#####.#####.#",
        "#####.#####.#",
        "###.......#.#",
        "###.#####.#.#",
        "###...###...#",
        "#####.#####.#",
        "#.....#####.#",
        "#.#########.#",
        "#S....#####.#",
        "#############"
      ]
    },
    {
      id: "hard",
      title: "Горная пещера",
      displayTitle: "Горная пещера",
      label: "Сложный",
      difficulty: "Сложный",
      age: "8–10 лет",
      art: "assets/labyrinth/storybook/mountain-cave-background-v3.png",
      gridBounds: { left: 7, top: 7, right: 93, bottom: 93 },
      summary: "Длинный путь с мостами, лестницами и тупиками.",
      prize: {
        icon: "✧",
        title: "Горная карта приключений",
        description: "На ней отмечены добрые места, куда Ёжик и Лисёнок ещё обязательно заглянут вместе."
      },
      encounters: [
        {
          id: "hard-entry-puzzle",
          row: 13,
          column: 1,
          kind: "puzzle",
          title: "Записка у входа",
          icon: "❦",
          prompt: "У Лисёнка четыре ягодки. Две он оставил для друга. Сколько ягодок осталось у Лисёнка?",
          answers: ["1", "2", "3"],
          correctAnswer: 1,
          success: "Верно! Две ягодки остались в кармашке, а путь ведёт вверх."
        },
        {
          id: "hard-compass-ticket",
          row: 7,
          column: 7,
          kind: "ticket",
          title: "Билетик с компасом",
          icon: "✦",
          prompt: "Стрелка маленького компаса не любит тупики и показывает к свободной тропинке справа.",
          buttonLabel: "Запомнить подсказку",
          success: "Компас тихо звякнул: путь открыт."
        }
      ],
      map: [
        "###############",
        "###########.#G#",
        "###########.#.#",
        "###########...#",
        "###########.###",
        "#########.....#",
        "#######.#####.#",
        "###.......###.#",
        "###.#.###.###.#",
        "###...###.....#",
        "###.#.#####.###",
        "#.....#####.###",
        "#.#########.###",
        "#S....#####.###",
        "###############"
      ]
    }
  ];

  const ENDLESS_THEMES = [
    {
      title: "Лесная тропинка",
      label: "Лёгкий",
      difficulty: "Лёгкий",
      age: "3–5 лет",
      art: "assets/labyrinth/storybook/forest-start-background-v3.png",
      gridBounds: { left: 10, top: 8, right: 90, bottom: 92 },
      summary: "Новая лесная глава с прямыми тропинками и тихими развилками.",
      prizeTitle: "Лесной сюрприз"
    },
    {
      title: "Таинственная поляна",
      label: "Средний",
      difficulty: "Средний",
      age: "6–7 лет",
      art: "assets/labyrinth/storybook/mystery-forest-background-v3.png",
      gridBounds: { left: 8, top: 8, right: 92, bottom: 92 },
      summary: "Тропинки становятся длиннее, а вокруг слышно журчание ручьёв.",
      prizeTitle: "Находка таинственной поляны"
    },
    {
      title: "Горный маршрут",
      label: "Сложный",
      difficulty: "Сложный",
      age: "8–10 лет",
      art: "assets/labyrinth/storybook/mountain-cave-background-v3.png",
      gridBounds: { left: 7, top: 7, right: 93, bottom: 93 },
      summary: "Длинная горная глава с множеством честных развилок.",
      prizeTitle: "Горная находка"
    }
  ];

  const ENDLESS_PUZZLES = [
    {
      prompt: "У Ёжика две шишки и один желудь. Сколько находок в корзинке?",
      answers: ["2", "3", "4"],
      correctAnswer: 1,
      success: "Верно! Первая тропинка ведёт дальше."
    },
    {
      prompt: "У Лисёнка четыре ягодки. Две он оставил для друга. Сколько ягодок осталось?",
      answers: ["1", "2", "3"],
      correctAnswer: 1,
      success: "Верно! Добрая подсказка открыла путь."
    },
    {
      prompt: "На пеньке сидят три светлячка, а потом прилетел ещё один. Сколько их стало?",
      answers: ["3", "4", "5"],
      correctAnswer: 1,
      success: "Верно! Светлячки подсветили первую развилку."
    }
  ];

  const STEPS = {
    up: { row: -1, column: 0 },
    down: { row: 1, column: 0 },
    left: { row: 0, column: -1 },
    right: { row: 0, column: 1 }
  };

  const NEARBY_STEPS = [
    { row: 0, column: 0 },
    { row: 0, column: -1 },
    { row: 0, column: 1 },
    { row: -1, column: 0 },
    { row: 1, column: 0 }
  ];

  function positionKey(position) {
    return `${position.row}:${position.column}`;
  }

  function sortPositionKeys(keys) {
    return [...keys].sort((left, right) => {
      const [leftRow, leftColumn] = left.split(":").map(Number);
      const [rightRow, rightColumn] = right.split(":").map(Number);
      return leftRow - rightRow || leftColumn - rightColumn;
    });
  }

  function revealNearby(level, position, discovered = []) {
    const revealed = new Set(discovered);
    for (const step of NEARBY_STEPS) {
      const row = position.row + step.row;
      const column = position.column + step.column;
      if (level.map[row]?.[column] !== undefined) revealed.add(positionKey({ row, column }));
    }
    return sortPositionKeys(revealed);
  }

  function findMarker(map, marker) {
    for (let row = 0; row < map.length; row += 1) {
      const column = map[row].indexOf(marker);
      if (column !== -1) return { row, column };
    }
    throw new Error(`Labyrinth map is missing ${marker}`);
  }

  function normalizeEndlessChapter(chapter) {
    const normalized = Math.max(1, Math.floor(Number(chapter) || 1));
    return Number.isFinite(normalized) ? normalized : 1;
  }

  function createSeededRandom(seed) {
    let value = seed >>> 0;
    return function random() {
      value += 0x6D2B79F5;
      let mixed = value;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildPerfectMaze(roomColumns, roomRows, random) {
    const columnCount = roomColumns * 2 + 1;
    const rowCount = roomRows * 2 + 1;
    const maze = Array.from({ length: rowCount }, () => Array.from({ length: columnCount }, () => "#"));
    const start = { row: rowCount - 2, column: 1 };
    const visited = new Set([positionKey(start)]);
    const stack = [start];
    maze[start.row][start.column] = ".";

    while (stack.length) {
      const current = stack.at(-1);
      const candidates = [];
      for (const step of Object.values(STEPS)) {
        const next = { row: current.row + step.row * 2, column: current.column + step.column * 2 };
        const withinRooms = next.row > 0 && next.row < rowCount - 1 && next.column > 0 && next.column < columnCount - 1;
        if (withinRooms && !visited.has(positionKey(next))) candidates.push({ next, step });
      }

      if (!candidates.length) {
        stack.pop();
        continue;
      }

      const choice = candidates[Math.floor(random() * candidates.length)];
      const between = { row: current.row + choice.step.row, column: current.column + choice.step.column };
      maze[between.row][between.column] = ".";
      maze[choice.next.row][choice.next.column] = ".";
      visited.add(positionKey(choice.next));
      stack.push(choice.next);
    }

    return maze.map((row) => row.join(""));
  }

  function routeBetween(map, start, goal) {
    const queue = [start];
    const previous = new Map([[positionKey(start), null]]);

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (current.row === goal.row && current.column === goal.column) break;

      for (const step of Object.values(STEPS)) {
        const next = { row: current.row + step.row, column: current.column + step.column };
        const key = positionKey(next);
        const tile = map[next.row]?.[next.column];
        if (!tile || tile === "#" || previous.has(key)) continue;
        previous.set(key, current);
        queue.push(next);
      }
    }

    const route = [];
    let current = goal;
    while (current) {
      route.push(current);
      current = previous.get(positionKey(current));
    }
    return route.reverse();
  }

  function endlessChapterSetup(chapter) {
    const themeIndex = (chapter - 1) % ENDLESS_THEMES.length;
    if (chapter === 1) return { themeIndex, roomColumns: 5, roomRows: 4, difficulty: "Лёгкий", age: "3–5 лет" };
    if (chapter === 2) return { themeIndex, roomColumns: 6, roomRows: 5, difficulty: "Средний", age: "6–7 лет" };
    if (chapter === 3) return { themeIndex, roomColumns: 7, roomRows: 6, difficulty: "Сложный", age: "8–10 лет" };
    return themeIndex === 0
      ? { themeIndex, roomColumns: 6, roomRows: 5, difficulty: "Средний", age: "6–7 лет" }
      : { themeIndex, roomColumns: 7, roomRows: 6, difficulty: "Сложный", age: "8–10 лет" };
  }

  function createEndlessLevel(chapter) {
    const normalizedChapter = normalizeEndlessChapter(chapter);
    const setup = endlessChapterSetup(normalizedChapter);
    const theme = ENDLESS_THEMES[setup.themeIndex];
    const start = { row: setup.roomRows * 2 - 1, column: 1 };
    const goal = { row: 1, column: setup.roomColumns * 2 - 1 };
    const minimumRouteLength = setup.roomRows + setup.roomColumns + 4;
    let selected = null;

    for (let variant = 0; variant < 24; variant += 1) {
      const seed = (Math.imul(normalizedChapter, 0x9E3779B1) + Math.imul(variant + 1, 0x85EBCA77)) >>> 0;
      const map = buildPerfectMaze(setup.roomColumns, setup.roomRows, createSeededRandom(seed));
      const route = routeBetween(map, start, goal);
      const candidate = { map, route };
      if (!selected || candidate.route.length > selected.route.length) selected = candidate;
      if (route.length - 1 >= minimumRouteLength) {
        selected = candidate;
        break;
      }
    }

    const map = selected.map.map((line) => line.split(""));
    map[start.row][start.column] = "S";
    map[goal.row][goal.column] = "G";
    const ticketPosition = selected.route[Math.max(1, Math.min(selected.route.length - 2, Math.floor(selected.route.length / 2)))];
    const puzzle = ENDLESS_PUZZLES[(normalizedChapter - 1) % ENDLESS_PUZZLES.length];
    const levelId = `endless-${normalizedChapter}`;

    return {
      id: levelId,
      chapter: normalizedChapter,
      title: `Глава ${normalizedChapter}: ${theme.title}`,
      displayTitle: `Бесконечная глава ${normalizedChapter}`,
      label: setup.difficulty,
      difficulty: setup.difficulty,
      age: setup.age,
      art: theme.art,
      gridBounds: theme.gridBounds,
      summary: theme.summary,
      prize: {
        icon: setup.difficulty === "Сложный" ? "✧" : "✦",
        title: `${theme.prizeTitle} — глава ${normalizedChapter}`,
        description: "Находка ждала в сундуке в самом конце лабиринта. Её можно взять с собой в следующую главу."
      },
      encounters: [
        {
          id: `${levelId}-entry-puzzle`,
          row: start.row,
          column: start.column,
          kind: "puzzle",
          title: "Записка у входа",
          icon: "❦",
          prompt: puzzle.prompt,
          answers: [...puzzle.answers],
          correctAnswer: puzzle.correctAnswer,
          success: puzzle.success
        },
        {
          id: `${levelId}-route-ticket`,
          row: ticketPosition.row,
          column: ticketPosition.column,
          kind: "ticket",
          title: "Билетик развилки",
          icon: "✦",
          prompt: "На билетике нарисована стрелка. Она подскажет, куда посмотреть у следующей развилки.",
          buttonLabel: "Взять билетик",
          success: "Билетик запомнил путь. А главная находка всё ещё ждёт в сундуке."
        }
      ],
      map: map.map((row) => row.join(""))
    };
  }

  function resolveLevel(levelRef) {
    if (levelRef && typeof levelRef === "object" && Array.isArray(levelRef.map) && Array.isArray(levelRef.encounters)) return levelRef;
    return getLevel(levelRef);
  }

  function getLevel(levelId) {
    const level = LEVELS.find((item) => item.id === levelId);
    if (level) return level;
    const endlessMatch = typeof levelId === "string" ? /^endless-(\d+)$/.exec(levelId) : null;
    if (endlessMatch) return createEndlessLevel(Number(endlessMatch[1]));
    throw new Error(`Unknown labyrinth level: ${levelId}`);
  }

  function getEncounter(levelRef, encounterId) {
    const encounter = resolveLevel(levelRef).encounters.find((item) => item.id === encounterId);
    if (!encounter) throw new Error(`Unknown labyrinth encounter: ${encounterId}`);
    return encounter;
  }

  function getEncounterAt(levelRef, position) {
    return resolveLevel(levelRef).encounters.find((item) => item.row === position.row && item.column === position.column) || null;
  }

  function createState(levelRef, hero) {
    const level = resolveLevel(levelRef);
    const position = findMarker(level.map, "S");
    const entryEncounter = getEncounterAt(level, position);
    return {
      levelId: level.id,
      level,
      hero: hero === "fox" ? "fox" : "hedgehog",
      position,
      goal: findMarker(level.map, "G"),
      moves: 0,
      moved: false,
      completed: false,
      lives: 3,
      maxLives: 3,
      prize: null,
      discovered: revealNearby(level, position),
      seenEncounters: [],
      pendingEncounter: entryEncounter?.id || null,
      message: entryEncounter ? "У входа лежит записка." : "Выбери первую тропинку."
    };
  }

  function completeEncounter(state, encounterId) {
    if (!encounterId || state.pendingEncounter !== encounterId) return state;
    return {
      ...state,
      pendingEncounter: null,
      seenEncounters: [...state.seenEncounters, encounterId],
      message: "Подсказка запомнилась. Можно идти дальше."
    };
  }

  function registerMistake(state, message = "Ничего страшного — попробуй ещё раз.") {
    return {
      ...state,
      lives: Math.max(0, state.lives - 1),
      moved: false,
      message
    };
  }

  function move(state, direction) {
    const step = STEPS[direction];
    if (!step || state.completed) return { ...state, moved: false };
    if (state.pendingEncounter) {
      return { ...state, moved: false, message: "Сначала посмотри на записку у тропинки." };
    }

    const level = state.level || resolveLevel(state.levelId);
    const position = { row: state.position.row + step.row, column: state.position.column + step.column };
    const tile = level.map[position.row]?.[position.column];

    if (!tile || tile === "#") {
      return registerMistake(state, "Там густые кусты. Попробуй другую тропинку.");
    }

    const completed = tile === "G";
    const encounter = getEncounterAt(level, position);
    const pendingEncounter = encounter && !state.seenEncounters.includes(encounter.id) ? encounter.id : null;
    return {
      ...state,
      position,
      moves: state.moves + 1,
      moved: true,
      completed,
      prize: completed ? level.prize : state.prize,
      discovered: revealNearby(level, position, state.discovered),
      pendingEncounter,
      message: completed ? "Сундук найден!" : pendingEncounter ? "На тропинке ждёт маленькая подсказка." : "Тропинка ведёт дальше."
    };
  }

  return { LEVELS, completeEncounter, createEndlessLevel, createState, getEncounter, getEncounterAt, getLevel, move, positionKey, registerMistake };
});
