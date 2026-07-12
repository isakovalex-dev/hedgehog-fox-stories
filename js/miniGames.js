(function (window, document) {
  "use strict";
  const data = window.HFMiniGamesData;
  const storage = window.HFStorageService;
  const analytics = window.HFAnalyticsService;
  const KEY = "hedgehogFoxMiniGameCollection";
  const STORY_KEY = "hedgehogFoxMiniGameStories";
  const el = (id) => document.getElementById(id);
  const root = el("generationExperience");
  if (!root || !data) return;

  const state = { game: null, phase: "intro", age: "7-8", storyId: null, ready: false, finishRequested: false, previousFocus: null, cloudIndex: 0, cloudScore: 0, boat: 50, eagleProgress: 0, feathers: 0, eagleTimer: null, order: [], letterDone: false };
  const selector = el("gameSelector");
  const shell = el("miniGameShell");
  const content = el("miniGameContent");

  function track(name, params) { analytics?.trackEvent(name, params); }
  function read(key, fallback) { return storage?.getJSON(key, fallback) || fallback; }
  function save(key, value) { return storage?.setJSON(key, value) !== false; }
  function renderCollection() {
    const rewards = read(KEY, []);
    el("rewardCollection").innerHTML = rewards.length ? rewards.slice(-6).map((item) => `<span class="reward-chip">${item.icon} ${item.label}</span>`).join("") : "<span>Здесь появятся находки из игр.</span>";
  }
  function reward(label, icon) {
    const rewards = read(KEY, []);
    rewards.push({ label, icon, earnedAt: new Date().toISOString() });
    save(KEY, rewards.slice(-30)); renderCollection();
  }
  function gameCards() {
    el("gameCardGrid").innerHTML = data.games.map((game) => `<button class="game-card" data-game="${game.id}" type="button"><span class="game-card__icon" aria-hidden="true">${game.icon}</span><strong>${game.title}</strong><span>${game.description}</span><small>${game.age} лет · ${game.duration}</small></button>`).join("");
  }
  function open(ageGroup) {
    if (!root.classList.contains("hidden")) {
      el("generationErrorNotice").classList.add("hidden");
      return;
    }
    state.age = ageGroup === "5-7" ? "6" : "7-8"; state.previousFocus = document.activeElement; state.ready = false; state.storyId = null; state.finishRequested = false;
    el("difficultyButton").textContent = `Сложность: ${state.age === "6" ? "6 лет" : "7–8 лет"}`;
    root.classList.remove("hidden"); document.body.classList.add("game-open"); showSelector(); renderCollection();
    el("storyReadyNotice").classList.add("hidden"); el("generationErrorNotice").classList.add("hidden");
    window.setTimeout(() => root.querySelector("button")?.focus(), 0);
    track("generation_waiting_screen_opened", { ageBand: state.age });
  }
  function close() {
    stopEagle(); root.classList.add("hidden"); document.body.classList.remove("game-open"); state.previousFocus?.focus?.();
  }
  function showSelector() { stopEagle(); state.game = null; state.phase = "intro"; selector.classList.remove("hidden"); shell.classList.add("hidden"); }
  function start(id) {
    const game = data.games.find((item) => item.id === id); if (!game) return;
    state.game = id; state.phase = "playing"; selector.classList.add("hidden"); shell.classList.remove("hidden");
    track("mini_game_selected", { gameId: id }); track("mini_game_started", { gameId: id, ageBand: state.age });
    if (id === "clouds") startClouds(); else if (id === "eagle") startEagle(); else startStory();
  }
  function completed(title, text, label, icon) {
    state.phase = "completed"; reward(label, icon); track("mini_game_completed", { gameId: state.game, ageBand: state.age });
    content.innerHTML = `<div class="game-result"><span class="result-badge">${icon}</span><h3>${title}</h3><p>${text}</p><p><strong>Награда: ${label}</strong></p><button class="button primary" data-action="again" type="button">Сыграть ещё</button>${state.ready ? '<button class="button secondary" data-action="open-story" type="button">Открыть готовую историю</button>' : ""}</div>`;
  }
  function startClouds() { state.cloudIndex = 0; state.cloudScore = 0; renderCloud(); }
  function renderCloud(feedback = "") {
    const task = data.cloudTasks[state.cloudIndex];
    content.innerHTML = `<div class="cloud-scene"><div class="cloud-drift" aria-hidden="true">☁️　☁️　☁️</div><div class="bench-friends" aria-hidden="true">🦔 🦊</div></div><div class="game-question"><p class="game-count">Задание ${state.cloudIndex + 1} из ${data.cloudTasks.length}</p><h3>${task.prompt}</h3><div class="answer-grid">${task.options.map((option, index) => `<button type="button" data-cloud-answer="${index}">${option}</button>`).join("")}</div><p class="gentle-feedback" role="status">${feedback}</p></div>`;
  }
  function cloudAnswer(index) {
    const task = data.cloudTasks[state.cloudIndex];
    if (index !== task.answer) { renderCloud("Посмотри ещё раз — можно попробовать спокойно."); return; }
    state.cloudScore += 1; state.cloudIndex += 1;
    if (state.cloudIndex >= data.cloudTasks.length) completed("Облако найдено!", `Оно превратилось в ${task.reveal} и отправилось в Коллекцию фантазий.`, "облако фантазии", "☁️"); else renderCloud(`Верно! Облако превратилось в ${task.reveal}`);
  }
  function startEagle() {
    state.boat = 50; state.eagleProgress = 0; state.feathers = 0; renderEagle();
    stopEagle(); state.eagleTimer = window.setInterval(() => { state.eagleProgress += 1; if (state.eagleProgress >= 100) { stopEagle(); completed("Орёл спасён!", "Орёл благодарит тебя, Ежика и Лисёнка за спокойную и смелую помощь.", "Спасатель орла", "🪶"); } else renderEagle(); }, 800);
  }
  function stopEagle() { if (state.eagleTimer) window.clearInterval(state.eagleTimer); state.eagleTimer = null; }
  function moveBoat(delta) { state.boat = Math.max(12, Math.min(88, state.boat + delta)); state.feathers += Math.random() > 0.65 ? 1 : 0; renderEagle(); }
  function renderEagle() {
    content.innerHTML = `<div class="sea-game" tabindex="0" aria-label="Лодка в море. Используй стрелки влево и вправо."><div class="eagle-goal" aria-hidden="true">🦅</div><div class="obstacle rock-one" aria-hidden="true">🪨</div><div class="obstacle weed" aria-hidden="true">🌿</div><div class="boat" style="left:${state.boat}%" aria-label="Синяя лодка с Ежиком и Лисенком">🚣‍♂️</div></div><div class="game-hud"><span>До орла: ${Math.max(0, 100-state.eagleProgress)} шагов</span><span>Перья: ${state.feathers}</span></div><div class="boat-controls"><button type="button" data-move="-12" aria-label="Плыть влево">← Влево</button><button type="button" data-move="12" aria-label="Плыть вправо">Вправо →</button></div><button class="button quiet" data-action="finish-eagle" type="button">Закончить спасение</button>`;
    content.querySelector(".sea-game")?.focus({ preventScroll: true });
  }
  function startStory() { state.order = data.storyCards.map((_, i) => i).sort(() => Math.random() - .5); state.letterDone = false; renderStory(); }
  function renderStory(message = "") {
    content.innerHTML = `<div class="story-game"><h3>Расставь события по порядку</h3><p>Перетаскивай карточки или используй кнопки.</p><ol class="story-order">${state.order.map((cardIndex, position) => `<li draggable="true" data-position="${position}"><span>${data.storyCards[cardIndex]}</span><div><button type="button" data-up="${position}" aria-label="Поднять карточку выше">↑</button><button type="button" data-down="${position}" aria-label="Опустить карточку ниже">↓</button></div></li>`).join("")}</ol><p class="gentle-feedback" role="status">${message}</p><button class="button primary" data-action="check-story" type="button">Проверить порядок</button></div>`;
  }
  function moveCard(position, delta) { const next = position + delta; if (next < 0 || next >= state.order.length) return; [state.order[position], state.order[next]] = [state.order[next], state.order[position]]; renderStory(); }
  function checkStory() {
    if (!state.order.every((value, index) => value === index)) { renderStory("Почти! Подумай, что герои сделали сначала, а что — в конце."); return; }
    content.innerHTML = `<div class="game-question"><h3>Лисенок нашел старую к_рту</h3><div class="answer-grid"><button data-letter="а" type="button">а</button><button data-letter="о" type="button">о</button><button data-letter="у" type="button">у</button></div><p class="gentle-feedback"></p></div>`;
  }
  function chooseLetter(letter) {
    if (letter !== "а") { content.querySelector(".gentle-feedback").textContent = "Попробуй произнести слово медленно: к-а-р-та."; return; }
    content.innerHTML = `<div class="game-question"><h3>Что герои нашли в сундуке?</h3><div class="ending-grid">${data.endings.map((item, index) => `<button data-ending="${index}" type="button"><span>${item.icon}</span>${item.label}</button>`).join("")}</div></div>`;
  }
  function chooseEnding(index) {
    const ending = data.endings[index]; const story = { id: `mini-story-${Date.now()}`, type: "mini_game_story", title: "Карта старого маяка", ending: ending.label, text: `Ежик и Лисенок нашли карту и пришли к маяку. Чайка показала им сундук. Внутри лежал ${ending.label}. Друзья вернулись домой и сохранили находку на память.`, createdAt: new Date().toISOString() };
    const stories = read(STORY_KEY, []); stories.push(story); save(STORY_KEY, stories.slice(-20)); completed("Сказка собрана!", story.text, ending.reward, ending.icon);
  }
  function storyReady(storyId) { state.ready = true; state.storyId = storyId; el("storyReadyNotice").classList.remove("hidden"); track("story_ready_during_game", { gameId: state.game || "waiting" }); }
  function storyError() { el("generationErrorNotice").classList.remove("hidden"); }
  function rotateDifficulty() { state.age = state.age === "6" ? "7-8" : state.age === "7-8" ? "9" : "6"; el("difficultyButton").textContent = `Сложность: ${state.age === "6" ? "6 лет" : state.age === "9" ? "9 лет" : "7–8 лет"}`; }

  gameCards(); renderCollection();
  root.addEventListener("click", (event) => {
    const game = event.target.closest("[data-game]"); if (game) return start(game.dataset.game);
    const cloud = event.target.closest("[data-cloud-answer]"); if (cloud) return cloudAnswer(Number(cloud.dataset.cloudAnswer));
    const move = event.target.closest("[data-move]"); if (move) return moveBoat(Number(move.dataset.move));
    const up = event.target.closest("[data-up]"); if (up) return moveCard(Number(up.dataset.up), -1);
    const down = event.target.closest("[data-down]"); if (down) return moveCard(Number(down.dataset.down), 1);
    const letter = event.target.closest("[data-letter]"); if (letter) return chooseLetter(letter.dataset.letter);
    const ending = event.target.closest("[data-ending]"); if (ending) return chooseEnding(Number(ending.dataset.ending));
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "check-story") return checkStory(); if (action === "finish-eagle") { stopEagle(); return completed("Орёл спасён!", "Вы добрались до орла вместе.", "Спасатель орла", "🪶"); }
    if (action === "again") return start(state.game); if (action === "open-story") el("openReadyStoryButton").click();
  });
  root.addEventListener("keydown", (event) => { if (state.game === "eagle" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) { event.preventDefault(); moveBoat(event.key === "ArrowLeft" ? -10 : 10); } if (event.key === "Tab") { const focusable = Array.from(root.querySelectorAll("button:not([disabled])")); const first = focusable[0], last = focusable[focusable.length-1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } });
  let draggedPosition = null;
  root.addEventListener("dragstart", (event) => { const card = event.target.closest("[data-position]"); if (card) draggedPosition = Number(card.dataset.position); });
  root.addEventListener("dragover", (event) => { if (event.target.closest("[data-position]")) event.preventDefault(); });
  root.addEventListener("drop", (event) => { const card = event.target.closest("[data-position]"); if (!card || draggedPosition === null) return; event.preventDefault(); const target = Number(card.dataset.position); const [moved] = state.order.splice(draggedPosition, 1); state.order.splice(target, 0, moved); draggedPosition = null; renderStory(); });
  el("backToGamesButton").addEventListener("click", showSelector); el("difficultyButton").addEventListener("click", rotateDifficulty);
  el("justWaitButton").addEventListener("click", () => { track("mini_game_skipped"); selector.classList.add("is-waiting"); el("justWaitButton").textContent = "История создаётся — можно выбрать игру в любой момент"; });
  el("finishRoundButton").addEventListener("click", () => { state.finishRequested = true; el("storyReadyText").textContent = "Хорошо, закончи раунд — история подождёт."; });
  el("gameSoundToggle").addEventListener("click", (event) => { const on = event.currentTarget.getAttribute("aria-pressed") !== "true"; event.currentTarget.setAttribute("aria-pressed", String(on)); event.currentTarget.textContent = on ? "Звук включен" : "Звук выключен"; });
  window.HFMiniGames = { open, close, storyReady, storyError, getStoryId: () => state.storyId };
})(window, document);
