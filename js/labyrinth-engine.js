(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.HFLabyrinthEngine = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const LEVELS = [
    {
      id: "easy",
      title: "Тропинка к письму",
      label: "Лёгкая",
      age: "5–6 лет",
      finding: "письмо с добрыми словами",
      prize: {
        icon: "✉",
        title: "Письмо с добрыми словами",
        description: "В нём написано: «Самая верная тропинка — та, по которой идёшь с добрым сердцем»."
      },
      encounters: [
        {
          id: "easy-entry-puzzle",
          row: 1,
          column: 1,
          kind: "puzzle",
          title: "Находка у входа",
          icon: "❦",
          prompt: "У Ёжика две шишки и один желудь. Сколько находок в корзинке?",
          answers: ["2", "3", "4"],
          correctAnswer: 1,
          success: "Верно! Первый след ведёт туда, где светлее тропинка."
        },
        {
          id: "easy-sun-ticket",
          row: 1,
          column: 3,
          kind: "ticket",
          title: "Призовой билетик",
          icon: "✦",
          prompt: "На билетике нарисовано утреннее солнце. Оно показывает: у письма тропинка продолжается вправо.",
          buttonLabel: "Положить билетик в кармашек",
          success: "Билетик остался в кармашке — подсказка всегда рядом."
        }
      ],
      map: ["#######", "#S...G#", "#####.#", "#.....#", "#######"]
    },
    {
      id: "medium",
      title: "Дорога к маяку",
      label: "Смелая",
      age: "7–8 лет",
      finding: "маленький огонёк маяка",
      prize: {
        icon: "✦",
        title: "Маленький огонёк маяка",
        description: "Его свет будет помогать друзьям возвращаться домой даже в самый тихий вечер."
      },
      encounters: [
        {
          id: "medium-entry-puzzle",
          row: 1,
          column: 1,
          kind: "puzzle",
          title: "Находка у входа",
          icon: "❦",
          prompt: "На дорожке лежат три круглых камешка и один листик. Чего больше: камешков или листиков?",
          answers: ["Камешков", "Листиков", "Поровну"],
          correctAnswer: 0,
          success: "Верно! Камешки выстроились и показали тропинку вниз."
        },
        {
          id: "medium-lantern-ticket",
          row: 5,
          column: 5,
          kind: "ticket",
          title: "Билетик фонарика",
          icon: "✧",
          prompt: "Фонарик на билетике светит вдоль длинной тропинки. Не спеши: верное направление сейчас — вправо.",
          buttonLabel: "Взять билетик",
          success: "Тёплый свет остался с героем в пути."
        }
      ],
      map: ["#########", "#S#....G#", "#.#.#####", "#.#.....#", "#.#####.#", "#.......#", "#########"]
    },
    {
      id: "hard",
      title: "Карта тёплого ветра",
      label: "Большое путешествие",
      age: "9–10 лет",
      finding: "карту тёплого ветра",
      prize: {
        icon: "✧",
        title: "Карта тёплого ветра",
        description: "На ней отмечены все добрые места, куда ещё смогут отправиться Ёжик и Лисёнок."
      },
      encounters: [
        {
          id: "hard-entry-puzzle",
          row: 1,
          column: 1,
          kind: "puzzle",
          title: "Находка у входа",
          icon: "❦",
          prompt: "У Лисёнка четыре ягодки. Две он оставил для друга. Сколько ягодок осталось у Лисёнка?",
          answers: ["1", "2", "3"],
          correctAnswer: 1,
          success: "Верно! Две ягодки остались в кармашке, а первая тропинка ведёт вниз."
        },
        {
          id: "hard-compass-ticket",
          row: 5,
          column: 5,
          kind: "ticket",
          title: "Билетик с компасом",
          icon: "✦",
          prompt: "Стрелка маленького компаса не любит кусты и показывает к свободной тропинке внизу.",
          buttonLabel: "Запомнить подсказку",
          success: "Компас тихо звякнул: путь открыт."
        },
        {
          id: "hard-leaf-puzzle",
          row: 3,
          column: 3,
          kind: "puzzle",
          title: "Листик на развилке",
          icon: "❧",
          prompt: "На листике три точки. Если добавить ещё одну, сколько точек станет?",
          answers: ["3", "4", "5"],
          correctAnswer: 1,
          success: "Верно! Листик повернулся к тропинке наверх."
        }
      ],
      map: ["###########", "#S#.......#", "#.#.#####.#", "#.#.....#.#", "#.#####.#.#", "#.....#.#.#", "#####.#.#.#", "#.......#G#", "###########"]
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
      prize: null,
      discovered: revealNearby(level, position),
      seenEncounters: [],
      pendingEncounter: entryEncounter?.id || null,
      message: entryEncounter ? "У входа ждёт маленькая находка." : "Выбери первую тропинку."
    };
  }

  function completeEncounter(state, encounterId) {
    if (!encounterId || state.pendingEncounter !== encounterId) return state;
    return {
      ...state,
      pendingEncounter: null,
      seenEncounters: [...state.seenEncounters, encounterId],
      message: "Подсказка получена. Можно идти дальше."
    };
  }

  function move(state, direction) {
    const step = STEPS[direction];
    if (!step || state.completed) return { ...state, moved: false };
    if (state.pendingEncounter) {
      return { ...state, moved: false, message: "Сначала посмотри на находку у тропинки." };
    }

    const level = getLevel(state.levelId);
    const position = { row: state.position.row + step.row, column: state.position.column + step.column };
    const tile = level.map[position.row]?.[position.column];

    if (!tile || tile === "#") {
      return { ...state, moved: false, message: "Там густые кусты. Попробуй другую тропинку." };
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
      prize: completed ? level.prize : null,
      discovered: revealNearby(level, position, state.discovered),
      pendingEncounter,
      message: completed ? "Находка найдена!" : pendingEncounter ? "На тропинке ждёт маленькая подсказка." : "Тропинка ведёт дальше."
    };
  }

  return { LEVELS, completeEncounter, createState, getEncounter, getEncounterAt, getLevel, move, positionKey };
});
