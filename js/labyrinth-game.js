(function (window, document) {
  "use strict";

  const engine = window.HFLabyrinthEngine;
  const app = document.querySelector("#labyrinthApp");
  if (!app || !engine) return;

  const HEROES = {
    hedgehog: {
      title: "Ёжик",
      className: "hedgehog",
      portrait: "assets/create/create-hedgehog.png",
      description: "Добрый и внимательный. Замечает самые тихие тропинки."
    },
    fox: {
      title: "Лисёнок",
      className: "fox",
      portrait: "assets/game/fox-catcher.webp",
      description: "Смелый и любопытный. Любит идти навстречу открытиям."
    }
  };
  const SWIPE_MIN_DISTANCE = 24;
  const DIRECTION_BY_KEY = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", W: "up", a: "left", A: "left", s: "down", S: "down", d: "right", D: "right",
    ц: "up", ф: "left", ы: "down", в: "right"
  };
  const state = {
    phase: "hero",
    hero: "hedgehog",
    levelId: "easy",
    game: null,
    completed: readProgress(),
    encounterError: "",
    pauseOpen: false,
    modalReturnFocus: ".labyrinth-tile.is-hero",
    pointerStart: null,
    ignoreBoardClickUntil: 0,
    startedAt: 0,
    endedAt: 0,
    stars: 0,
    mapAssetFailed: false
  };

  function readProgress() {
    try {
      const stored = JSON.parse(window.localStorage.getItem("hedgehogFoxLabyrinthProgress") || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch (error) {
      return [];
    }
  }

  function saveProgress() {
    try {
      window.localStorage.setItem("hedgehogFoxLabyrinthProgress", JSON.stringify(state.completed));
    } catch (error) {
      // Играть можно и без сохранения прогресса.
    }
  }

  function currentLevel() { return engine.getLevel(state.levelId); }
  function hero() { return HEROES[state.hero]; }
  function companion() { return HEROES[state.hero === "hedgehog" ? "fox" : "hedgehog"]; }
  function activeEncounter() {
    return state.game?.pendingEncounter ? engine.getEncounter(state.levelId, state.game.pendingEncounter) : null;
  }

  function startPosition(level) {
    for (let row = 0; row < level.map.length; row += 1) {
      const column = level.map[row].indexOf("S");
      if (column !== -1) return { row, column };
    }
    return { row: 0, column: 0 };
  }

  function gridPoint(level, row, column) {
    const { left, top, right, bottom } = level.gridBounds;
    const columns = level.map[0].length - 1;
    const rows = level.map.length - 1;
    return {
      x: Number((left + (column / columns) * (right - left)).toFixed(3)),
      y: Number((top + (row / rows) * (bottom - top)).toFixed(3))
    };
  }

  function gridStyle(point) {
    return `--grid-x:${point.x};--grid-y:${point.y}`;
  }

  function isTrailTile(level, row, column) {
    const tile = level.map[row]?.[column];
    return Boolean(tile && tile !== "#");
  }

  function getRouteEdges(level) {
    const edges = [];
    for (let row = 0; row < level.map.length; row += 1) {
      for (let column = 0; column < level.map[row].length; column += 1) {
        if (!isTrailTile(level, row, column)) continue;
        for (const [nextRow, nextColumn] of [[row, column + 1], [row + 1, column]]) {
          if (!isTrailTile(level, nextRow, nextColumn)) continue;
          edges.push({
            id: `${row}:${column}->${nextRow}:${nextColumn}`,
            from: gridPoint(level, row, column),
            to: gridPoint(level, nextRow, nextColumn)
          });
        }
      }
    }
    return edges;
  }

  function routeThickness(level) {
    const horizontal = Math.abs(gridPoint(level, 0, 1).x - gridPoint(level, 0, 0).x);
    const vertical = Math.abs(gridPoint(level, 1, 0).y - gridPoint(level, 0, 0).y);
    return {
      x: Number((horizontal * 0.78).toFixed(3)),
      y: Number((vertical * 0.78).toFixed(3))
    };
  }

  function routeRectangle(edge, widthX, widthY) {
    const horizontal = edge.from.y === edge.to.y;
    if (horizontal) {
      return {
        x: Math.min(edge.from.x, edge.to.x) - widthX / 2,
        y: edge.from.y - widthY / 2,
        width: Math.abs(edge.to.x - edge.from.x) + widthX,
        height: widthY
      };
    }
    return {
      x: edge.from.x - widthX / 2,
      y: Math.min(edge.from.y, edge.to.y) - widthY / 2,
      width: widthX,
      height: Math.abs(edge.to.y - edge.from.y) + widthY
    };
  }

  function renderRouteRectangles(edges, width, className, withData = false) {
    return edges.map((edge) => {
      const box = routeRectangle(edge, width.x, width.y);
      const data = withData ? ` data-route-edge="${edge.id}"` : "";
      return `<rect class="${className}"${data} x="${box.x.toFixed(3)}" y="${box.y.toFixed(3)}" width="${box.width.toFixed(3)}" height="${box.height.toFixed(3)}" />`;
    }).join("");
  }

  function renderMapRoute(level) {
    const edges = getRouteEdges(level);
    const road = routeThickness(level);
    const border = { x: road.x + 1.5, y: road.y + 1.5 };
    const highlight = { x: Math.max(road.x - 1.3, 1), y: Math.max(road.y - 1.3, 1) };
    return `
      <svg class="labyrinth-route-art" data-route-grid="${level.id}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <g class="labyrinth-route-art__shadow">${renderRouteRectangles(edges, border, "labyrinth-route-art__shadow-segment")}</g>
        <g class="labyrinth-route-art__sand">${renderRouteRectangles(edges, road, "labyrinth-route-art__sand-segment", true)}</g>
        <g class="labyrinth-route-art__highlight">${renderRouteRectangles(edges, highlight, "labyrinth-route-art__highlight-segment")}</g>
      </svg>`;
  }

  function isBesideGoal(level, row, column) {
    return [
      level.map[row - 1]?.[column],
      level.map[row + 1]?.[column],
      level.map[row]?.[column - 1],
      level.map[row]?.[column + 1]
    ].includes("G");
  }

  function nextLevel() {
    const currentIndex = engine.LEVELS.findIndex((item) => item.id === state.levelId);
    return engine.LEVELS[(currentIndex + 1) % engine.LEVELS.length];
  }

  function elapsedText() {
    if (!state.startedAt) return "00:00";
    const seconds = Math.max(1, Math.floor(((state.endedAt || Date.now()) - state.startedAt) / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function screenAttributes() {
    const game = state.game;
    return `data-screen="${state.phase}" data-hero="${state.hero}" data-level="${state.levelId}" data-lives="${game?.lives ?? 3}" data-hint-count="${game?.seenEncounters.length ?? 0}"`;
  }

  function difficultyStars(level) {
    const filled = engine.LEVELS.findIndex((item) => item.id === level.id) + 1;
    return Array.from({ length: 3 }, (_, index) => `<span aria-hidden="true" class="${index < filled ? "is-filled" : ""}">★</span>`).join("");
  }

  function renderHeroSelection() {
    return `
      <section class="labyrinth-hero-screen" ${screenAttributes()} aria-labelledby="heroChoiceTitle">
        <p class="labyrinth-step">1. Выбор героя</p>
        <div class="labyrinth-screen-heading">
          <span aria-hidden="true">❦</span><h1 id="heroChoiceTitle">Кто отправится<br />в приключение?</h1><span aria-hidden="true">❦</span>
        </div>
        <p class="labyrinth-screen-lead">Выбери друга — он найдёт записки, билетики и сундук в конце пути.</p>
        <div class="hero-choice-grid hero-choice-grid--storybook">
          ${Object.entries(HEROES).map(([id, item]) => `
            <button class="hero-choice hero-choice--${item.className} ${state.hero === id ? "is-selected" : ""}" data-hero-choice="${id}" type="button" aria-pressed="${state.hero === id}">
              <span class="hero-choice__portrait"><img src="${item.portrait}" alt="" /></span>
              <span class="hero-choice__copy"><strong>${item.title}</strong><span>${item.description}</span></span>
              <span class="hero-choice__check" aria-hidden="true">${state.hero === id ? "✓" : ""}</span>
              <span class="sr-only">Выбрать героя: ${item.title}</span>
            </button>`).join("")}
        </div>
        <p class="labyrinth-screen-note">Сначала выбираем героя, потом — тропинку.</p>
      </section>`;
  }

  function renderLevelSelection() {
    const selected = currentLevel();
    return `
      <section class="labyrinth-level-screen" ${screenAttributes()} aria-labelledby="levelChoiceTitle">
        <div class="labyrinth-screen-topline"><button class="labyrinth-round-back" data-action="back-hero" type="button" aria-label="Вернуться к выбору героя">←</button><p class="labyrinth-step">2. Выбор уровня сложности</p></div>
        <div class="labyrinth-screen-heading"><span aria-hidden="true">❦</span><h1 id="levelChoiceTitle">Выбери уровень</h1><span aria-hidden="true">❦</span></div>
        <p class="labyrinth-screen-lead"><strong>${hero().title}</strong> готов к путешествию. У каждой карты — свой путь и свои маленькие открытия.</p>
        <div class="level-choice-grid level-choice-grid--storybook">
          ${engine.LEVELS.map((level) => `
            <button class="level-choice ${state.levelId === level.id ? "is-selected" : ""}" data-level-choice="${level.id}" type="button" aria-pressed="${state.levelId === level.id}">
              <span class="level-choice__art"><img src="${level.art}" alt="" /></span>
              <span class="level-choice__copy"><strong>${level.displayTitle}</strong><small>${level.age}</small><span class="level-choice__stars" aria-label="${level.difficulty} уровень">${difficultyStars(level)}</span><em>${level.summary}</em></span>
              ${state.completed.includes(level.id) ? '<span class="level-choice__done">Пройден</span>' : ""}
            </button>`).join("")}
        </div>
        <div class="labyrinth-level-ready"><span class="hero-token hero-token--${hero().className}" aria-hidden="true"><img src="${hero().portrait}" alt="" /></span><p><strong>${selected.displayTitle}</strong><br /><span>${selected.difficulty} уровень · ${selected.age}</span></p><button class="labyrinth-primary" data-action="start" type="button">Начать путь</button></div>
      </section>`;
  }

  function tileLabel(tile, row, column, isDiscovered, isGoalVisible) {
    if (state.game.position.row === row && state.game.position.column === column) return `${hero().title} находится здесь`;
    if (!isDiscovered) return "Туманная часть карты";
    if (tile === "#") return "Густые кусты и камни";
    if (tile === "G" && isGoalVisible) return `Сундук: ${currentLevel().prize.title}`;
    if (tile === "G") return "Конец тропинки пока скрыт туманом";
    return "Открытая тропинка";
  }

  function renderFog(level, game) {
    return level.map.map((line, row) => [...line].map((tile, column) => {
      const point = gridPoint(level, row, column);
      const keepsTreasureHidden = tile === "G" && !game.completed;
      if (tile === "#" || (game.discovered.includes(`${row}:${column}`) && !keepsTreasureHidden)) return "";
      return `<span class="labyrinth-fog-cell" aria-hidden="true" style="${gridStyle(point)}"></span>`;
    }).join("")).join("");
  }

  function renderFootprints(level, game) {
    return level.map.map((line, row) => [...line].map((tile, column) => {
      const isHero = game.position.row === row && game.position.column === column;
      const point = gridPoint(level, row, column);
      if (tile === "#" || isHero || !game.discovered.includes(`${row}:${column}`)) return "";
      return `<span class="labyrinth-trail-footprint" aria-hidden="true" style="${gridStyle(point)}">•</span>`;
    }).join("")).join("");
  }

  function renderBoard(level, game) {
    return level.map.map((line, row) => [...line].map((tile, column) => {
      const point = gridPoint(level, row, column);
      if (tile === "#") return "";
      const isHero = game.position.row === row && game.position.column === column;
      const isDiscovered = game.discovered.includes(`${row}:${column}`);
      const isGoalVisible = tile === "G" && game.completed;
      const isFogged = !isDiscovered;
      const isGoalVeiled = tile === "G" && !game.completed;
      const isYieldingTap = isHero && !game.completed && isBesideGoal(level, row, column);
      const classes = ["labyrinth-tile", isHero ? "is-hero" : "", isFogged ? "is-fogged" : "is-discovered", isGoalVeiled ? "is-goal-veiled" : "", isYieldingTap ? "is-yielding-tap" : "", isGoalVisible ? "is-goal" : ""].filter(Boolean).join(" ");
      const marker = isHero
        ? `<img class="labyrinth-board-hero hero-token--${hero().className}" src="${hero().portrait}" alt="" />`
        : isGoalVisible ? `<span class="goal-token" aria-hidden="true">✦</span>` : "";
      return `<span class="${classes}" data-row="${row}" data-column="${column}" data-grid-x="${point.x}" data-grid-y="${point.y}" data-fogged="${String(isFogged || isGoalVeiled)}" data-current="${String(isHero)}" style="${gridStyle(point)}" tabindex="${isHero ? "0" : "-1"}" role="${isHero ? "img" : "presentation"}"${isHero ? ` aria-label="${tileLabel(tile, row, column, isDiscovered, isGoalVisible)}"` : " aria-hidden=\"true\""}>${marker}</span>`;
    }).join("")).join("");
  }

  function renderHearts(game) {
    return Array.from({ length: game.maxLives }, (_, index) => `<span class="labyrinth-heart ${index < game.lives ? "is-full" : "is-empty"}" aria-hidden="true">♥</span>`).join("");
  }

  function renderEncounter(encounter) {
    const isPuzzle = encounter.kind === "puzzle";
    return `
      <div class="labyrinth-encounter-backdrop">
        <section class="labyrinth-encounter" role="dialog" aria-modal="true" aria-labelledby="labyrinthEncounterTitle" aria-describedby="labyrinthEncounterPrompt">
          <div class="labyrinth-encounter__topline"><span>ПОДСКАЗКА НА ТРОПИНКЕ</span><span aria-hidden="true">${encounter.icon}</span></div>
          <div class="labyrinth-encounter__icon" aria-hidden="true">${encounter.icon}</div>
          <h2 id="labyrinthEncounterTitle">${encounter.title}</h2>
          <p id="labyrinthEncounterPrompt">${encounter.prompt}</p>
          ${isPuzzle ? `<div class="labyrinth-answer-grid" aria-label="Варианты ответа">${encounter.answers.map((answer, index) => `<button class="labyrinth-answer" data-answer="${index}" type="button">${answer}</button>`).join("")}</div>` : `<button class="labyrinth-primary labyrinth-encounter__continue" data-encounter-continue type="button">${encounter.buttonLabel}</button>`}
          ${state.encounterError ? `<p class="labyrinth-encounter__feedback" role="status">${state.encounterError}</p>` : ""}
        </section>
      </div>`;
  }

  function renderPauseDialog() {
    return `
      <div class="labyrinth-encounter-backdrop">
        <section class="labyrinth-encounter labyrinth-pause-dialog" role="dialog" aria-modal="true" aria-labelledby="labyrinthPauseTitle">
          <div class="labyrinth-encounter__topline"><span>ПАУЗА</span><span aria-hidden="true">❦</span></div>
          <h2 id="labyrinthPauseTitle">Как управлять героем?</h2>
          <div class="labyrinth-control-guide"><p><strong>Клавиатура</strong><br />Стрелки или W, A, S, D.</p><p><strong>Кнопки</strong><br />Нажимай круглые стрелки под картой.</p><p><strong>Телефон</strong><br />Проведи пальцем по карте в нужную сторону.</p></div>
          <button class="labyrinth-primary" data-action="close-pause" type="button">Продолжить путь</button>
        </section>
      </div>`;
  }

  function renderTreasureDialog(level) {
    return `
      <div class="labyrinth-encounter-backdrop">
        <section class="labyrinth-encounter labyrinth-treasure-dialog" role="dialog" aria-modal="true" aria-labelledby="labyrinthTreasureTitle">
          <div class="labyrinth-encounter__topline"><span>НАГРАДА В СУНДУКЕ</span><span aria-hidden="true">✦</span></div>
          <div class="labyrinth-encounter__icon" aria-hidden="true">${level.prize.icon}</div>
          <h2 id="labyrinthTreasureTitle">${level.prize.title}</h2>
          <p>${level.prize.description}</p>
          <button class="labyrinth-primary" data-action="treasure-next" type="button">Дальше</button>
        </section>
      </div>`;
  }

  function renderPlayfield() {
    const level = currentLevel();
    const game = state.game;
    const encounter = activeEncounter();
    const modal = state.phase === "treasure" ? renderTreasureDialog(level) : state.pauseOpen ? renderPauseDialog() : encounter ? renderEncounter(encounter) : "";
    const start = startPosition(level);
    const startPoint = gridPoint(level, start.row, start.column);
    const isModalOpen = Boolean(modal);
    return `
      <section class="labyrinth-playfield" ${screenAttributes()} aria-labelledby="gameTitle" ${isModalOpen ? "inert" : ""}>
        <header class="labyrinth-game-hud">
          <div class="labyrinth-hud-hero"><img src="${hero().portrait}" alt="" /><span>${hero().title}</span></div>
          <div class="labyrinth-heart-counter" data-lives="${game.lives}" aria-label="Сердца: ${game.lives} из ${game.maxLives}"><span class="sr-only">Сердца: ${game.lives} из ${game.maxLives}</span>${renderHearts(game)}</div>
          <output class="labyrinth-hints-counter" data-hint-count="${game.seenEncounters.length}" aria-label="Подсказки: ${game.seenEncounters.length} из ${level.encounters.length}"><span aria-hidden="true">✦</span><strong>${game.seenEncounters.length}/${level.encounters.length}</strong></output>
          <button class="labyrinth-pause-button" data-action="pause" type="button" aria-label="Пауза">Ⅱ</button>
        </header>
        <div class="labyrinth-map-summary">
          <div class="labyrinth-map-heading"><button class="labyrinth-text-button" data-action="back-level" type="button">← К уровням</button><div><p class="labyrinth-step">КАРТА ПУТЕШЕСТВИЯ</p><h1 id="gameTitle">${level.displayTitle}</h1></div><p class="labyrinth-move-counter">Шаги <strong data-move-count>${game.moves}</strong></p></div>
          <p id="labyrinthStatus" class="labyrinth-status" aria-live="polite">${game.message}</p>
        </div>
        <div class="labyrinth-map-frame labyrinth-storybook-map" style="--maze-columns:${level.map[0].length};--maze-rows:${level.map.length}">
          <img class="labyrinth-map-art" data-map-art src="${level.art}" alt="" aria-hidden="true" />
          ${renderMapRoute(level)}
          <div id="labyrinthBoard" class="labyrinth-board labyrinth-board--storybook" data-art="${level.art}" aria-label="Лабиринт. ${game.message}" aria-describedby="labyrinthStatus">
            ${startPoint ? `<span class="labyrinth-start-sign" aria-hidden="true" style="${gridStyle(startPoint)}">Старт</span>` : ""}
            ${renderFootprints(level, game)}
            ${renderBoard(level, game)}
            ${renderFog(level, game)}
          </div>
        </div>
        <div class="labyrinth-map-footer">
          <div class="labyrinth-map-help"><span aria-hidden="true">☝</span><p>Веди героя к цели — туман будет постепенно открываться.</p></div>
          <div class="labyrinth-controls" aria-label="Управление лабиринтом"><span></span><button data-move="up" type="button" aria-label="Идти вверх">↑</button><span></span><button data-move="left" type="button" aria-label="Идти влево">←</button><button data-move="down" type="button" aria-label="Идти вниз">↓</button><button data-move="right" type="button" aria-label="Идти вправо">→</button></div>
        </div>
      </section>
      ${modal}`;
  }

  function renderCompletion() {
    const level = currentLevel();
    const game = state.game;
    const next = nextLevel();
    return `
      <section class="labyrinth-complete" ${screenAttributes()} aria-labelledby="completeTitle">
        <div class="labyrinth-complete__friends" aria-hidden="true"><img src="${hero().portrait}" alt="" /><span class="labyrinth-complete__stars" data-stars="${state.stars}">${Array.from({ length: 3 }, (_, index) => `<i class="${index < state.stars ? "is-earned" : ""}">★</i>`).join("")}</span><img src="${companion().portrait}" alt="" /></div>
        <p class="labyrinth-step">ПУТЕШЕСТВИЕ ЗАВЕРШЕНО</p>
        <h1 id="completeTitle">Уровень пройден!</h1>
        <p class="labyrinth-complete__lead">${hero().title} дошёл до сундука и нашёл награду, а подсказки помогли не свернуть с тропинки.</p>
        <dl class="labyrinth-complete__stats"><div><dt>Время</dt><dd>${elapsedText()}</dd></div><div><dt>Шагов</dt><dd>${game.moves}</dd></div><div><dt>Награда</dt><dd data-complete-prize>${level.prize.title}</dd></div></dl>
        <div class="labyrinth-complete__actions"><button class="labyrinth-secondary" data-action="choose-level" type="button">Выбрать уровень</button><button class="labyrinth-primary" data-action="next-level" type="button">${next.displayTitle}</button></div>
      </section>`;
  }

  function renderMapLoadFailure() {
    return `
      <section class="labyrinth-map-load-failure" ${screenAttributes()} aria-labelledby="mapLoadFailureTitle">
        <div class="labyrinth-map-load-failure__card">
          <p class="labyrinth-step">КАРТА ПУТЕШЕСТВИЯ</p>
          <h1 id="mapLoadFailureTitle">Не удалось открыть карту</h1>
          <p>Вернись к уровням и выбери путешествие ещё раз.</p>
          <button class="labyrinth-secondary" data-action="back-level" type="button">К уровням</button>
        </div>
      </section>`;
  }

  function activeDialog() {
    return app.querySelector('[role="dialog"][aria-modal="true"]');
  }

  function focusAfterRender(focusSelector) {
    const dialog = activeDialog();
    const scope = dialog || app;
    const preferred = focusSelector ? scope.querySelector(focusSelector) : null;
    const fallback = dialog ? scope.querySelector("button:not([disabled])") : scope.querySelector(".labyrinth-tile.is-hero, [data-action='start'], [data-hero-choice], [data-level-choice]");
    (preferred || fallback)?.focus({ preventScroll: true });
  }

  function render(focusSelector) {
    if (state.mapAssetFailed) app.innerHTML = renderMapLoadFailure();
    else if (state.phase === "hero") app.innerHTML = renderHeroSelection();
    else if (state.phase === "level") app.innerHTML = renderLevelSelection();
    else if (state.phase === "complete") app.innerHTML = renderCompletion();
    else app.innerHTML = renderPlayfield();
    focusAfterRender(focusSelector);
  }

  function start() {
    state.game = engine.createState(state.levelId, state.hero);
    state.phase = "play";
    state.encounterError = "";
    state.pauseOpen = false;
    state.modalReturnFocus = ".labyrinth-tile.is-hero";
    state.startedAt = Date.now();
    state.endedAt = 0;
    state.stars = 0;
    state.mapAssetFailed = false;
    render();
  }

  function focusSelectorForActiveElement() {
    const active = document.activeElement;
    if (active?.dataset?.move) return `[data-move="${active.dataset.move}"]`;
    if (active?.dataset?.row) return `[data-row="${active.dataset.row}"][data-column="${active.dataset.column}"]`;
    return ".labyrinth-tile.is-hero";
  }

  function move(direction, focusSelector = focusSelectorForActiveElement()) {
    if (state.phase !== "play" || !state.game || activeEncounter() || state.pauseOpen) return;
    state.game = engine.move(state.game, direction);
    if (state.game.pendingEncounter) state.modalReturnFocus = focusSelector;
    if (state.game.completed) {
      state.phase = "treasure";
      state.endedAt = Date.now();
    }
    render(focusSelector);
  }

  function moveTo(row, column) {
    if (state.phase !== "play" || !state.game || activeEncounter() || state.pauseOpen) return;
    const focusSelector = `[data-row="${row}"][data-column="${column}"]`;
    const distance = Math.abs(state.game.position.row - row) + Math.abs(state.game.position.column - column);
    if (distance !== 1) {
      state.game = { ...state.game, message: "Идти можно только по соседней клетке." };
      render(focusSelector);
      return;
    }
    if (row < state.game.position.row) move("up", focusSelector);
    else if (row > state.game.position.row) move("down", focusSelector);
    else if (column < state.game.position.column) move("left", focusSelector);
    else move("right", focusSelector);
  }

  function completeEncounter(answerIndex) {
    const encounter = activeEncounter();
    if (!encounter) return;
    if (encounter.kind === "puzzle" && Number(answerIndex) !== encounter.correctAnswer) {
      state.game = engine.registerMistake(state.game, "Почти! Подумай не торопясь и попробуй ещё раз.");
      state.encounterError = "Ничего страшного: одно сердечко отдохнёт, а ответ можно попробовать снова.";
      render(`[data-answer="${answerIndex}"]`);
      return;
    }
    state.game = engine.completeEncounter(state.game, encounter.id);
    state.game = { ...state.game, message: encounter.success };
    state.encounterError = "";
    const focusSelector = state.modalReturnFocus;
    state.modalReturnFocus = ".labyrinth-tile.is-hero";
    render(focusSelector);
  }

  function finishTreasure() {
    if (state.phase !== "treasure" || !state.game) return;
    if (!state.completed.includes(state.levelId)) {
      state.completed = [...state.completed, state.levelId];
      saveProgress();
    }
    state.stars = Math.max(1, state.game.lives);
    state.phase = "complete";
    render("[data-action='next-level']");
  }

  function directionFromSwipe(deltaX, deltaY) {
    if (Math.abs(deltaX) >= Math.abs(deltaY)) return deltaX > 0 ? "right" : "left";
    return deltaY > 0 ? "down" : "up";
  }

  function canUseMapGesture(event) {
    return Boolean(state.phase === "play" && state.game && !state.pauseOpen && !activeEncounter() && event.target.closest("#labyrinthBoard"));
  }

  function gridCellFromPointer(board, clientX, clientY) {
    const level = currentLevel();
    const bounds = board.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    const x = ((clientX - bounds.left) / bounds.width) * 100;
    const y = ((clientY - bounds.top) / bounds.height) * 100;
    const columns = level.map[0].length - 1;
    const rows = level.map.length - 1;
    const column = Math.round(((x - level.gridBounds.left) / (level.gridBounds.right - level.gridBounds.left)) * columns);
    const row = Math.round(((y - level.gridBounds.top) / (level.gridBounds.bottom - level.gridBounds.top)) * rows);
    if (!Number.isInteger(row) || !Number.isInteger(column) || !isTrailTile(level, row, column)) return null;
    return { row, column };
  }

  app.addEventListener("error", (event) => {
    if (!event.target?.matches?.("[data-map-art]")) return;
    state.mapAssetFailed = true;
    state.phase = "map-error";
    state.pauseOpen = false;
    state.encounterError = "";
    render("[data-action='back-level']");
  }, true);

  app.addEventListener("pointerdown", (event) => {
    if (!canUseMapGesture(event)) return;
    state.pointerStart = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY };
    event.target.setPointerCapture?.(event.pointerId);
  });

  app.addEventListener("pointerup", (event) => {
    const pointerStart = state.pointerStart;
    state.pointerStart = null;
    if (!pointerStart || pointerStart.pointerId !== event.pointerId || state.phase !== "play" || !state.game || state.pauseOpen || activeEncounter()) return;
    const deltaX = event.clientX - pointerStart.clientX;
    const deltaY = event.clientY - pointerStart.clientY;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_MIN_DISTANCE) return;
    event.preventDefault();
    state.ignoreBoardClickUntil = Date.now() + 450;
    move(directionFromSwipe(deltaX, deltaY), ".labyrinth-tile.is-hero");
  });

  app.addEventListener("pointercancel", () => { state.pointerStart = null; });

  app.addEventListener("click", (event) => {
    if (Date.now() < state.ignoreBoardClickUntil && event.target.closest("#labyrinthBoard")) {
      event.preventDefault();
      return;
    }

    const action = event.target.closest("[data-action]")?.dataset.action;
    if (state.phase === "map-error" && action === "back-level") {
      state.game = null;
      state.encounterError = "";
      state.mapAssetFailed = false;
      state.phase = "level";
      render(`[data-level-choice="${state.levelId}"]`);
      return;
    }

    const encounter = activeEncounter();
    const answer = event.target.closest("[data-answer]");
    if (encounter) {
      if (answer) completeEncounter(answer.dataset.answer);
      else if (event.target.closest("[data-encounter-continue]")) completeEncounter();
      return;
    }

    if (state.phase === "treasure") {
      if (action === "treasure-next") finishTreasure();
      return;
    }
    if (state.pauseOpen) {
      if (action === "close-pause") {
        state.pauseOpen = false;
        const focusSelector = state.modalReturnFocus;
        state.modalReturnFocus = ".labyrinth-tile.is-hero";
        render(focusSelector);
      }
      return;
    }

    const heroButton = event.target.closest("[data-hero-choice]");
    if (state.phase === "hero" && heroButton) {
      state.hero = heroButton.dataset.heroChoice;
      state.phase = "level";
      render(`[data-level-choice="${state.levelId}"]`);
      return;
    }
    const levelButton = event.target.closest("[data-level-choice]");
    if (state.phase === "level" && levelButton) {
      state.levelId = levelButton.dataset.levelChoice;
      render(`[data-level-choice="${state.levelId}"]`);
      return;
    }

    if (action === "back-hero") {
      state.phase = "hero";
      render(`[data-hero-choice="${state.hero}"]`);
      return;
    }
    if (action === "start" && state.phase === "level") { start(); return; }
    if (action === "back-level" && state.phase === "play") {
      state.game = null;
      state.encounterError = "";
      state.mapAssetFailed = false;
      state.phase = "level";
      render(`[data-level-choice="${state.levelId}"]`);
      return;
    }
    if (action === "pause" && state.phase === "play" && state.game) {
      state.pauseOpen = true;
      state.modalReturnFocus = focusSelectorForActiveElement();
      render();
      return;
    }
    if (action === "choose-level" && state.phase === "complete") {
      state.game = null;
      state.phase = "level";
      render(`[data-level-choice="${state.levelId}"]`);
      return;
    }
    if (action === "next-level" && state.phase === "complete") {
      state.levelId = nextLevel().id;
      state.game = null;
      state.phase = "level";
      render(`[data-level-choice="${state.levelId}"]`);
      return;
    }
    if (action === "again" && state.phase === "complete") { start(); return; }

    if (state.phase !== "play" || !state.game) return;
    const direction = event.target.closest("[data-move]")?.dataset.move;
    if (direction) { move(direction); return; }
    const board = event.target.closest("#labyrinthBoard");
    if (!board) return;
    const cell = gridCellFromPointer(board, event.clientX, event.clientY);
    if (cell) moveTo(cell.row, cell.column);
  });

  document.addEventListener("keydown", (event) => {
    const dialog = activeDialog();
    if (event.key === "Tab" && dialog) {
      const controls = [...dialog.querySelectorAll("button:not([disabled])")];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (first && last && (!dialog.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last))) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
    }
    if (event.key === "Escape" && state.pauseOpen) {
      state.pauseOpen = false;
      render(state.modalReturnFocus);
      return;
    }
    if (state.phase !== "play" || !state.game || state.pauseOpen || activeEncounter() || !DIRECTION_BY_KEY[event.key]) return;
    event.preventDefault();
    move(DIRECTION_BY_KEY[event.key]);
  });

  render();
})(window, document);
