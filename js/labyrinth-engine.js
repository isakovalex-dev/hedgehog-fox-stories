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

  function getLevel(levelId) {
    const level = LEVELS.find((item) => item.id === levelId);
    if (!level) throw new Error(`Unknown labyrinth level: ${levelId}`);
    return level;
  }

  function getEncounter(levelId, encounterId) {
    const encounter = getLevel(levelId).encounters.find((item) => item.id === encounterId);
    if (!encounter) throw new Error(`Unknown labyrinth encounter: ${encounterId}`);
    return encounter;
  }

  function getEncounterAt(levelId, position) {
    return getLevel(levelId).encounters.find((item) => item.row === position.row && item.column === position.column) || null;
  }

  function createState(levelId, hero) {
    const level = getLevel(levelId);
    const position = findMarker(level.map, "S");
    const entryEncounter = getEncounterAt(levelId, position);
    return {
      levelId,
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

    const level = getLevel(state.levelId);
    const position = { row: state.position.row + step.row, column: state.position.column + step.column };
    const tile = level.map[position.row]?.[position.column];

    if (!tile || tile === "#") {
      return registerMistake(state, "Там густые кусты. Попробуй другую тропинку.");
    }

    const completed = tile === "G";
    const encounter = getEncounterAt(state.levelId, position);
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

  return { LEVELS, completeEncounter, createState, getEncounter, getEncounterAt, getLevel, move, positionKey, registerMistake };
});
