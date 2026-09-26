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
      map: ["#######", "#S...G#", "#####.#", "#.....#", "#######"]
    },
    {
      id: "medium",
      title: "Дорога к маяку",
      label: "Смелая",
      age: "7–8 лет",
      finding: "маленький огонёк маяка",
      map: ["#########", "#S#....G#", "#.#.#####", "#.#.....#", "#.#####.#", "#.......#", "#########"]
    },
    {
      id: "hard",
      title: "Карта тёплого ветра",
      label: "Большое путешествие",
      age: "9–10 лет",
      finding: "карту тёплого ветра",
      map: ["###########", "#S#.......#", "#.#.#####.#", "#.#.....#.#", "#.#####.#.#", "#.....#.#.#", "#####.#.#.#", "#.......#G#", "###########"]
    }
  ];

  const STEPS = {
    up: { row: -1, column: 0 },
    down: { row: 1, column: 0 },
    left: { row: 0, column: -1 },
    right: { row: 0, column: 1 }
  };

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

  function createState(levelId, hero) {
    const level = getLevel(levelId);
    return {
      levelId,
      hero: hero === "fox" ? "fox" : "hedgehog",
      position: findMarker(level.map, "S"),
      goal: findMarker(level.map, "G"),
      moves: 0,
      moved: false,
      completed: false,
      message: "Выбери первую тропинку."
    };
  }

  function move(state, direction) {
    const step = STEPS[direction];
    if (!step || state.completed) return { ...state, moved: false };

    const level = getLevel(state.levelId);
    const position = { row: state.position.row + step.row, column: state.position.column + step.column };
    const tile = level.map[position.row]?.[position.column];

    if (!tile || tile === "#") {
      return { ...state, moved: false, message: "Там густые кусты. Попробуй другую тропинку." };
    }

    const completed = tile === "G";
    return {
      ...state,
      position,
      moves: state.moves + 1,
      moved: true,
      completed,
      message: completed ? "Находка найдена!" : "Тропинка ведёт дальше."
    };
  }

  return { LEVELS, createState, getLevel, move };
});
