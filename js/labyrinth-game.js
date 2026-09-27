(function (window, document) {
  "use strict";

  const engine = window.HFLabyrinthEngine;
  const app = document.querySelector("#labyrinthApp");
  if (!app || !engine) return;

  const HEROES = {
    hedgehog: { name: "Ежика", title: "Ёжик", mark: "Ё", className: "hedgehog", description: "Добрый и внимательный. Замечает самые тихие тропинки." },
    fox: { name: "Лисёнка", title: "Лисёнок", mark: "Л", className: "fox", description: "Смелый и любопытный. Любит идти навстречу открытиям." }
  };
  const SWIPE_MIN_DISTANCE = 24;
  const DIRECTION_BY_KEY = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", W: "up", a: "left", A: "left", s: "down", S: "down", d: "right", D: "right", ц: "up", ф: "left", ы: "down", в: "right" };
  const state = {
    hero: "hedgehog",
    levelId: "easy",
    game: null,
    completed: readProgress(),
    encounterError: "",
    modalReturnFocus: ".labyrinth-tile.is-hero",
    pointerStart: null,
    ignoreBoardClickUntil: 0
  };

  function readProgress() {
    try {
      const value = JSON.parse(window.localStorage.getItem("hedgehogFoxLabyrinthProgress") || "[]");
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function saveProgress() {
    try { window.localStorage.setItem("hedgehogFoxLabyrinthProgress", JSON.stringify(state.completed)); } catch (error) { /* Играть можно и без сохранения. */ }
  }

  function currentLevel() { return engine.getLevel(state.levelId); }
  function hero() { return HEROES[state.hero]; }
  function levelIcon(level) { return level.prize.icon; }
  function activeEncounter() { return state.game?.pendingEncounter ? engine.getEncounter(state.levelId, state.game.pendingEncounter) : null; }

  function renderSelection() {
    const level = currentLevel();
    app.innerHTML = `
      <section class="labyrinth-intro" aria-labelledby="labyrinthTitle">
        <div class="labyrinth-intro__copy">
          <p class="labyrinth-kicker">ИГРОВАЯ ПОЛЯНКА · ИГРА 03</p>
          <h1 id="labyrinthTitle">Лабиринт<br />добрых тропинок</h1>
          <p class="labyrinth-lead">Выбери друга, а потом проведи его по карте. У входа встретятся маленькие подсказки, а настоящая находка ждёт только в конце пути.</p>
          <div class="labyrinth-trail" aria-hidden="true"><span>❧</span><i></i><span>·</span><i></i><span>·</span><i></i><span>✦</span></div>
        </div>
        <div class="labyrinth-intro__art" aria-hidden="true"><img src="assets/optimized/hero-friends-1200.avif" alt="" width="1200" height="900" /></div>
      </section>
      <section class="labyrinth-picker" aria-labelledby="heroChoiceTitle">
        <div class="labyrinth-section-heading"><p class="labyrinth-kicker">ШАГ 1 ИЗ 2</p><h2 id="heroChoiceTitle">Кого проводим по тропинке?</h2></div>
        <div class="hero-choice-grid">
          ${Object.entries(HEROES).map(([id, item]) => `<button class="hero-choice hero-choice--${item.className} ${state.hero === id ? "is-selected" : ""}" data-hero="${id}" type="button" aria-pressed="${state.hero === id}"><span class="hero-choice__portrait" aria-hidden="true"><i>${item.mark}</i></span><span class="hero-choice__copy"><strong>${item.title}</strong><span>${item.description}</span></span><span class="hero-choice__check" aria-hidden="true">${state.hero === id ? "✓" : ""}</span><span class="sr-only">Выбрать ${item.name}</span></button>`).join("")}
        </div>
      </section>
      <section class="labyrinth-picker labyrinth-picker--levels" aria-labelledby="levelChoiceTitle">
        <div class="labyrinth-section-heading"><p class="labyrinth-kicker">ШАГ 2 ИЗ 2</p><h2 id="levelChoiceTitle">Какую тропинку выберем?</h2></div>
        <div class="level-choice-grid">
          ${engine.LEVELS.map((item) => `<button class="level-choice ${state.levelId === item.id ? "is-selected" : ""}" data-level="${item.id}" type="button" aria-pressed="${state.levelId === item.id}"><span class="level-choice__icon" aria-hidden="true">${levelIcon(item)}</span><span><strong>${item.label} тропинка</strong><small>${item.age} · находка в конце пути</small></span>${state.completed.includes(item.id) ? '<em>Пройдена</em>' : ""}</button>`).join("")}
        </div>
        <div class="labyrinth-ready"><p><span class="labyrinth-ready__hero hero-token hero-token--${hero().className}" aria-hidden="true">${hero().mark}</span><strong>${hero().title}</strong> идёт по тропинке «${level.label}».</p><button class="labyrinth-primary" data-action="start" type="button">Открыть карту <span aria-hidden="true">→</span></button></div>
      </section>`;
  }

  function tileLabel(tile, row, column, isDiscovered, isGoalVisible) {
    if (state.game.position.row === row && state.game.position.column === column) return `${hero().title} здесь`;
    if (!isDiscovered) return "Туманная часть карты";
    if (tile === "#") return "Густые кусты";
    if (tile === "G" && isGoalVisible) return `Находка: ${currentLevel().prize.title}`;
    if (tile === "G") return "Конец тропинки пока скрыт";
    return "Открытая тропинка";
  }

  function renderEncounter(encounter) {
    const isPuzzle = encounter.kind === "puzzle";
    return `
      <div class="labyrinth-encounter-backdrop">
        <section class="labyrinth-encounter" role="dialog" aria-modal="true" aria-labelledby="labyrinthEncounterTitle" aria-describedby="labyrinthEncounterPrompt">
          <div class="labyrinth-encounter__topline"><span>ВСТРЕЧА НА ТРОПИНКЕ</span><span aria-hidden="true">${encounter.icon}</span></div>
          <div class="labyrinth-encounter__icon" aria-hidden="true">${encounter.icon}</div>
          <h2 id="labyrinthEncounterTitle">${encounter.title}</h2>
          <p id="labyrinthEncounterPrompt">${encounter.prompt}</p>
          ${isPuzzle ? `<div class="labyrinth-answer-grid" aria-label="Варианты ответа">${encounter.answers.map((answer, index) => `<button class="labyrinth-answer" data-answer="${index}" type="button">${answer}</button>`).join("")}</div>` : `<button class="labyrinth-primary labyrinth-encounter__continue" data-encounter-continue type="button">${encounter.buttonLabel}</button>`}
          ${state.encounterError ? `<p class="labyrinth-encounter__feedback" id="labyrinthEncounterFeedback" role="status">${state.encounterError}</p>` : ""}
        </section>
      </div>`;
  }

  function renderBoard(level, game) {
    return level.map.map((line, row) => [...line].map((tile, column) => {
      const isHero = game.position.row === row && game.position.column === column;
      const isDiscovered = game.discovered.includes(`${row}:${column}`);
      const isGoalVisible = tile === "G" && game.completed;
      const classes = ["labyrinth-tile", tile === "#" ? "labyrinth-wall" : "", isHero ? "is-hero" : "", isDiscovered ? "is-discovered" : "is-fogged", isGoalVisible ? "is-goal" : ""].filter(Boolean).join(" ");
      const marker = `${isGoalVisible ? `<span class="goal-token" aria-hidden="true">${levelIcon(level)}</span>` : ""}${isHero ? `<span class="hero-token hero-token--${hero().className}" aria-hidden="true">${hero().mark}</span>` : !isGoalVisible && isDiscovered && tile !== "#" ? '<span class="trail-footprint" aria-hidden="true">·</span>' : ""}`;
      return `<button class="${classes}" data-row="${row}" data-column="${column}" data-fogged="${String(!isDiscovered)}" data-current="${String(isHero)}" type="button" aria-label="${tileLabel(tile, row, column, isDiscovered, isGoalVisible)}">${marker}</button>`;
    }).join("")).join("");
  }

  function renderGame(focusSelector) {
    const level = currentLevel();
    const game = state.game;
    const encounter = activeEncounter();
    app.innerHTML = `
      <section class="labyrinth-game-shell" aria-labelledby="gameTitle">
        <div class="game-topline"><button class="labyrinth-text-button" data-action="choose" type="button">← Выбрать другую тропинку</button><span>${level.label} · ${level.age}</span></div>
        <div class="game-heading"><div><p class="labyrinth-kicker">КАРТА ПУТЕШЕСТВИЯ</p><h1 id="gameTitle">${level.title}</h1></div><div class="game-counter" aria-label="Количество шагов"><span>Шаги</span><strong>${game.moves}</strong></div></div>
        <p class="labyrinth-game-copy">Туман отступает там, где идёт ${hero().title}. Нажимай стрелки, клавиши <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>, соседнюю тропинку или проведи пальцем по карте.</p>
        <p id="labyrinthStatus" class="labyrinth-status" aria-live="polite">${game.message}</p>
        <div class="labyrinth-map-frame">
          <div class="labyrinth-map-caption" aria-hidden="true"><span>лесная карта</span><i>❧</i><span>тропинка открытий</span></div>
          <div id="labyrinthBoard" class="labyrinth-board" style="--maze-columns:${level.map[0].length}; --maze-rows:${level.map.length}" aria-label="Лабиринт. ${game.message}">
            ${renderBoard(level, game)}
          </div>
          <span class="labyrinth-map-compass" aria-hidden="true">✧<small>С</small></span>
        </div>
        <div class="labyrinth-controls" aria-label="Управление лабиринтом"><span></span><button data-move="up" type="button" aria-label="Идти вверх">↑</button><span></span><button data-move="left" type="button" aria-label="Идти влево">←</button><button data-move="down" type="button" aria-label="Идти вниз">↓</button><button data-move="right" type="button" aria-label="Идти вправо">→</button></div>
        <div class="labyrinth-underboard"><span aria-hidden="true">❧</span> Туман открывается постепенно. Подсказки встречаются на тропинке, а большая находка — только в конце.</div>
      </section>
      <section id="labyrinthResult" class="labyrinth-result ${game.completed ? "is-visible" : ""}" ${game.completed ? "" : "hidden"} aria-live="polite" tabindex="-1">
        <div class="labyrinth-result__mark" aria-hidden="true">${game.prize?.icon || levelIcon(level)}</div><p class="labyrinth-kicker">БОЛЬШАЯ НАХОДКА</p><h2>${game.prize?.title || "Находка найдена!"}</h2><p>${game.prize?.description || ""}</p><p class="labyrinth-result__steps">Пройдено шагов: <strong>${game.moves}</strong></p><div><button class="labyrinth-primary" data-action="again" type="button">Пройти ещё раз</button><button class="labyrinth-secondary" data-action="choose" type="button">Другая тропинка</button></div>
      </section>
      ${encounter ? renderEncounter(encounter) : ""}`;

    if (game.completed) {
      app.querySelector("#labyrinthResult")?.focus({ preventScroll: true });
      return;
    }
    if (encounter) {
      const modalFocus = focusSelector?.includes("data-answer") || focusSelector?.includes("data-encounter-continue") ? focusSelector : "[data-answer], [data-encounter-continue]";
      app.querySelector(modalFocus)?.focus({ preventScroll: true });
      return;
    }
    app.querySelector(focusSelector || ".labyrinth-tile.is-hero")?.focus({ preventScroll: true });
  }

  function start() {
    state.game = engine.createState(state.levelId, state.hero);
    state.encounterError = "";
    state.modalReturnFocus = ".labyrinth-tile.is-hero";
    renderGame();
  }

  function focusSelectorForActiveElement() {
    const active = document.activeElement;
    if (active?.dataset?.move) return `[data-move="${active.dataset.move}"]`;
    if (active?.dataset?.row) return `[data-row="${active.dataset.row}"][data-column="${active.dataset.column}"]`;
    return ".labyrinth-tile.is-hero";
  }

  function move(direction, focusSelector = focusSelectorForActiveElement()) {
    state.game = engine.move(state.game, direction);
    if (state.game.pendingEncounter) state.modalReturnFocus = focusSelector;
    if (state.game.completed && !state.completed.includes(state.levelId)) {
      state.completed.push(state.levelId);
      saveProgress();
    }
    renderGame(focusSelector);
  }

  function moveTo(row, column) {
    const distance = Math.abs(state.game.position.row - row) + Math.abs(state.game.position.column - column);
    const focusSelector = `[data-row="${row}"][data-column="${column}"]`;
    if (distance !== 1) {
      state.game = { ...state.game, message: "Идти можно только по соседней клетке." };
      renderGame(focusSelector);
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
      state.encounterError = "Почти! Подумай не торопясь и попробуй ещё раз.";
      renderGame(`[data-answer="${answerIndex}"]`);
      return;
    }
    state.game = engine.completeEncounter(state.game, encounter.id);
    state.game = { ...state.game, message: encounter.success };
    state.encounterError = "";
    const focusSelector = state.modalReturnFocus;
    state.modalReturnFocus = ".labyrinth-tile.is-hero";
    renderGame(focusSelector);
  }

  function directionFromSwipe(deltaX, deltaY) {
    if (Math.abs(deltaX) >= Math.abs(deltaY)) return deltaX > 0 ? "right" : "left";
    return deltaY > 0 ? "down" : "up";
  }

  function canUseMapGesture(event) {
    return Boolean(event.target.closest("#labyrinthBoard") && state.game && !state.game.completed && !state.game.pendingEncounter);
  }

  app.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || !canUseMapGesture(event)) return;
    state.pointerStart = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY };
    event.target.setPointerCapture?.(event.pointerId);
  });

  app.addEventListener("pointerup", (event) => {
    const pointerStart = state.pointerStart;
    state.pointerStart = null;
    if (!pointerStart || pointerStart.pointerId !== event.pointerId || !state.game || state.game.completed || state.game.pendingEncounter) return;
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
    const answer = event.target.closest("[data-answer]");
    if (answer) { completeEncounter(answer.dataset.answer); return; }
    if (event.target.closest("[data-encounter-continue]")) { completeEncounter(); return; }

    const heroButton = event.target.closest("[data-hero]");
    if (heroButton) { state.hero = heroButton.dataset.hero; renderSelection(); return; }
    const levelButton = event.target.closest("[data-level]");
    if (levelButton) { state.levelId = levelButton.dataset.level; renderSelection(); return; }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "start" || action === "again") { start(); return; }
    if (action === "choose") { state.game = null; state.encounterError = ""; renderSelection(); return; }
    if (!state.game || state.game.pendingEncounter) return;
    const direction = event.target.closest("[data-move]")?.dataset.move;
    if (direction) { move(direction); return; }
    const tile = event.target.closest("[data-row]");
    if (tile) moveTo(Number(tile.dataset.row), Number(tile.dataset.column));
  });

  document.addEventListener("keydown", (event) => {
    if (!state.game || state.game.completed || !DIRECTION_BY_KEY[event.key]) return;
    event.preventDefault();
    move(DIRECTION_BY_KEY[event.key]);
  });

  renderSelection();
})(window, document);
