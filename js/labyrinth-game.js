(function (window, document) {
  "use strict";

  const engine = window.HFLabyrinthEngine;
  const app = document.querySelector("#labyrinthApp");
  if (!app || !engine) return;

  const HEROES = {
    hedgehog: { name: "Ежика", title: "Ёжик", mark: "Ё", className: "hedgehog", description: "Добрый и внимательный. Замечает самые тихие тропинки." },
    fox: { name: "Лисёнка", title: "Лисёнок", mark: "Л", className: "fox", description: "Смелый и любопытный. Любит идти навстречу открытиям." }
  };
  const DIRECTION_BY_KEY = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", W: "up", a: "left", A: "left", s: "down", S: "down", d: "right", D: "right", ц: "up", ф: "left", ы: "down", в: "right" };
  const state = { hero: "hedgehog", levelId: "easy", game: null, completed: readProgress() };

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
  function levelIcon(level) { return level.id === "easy" ? "✉" : level.id === "medium" ? "✦" : "✧"; }

  function renderSelection() {
    const level = currentLevel();
    app.innerHTML = `
      <section class="labyrinth-intro" aria-labelledby="labyrinthTitle">
        <div class="labyrinth-intro__copy">
          <p class="labyrinth-kicker">ИГРОВАЯ ПОЛЯНКА · ИГРА 03</p>
          <h1 id="labyrinthTitle">Лабиринт<br />добрых тропинок</h1>
          <p class="labyrinth-lead">Выбери друга, а потом проведи его к маленькой находке. В этом путешествии нет спешки: можно остановиться и выбрать новую дорожку.</p>
          <div class="labyrinth-trail" aria-hidden="true"><span>●</span><i></i><span>●</span><i></i><span>●</span><i></i><span>✦</span></div>
        </div>
        <div class="labyrinth-intro__art" aria-hidden="true"><img src="assets/optimized/hero-friends-1200.avif" alt="" width="1200" height="900" /></div>
      </section>
      <section class="labyrinth-picker" aria-labelledby="heroChoiceTitle">
        <div class="labyrinth-section-heading"><p class="labyrinth-kicker">ШАГ 1 ИЗ 2</p><h2 id="heroChoiceTitle">Кого проводим по тропинке?</h2></div>
        <div class="hero-choice-grid">
          ${Object.entries(HEROES).map(([id, item]) => `<button class="hero-choice hero-choice--${item.className} ${state.hero === id ? "is-selected" : ""}" data-hero="${id}" type="button" aria-pressed="${state.hero === id}"><span class="hero-choice__portrait" aria-hidden="true">${item.mark}</span><span class="hero-choice__copy"><strong>${item.title}</strong><span>${item.description}</span></span><span class="hero-choice__check" aria-hidden="true">${state.hero === id ? "✓" : ""}</span><span class="sr-only">Выбрать ${item.name}</span></button>`).join("")}
        </div>
      </section>
      <section class="labyrinth-picker labyrinth-picker--levels" aria-labelledby="levelChoiceTitle">
        <div class="labyrinth-section-heading"><p class="labyrinth-kicker">ШАГ 2 ИЗ 2</p><h2 id="levelChoiceTitle">Какую тропинку выберем?</h2></div>
        <div class="level-choice-grid">
          ${engine.LEVELS.map((item) => `<button class="level-choice ${state.levelId === item.id ? "is-selected" : ""}" data-level="${item.id}" type="button" aria-pressed="${state.levelId === item.id}"><span class="level-choice__icon" aria-hidden="true">${levelIcon(item)}</span><span><strong>${item.label} тропинка</strong><small>${item.age} · ${item.finding}</small></span>${state.completed.includes(item.id) ? '<em>Пройдена</em>' : ""}</button>`).join("")}
        </div>
        <div class="labyrinth-ready"><p><span class="labyrinth-ready__hero hero-token hero-token--${hero().className}" aria-hidden="true">${hero().mark}</span><strong>${hero().title}</strong> идёт по тропинке «${level.label}».</p><button class="labyrinth-primary" data-action="start" type="button">Отправиться в лабиринт <span aria-hidden="true">→</span></button></div>
      </section>`;
  }

  function tileLabel(tile, row, column) {
    if (state.game.position.row === row && state.game.position.column === column) return `${hero().title} здесь`;
    if (tile === "G") return `Находка: ${currentLevel().finding}`;
    return "Тропинка";
  }

  function renderGame() {
    const level = currentLevel();
    const game = state.game;
    app.innerHTML = `
      <section class="labyrinth-game-shell" aria-labelledby="gameTitle">
        <div class="game-topline"><button class="labyrinth-text-button" data-action="choose" type="button">← Выбрать другую тропинку</button><span>${level.label} · ${level.age}</span></div>
        <div class="game-heading"><div><p class="labyrinth-kicker">${hero().title} в пути</p><h1 id="gameTitle">${level.title}</h1></div><div class="game-counter" aria-label="Количество шагов"><span>Шаги</span><strong>${game.moves}</strong></div></div>
        <p class="labyrinth-game-copy">Помоги ${hero().name} найти ${level.finding}. Нажимай стрелки, клавиши <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> или соседнюю клетку.</p>
        <p id="labyrinthStatus" class="labyrinth-status" aria-live="polite">${game.message}</p>
        <div id="labyrinthBoard" class="labyrinth-board" style="--maze-columns:${level.map[0].length}" aria-label="Лабиринт. ${game.message}">
          ${level.map.map((line, row) => [...line].map((tile, column) => {
            const isHero = game.position.row === row && game.position.column === column;
            if (tile === "#") return '<span class="labyrinth-wall" aria-hidden="true"></span>';
            return `<button class="labyrinth-tile ${isHero ? "is-hero" : ""} ${tile === "G" ? "is-goal" : ""}" data-row="${row}" data-column="${column}" type="button" aria-label="${tileLabel(tile, row, column)}">${isHero ? `<span class="hero-token hero-token--${hero().className}" aria-hidden="true">${hero().mark}</span>` : tile === "G" ? `<span class="goal-token" aria-hidden="true">${levelIcon(level)}</span>` : ""}</button>`;
          }).join("")).join("")}
        </div>
        <div class="labyrinth-controls" aria-label="Управление лабиринтом"><span></span><button data-move="up" type="button" aria-label="Идти вверх">↑</button><span></span><button data-move="left" type="button" aria-label="Идти влево">←</button><button data-move="down" type="button" aria-label="Идти вниз">↓</button><button data-move="right" type="button" aria-label="Идти вправо">→</button></div>
        <div class="labyrinth-underboard"><span aria-hidden="true">❧</span> Не торопись — в каждой тропинке можно подумать ещё раз.</div>
      </section>
      <section id="labyrinthResult" class="labyrinth-result ${game.completed ? "is-visible" : ""}" ${game.completed ? "" : "hidden"} aria-live="polite">
        <div class="labyrinth-result__mark" aria-hidden="true">${levelIcon(level)}</div><p class="labyrinth-kicker">ДОБРАЯ НАХОДКА</p><h2>Находка найдена!</h2><p>${hero().title} наш${state.hero === "fox" ? "ёл" : "ёл"} ${level.finding} и оставил${state.hero === "fox" ? "" : ""} на карте свой след.</p><p class="labyrinth-result__steps">Пройдено шагов: <strong>${game.moves}</strong></p><div><button class="labyrinth-primary" data-action="again" type="button">Пройти ещё раз</button><button class="labyrinth-secondary" data-action="choose" type="button">Другая тропинка</button></div>
      </section>`;
    if (game.completed) document.querySelector("#labyrinthResult")?.focus?.({ preventScroll: true });
  }

  function start() { state.game = engine.createState(state.levelId, state.hero); renderGame(); document.querySelector("#labyrinthBoard button")?.focus({ preventScroll: true }); }
  function move(direction) { state.game = engine.move(state.game, direction); if (state.game.completed && !state.completed.includes(state.levelId)) { state.completed.push(state.levelId); saveProgress(); } renderGame(); }
  function moveTo(row, column) {
    const distance = Math.abs(state.game.position.row - row) + Math.abs(state.game.position.column - column);
    if (distance !== 1) { state.game = { ...state.game, message: "Идти можно только по соседней клетке." }; renderGame(); return; }
    if (row < state.game.position.row) move("up"); else if (row > state.game.position.row) move("down"); else if (column < state.game.position.column) move("left"); else move("right");
  }

  app.addEventListener("click", (event) => {
    const heroButton = event.target.closest("[data-hero]"); if (heroButton) { state.hero = heroButton.dataset.hero; renderSelection(); return; }
    const levelButton = event.target.closest("[data-level]"); if (levelButton) { state.levelId = levelButton.dataset.level; renderSelection(); return; }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "start" || action === "again") { start(); return; }
    if (action === "choose") { state.game = null; renderSelection(); return; }
    const direction = event.target.closest("[data-move]")?.dataset.move; if (direction) { move(direction); return; }
    const tile = event.target.closest("[data-row]"); if (tile) moveTo(Number(tile.dataset.row), Number(tile.dataset.column));
  });

  document.addEventListener("keydown", (event) => {
    if (!state.game || state.game.completed || !DIRECTION_BY_KEY[event.key]) return;
    event.preventDefault(); move(DIRECTION_BY_KEY[event.key]);
  });

  renderSelection();
})(window, document);
