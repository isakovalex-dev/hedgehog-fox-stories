const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

class FakeClassList {
  constructor(initial = "") {
    this.values = new Set(String(initial).split(/\s+/).filter(Boolean));
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(tagName = "div", className = "") {
    this.tagName = tagName.toUpperCase();
    this.className = className;
    this.classList = new FakeClassList(className);
    this.dataset = {};
    this.attributes = new Map();
    this.children = [];
    this.listeners = new Map();
    this.disabled = false;
    this.hidden = false;
    this.textContent = "";
    this.html = "";
    this.image = null;
  }

  set innerHTML(value) {
    this.html = value;
    if (value.includes("<img")) this.image = new FakeElement("img");
  }

  get innerHTML() {
    return this.html;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  querySelector(selector) {
    return selector === "img" ? this.image : null;
  }

  append(child) {
    this.children.push(child);
  }

  replaceChildren() {
    this.children = [];
  }

  click() {
    if (!this.disabled) this.listeners.get("click")?.({ currentTarget: this });
  }

  focus() {}
}

function createGameEnvironment() {
  const elements = new Map([
    ["#memoryGame", new FakeElement("div")],
    ["#memoryGameLoading", new FakeElement("div")],
    ["#memoryGameContent", new FakeElement("div", "hidden")],
    ["#memoryGrid", new FakeElement("div")],
    ["#memoryMoves", new FakeElement("span")],
    ["#memoryMatches", new FakeElement("span")],
    ["#memoryAnnouncement", new FakeElement("p")],
    ["#memoryVictory", new FakeElement("div", "hidden")],
    ["#memoryVictorySummary", new FakeElement("p")],
    ["#memoryRestartTop", new FakeElement("button")],
    ["#memoryPlayAgain", new FakeElement("button")]
  ]);

  const stories = [
    ["lost-cloud", "Облако, которое заблудилось"],
    ["sea-bench", "Скамейка у моря"],
    ["hedgehog-bravery", "Где живёт смелость"],
    ["warm-wind-map", "Карта тёплого ветра"],
    ["rustling-grass", "Шорох в высокой траве"],
    ["star-for-friend", "Звезда для друга"]
  ].map(([id, title]) => ({ id, title, imageUrl: `assets/stories/${id}.png` }));

  global.document = {
    createElement: (tagName) => new FakeElement(tagName),
    querySelector: (selector) => elements.get(selector) || null
  };

  global.window = {
    document: global.document,
    HFStoryService: { getBuiltInStories: () => stories },
    setTimeout: (callback, delay) => setTimeout(callback, Math.min(delay, 5)),
    clearTimeout
  };

  global.Image = class FakeImage {
    set src(value) {
      this.currentSrc = value;
      queueMicrotask(() => this.onload?.());
    }
  };

  return elements;
}

function groupCards(cards) {
  const groups = new Map();
  cards.forEach((card) => {
    const pairId = card.dataset.cardId.replace(/-[01]$/, "");
    if (!groups.has(pairId)) groups.set(pairId, []);
    groups.get(pairId).push(card);
  });
  return Array.from(groups.values());
}

test("memory game handles mismatch, matches, victory and restart", async () => {
  const elements = createGameEnvironment();
  require(path.join(__dirname, "..", "js", "memoryGame.js"));

  await window.HFMemoryGame.initialize();

  const grid = elements.get("#memoryGrid");
  assert.equal(grid.children.length, 12);
  assert.equal(elements.get("#memoryMoves").textContent, "Ходы: 0");
  assert.equal(elements.get("#memoryMatches").textContent, "Найдено: 0 из 6");
  assert.equal(elements.get("#memoryGameLoading").classList.contains("hidden"), true);
  assert.equal(elements.get("#memoryGameContent").classList.contains("hidden"), false);
  assert.match(grid.children[0].innerHTML, /assets\/optimized\/.+-480\.avif/);

  let groups = groupCards(grid.children);
  groups[0][0].click();
  groups[1][0].click();

  assert.deepEqual(window.HFMemoryGame.getState(), {
    isReady: true,
    moves: 1,
    matches: 0,
    isLocked: true,
    openCards: 2,
    cardCount: 12
  });
  assert.equal(grid.children.every((card) => card.disabled), true);

  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(window.HFMemoryGame.getState().isLocked, false);
  assert.equal(window.HFMemoryGame.getState().openCards, 0);
  assert.equal(grid.children.every((card) => !card.disabled), true);

  window.HFMemoryGame.restart();
  groups = groupCards(grid.children);
  groups.forEach(([firstCard, secondCard]) => {
    firstCard.click();
    secondCard.click();
  });

  assert.equal(window.HFMemoryGame.getState().moves, 6);
  assert.equal(window.HFMemoryGame.getState().matches, 6);
  assert.equal(elements.get("#memoryMatches").textContent, "Найдено: 6 из 6");
  assert.equal(elements.get("#memoryVictory").classList.contains("hidden"), false);
  assert.equal(elements.get("#memoryAnnouncement").textContent, "Ура! Все пары найдены!");
  assert.equal(grid.children.every((card) => card.getAttribute("aria-label") === "Пара найдена"), true);

  elements.get("#memoryPlayAgain").click();
  assert.equal(window.HFMemoryGame.getState().moves, 0);
  assert.equal(window.HFMemoryGame.getState().matches, 0);
  assert.equal(elements.get("#memoryVictory").classList.contains("hidden"), true);
  assert.equal(grid.children.length, 12);
});
