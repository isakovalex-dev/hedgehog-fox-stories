"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const projectRoot = path.join(__dirname, "..");
const userStoriesKey = "hedgehogFoxUserStories";
const fixtureStoryId = "task-5-user-badge-fixture";

class FakeClassList {
  constructor() {
    this.values = new Set();
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

  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.values.has(name) : Boolean(force);
    if (shouldAdd) this.values.add(name);
    else this.values.delete(name);
    return shouldAdd;
  }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.dataset = {};
    this.style = {
      setProperty() {}
    };
    this.innerHTML = "";
    this.textContent = "";
    this.value = "";
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.scrollHeight = 0;
    this.clientHeight = 0;
    this.scrollTop = 0;
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  dispatch(type, event = {}) {
    (this.listeners.get(type) || []).forEach((listener) => listener({ currentTarget: this, ...event }));
  }

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  replaceWith() {}

  focus() {}

  scrollIntoView() {}

  reset() {}

  requestSubmit() {}
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
    this.body = new FakeElement("body");
    this.title = "";
  }

  querySelector(selector) {
    if (!this.elements.has(selector)) {
      let tagName = "div";
      if (selector === "#readerTitle") tagName = "h2";
      else if (selector === ".hero h1") tagName = "h1";
      else if (selector.startsWith("meta[")) tagName = "meta";
      else if (selector.startsWith("link[")) tagName = "link";
      else if (selector.endsWith("Form") || selector.endsWith("#generatorForm")) tagName = "form";
      this.elements.set(selector, new FakeElement(tagName));
    }
    return this.elements.get(selector);
  }

  querySelectorAll() {
    return [];
  }

  getElementById(id) {
    return this.querySelector(`#${id}`);
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  addEventListener() {}
}

class FakeLocalStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function loadScript(relativePath, context) {
  const source = fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
  vm.runInContext(source, context, { filename: relativePath });
}

function getRenderedCard(html, storyId) {
  const cardStart = html.indexOf(`data-story-card="${storyId}"`);
  assert.notEqual(cardStart, -1, `Rendered HTML must contain the card for ${storyId}`);
  const articleStart = html.lastIndexOf("<article", cardStart);
  const articleEnd = html.indexOf("</article>", cardStart);
  assert.notEqual(articleStart, -1, `Rendered HTML must contain the opening article for ${storyId}`);
  assert.notEqual(articleEnd, -1, `Rendered HTML must contain the closing article for ${storyId}`);
  return html.slice(articleStart, articleEnd + "</article>".length);
}

function createRuntime({ seedFixture, pathname = "/stories", journeyService = null }) {
  const document = new FakeDocument();
  const localStorage = new FakeLocalStorage();
  const fixtureStory = {
    id: fixtureStoryId,
    title: "Проверочная история Task 5",
    age: "5–7",
    ageGroup: "5-7",
    time: "3 минуты",
    tags: ["5-7", "friendship"],
    description: "Локальная история для проверки подписи источника.",
    slides: ["Ежонок и Лисёнок проверили свою библиотеку."],
    colors: ["#cfeaf1", "#f8e9be", "#9fca84"],
    useIllustrations: false,
    createdAt: "2026-07-31T12:15:00.000Z"
  };

  if (seedFixture) {
    localStorage.setItem(userStoriesKey, JSON.stringify([fixtureStory]));
  }

  const window = {
    document,
    localStorage,
    location: {
      pathname,
      search: "",
      hash: "",
      origin: "https://test.local",
      href: `https://test.local${pathname}`,
      assign() {}
    },
    history: {
      pushState() {},
      replaceState() {}
    },
    innerWidth: 1280,
    addEventListener() {},
    setTimeout(callback) {
      callback();
      return 1;
    },
    clearTimeout() {},
    setInterval() {
      return 1;
    },
    clearInterval() {},
    scrollTo() {},
    fetch: async () => {
      throw new Error("Unexpected fetch in renderer integration test");
    },
    HFConfig: {},
    HFSupabaseService: {
      isEnabled: () => false,
      isAuthenticated: () => false,
      getAuthState: () => ({ status: "disabled" }),
      getCurrentUser: () => null
    },
    HFLikeService: {
      isStoryLiked: () => false,
      getStoryLikeCount: (story) => story.baseLikes || 0,
      initializeLikes: async () => {},
      toggleStoryLike: async () => false
    },
    HFSubscriptionService: {
      initializeSubscription: async () => {},
      getSubscriptionState: () => ({ status: "free", currentPeriodEnd: "" }),
      getGenerationUsage: () => ({
        generationsUsed: 0,
        generationLimit: 1,
        canGenerate: true,
        periodEnd: ""
      }),
      getStorageState: () => ({ mode: "local" }),
      canGenerateStory: () => true,
      incrementLocalGenerationUsage: async () => {}
    },
    HFAnalyticsService: {
      EVENTS: {},
      trackEvent() {},
      recordGenerationResult() {}
    },
    HFJourneyService: journeyService
  };
  window.window = window;

  const context = vm.createContext({
    window,
    document,
    console,
    URL,
    URLSearchParams,
    AbortController,
    FormData: class FakeFormData {},
    Date,
    Math,
    JSON,
    Map,
    Set,
    Promise,
    encodeURIComponent,
    decodeURIComponent
  });

  return { context, document, fixtureStory, localStorage, window };
}

test("reader saves a keepsake for the future map without claiming it is already visible", async () => {
  const savedDiscoveries = [];
  const journeyService = {
    markDiscovered(story) {
      savedDiscoveries.push(JSON.parse(JSON.stringify(story)));
      return {
        storyId: story.id,
        place: story.journeyPlace,
        keepsake: story.keepsake
      };
    },
    getDiscoveries: () => [],
    getDiscoveredPlaceIds: () => new Set(),
    getJourneyProgress: () => 0
  };
  const { context, document } = createRuntime({
    seedFixture: false,
    pathname: "/stories/lost-cloud",
    journeyService
  });

  loadScript("js/storageService.js", context);
  loadScript("js/storyService.js", context);
  loadScript("js/app.js", context);
  await new Promise((resolve) => setImmediate(resolve));

  const slides = document.querySelector("#slides");
  assert.match(
    slides.innerHTML,
    /Дочитайте до конца, чтобы сохранить памятную находку для будущей карты\./
  );

  const discoveryElement = new FakeElement();
  slides.querySelector = (selector) => selector === ".reader-discovery" ? discoveryElement : null;
  slides.scrollHeight = 100;
  slides.clientHeight = 0;
  slides.scrollTop = 100;
  slides.dispatch("scroll");

  assert.deepEqual(savedDiscoveries, [
    { id: "lost-cloud", journeyPlace: "cottage", keepsake: "feather" }
  ]);
  assert.match(
    discoveryElement.innerHTML,
    /Находка сохранена для будущей карты: <strong>Пёрышко добрых вестей<\/strong>\./
  );
  assert.doesNotMatch(discoveryElement.innerHTML, /на карте появилась|появилась на карте/i);
  assert.equal(discoveryElement.classList.contains("is-found"), true);
});

test("static homepage map initializes no interactive journey presentation", async () => {
  const presentationReads = [];
  const journeyService = {
    markDiscovered() {
      throw new Error("Reader discovery is not expected during homepage initialization");
    },
    getDiscoveries() {
      presentationReads.push("discoveries");
      return [];
    },
    getDiscoveredPlaceIds() {
      presentationReads.push("places");
      return new Set();
    },
    getJourneyProgress() {
      presentationReads.push("progress");
      return 0;
    }
  };
  const { context, document } = createRuntime({
    seedFixture: false,
    pathname: "/",
    journeyService
  });

  loadScript("js/storageService.js", context);
  loadScript("js/storyService.js", context);
  loadScript("js/app.js", context);
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(presentationReads, []);
  assert.equal(
    document.querySelector("#journeyMap").listeners.get("click")?.length || 0,
    0,
    "The approved static map must not install the removed place-opening handler"
  );
});

test("local user story renders the user badge and cleanup removes the fixture", async () => {
  const runtime = createRuntime({ seedFixture: true });
  const { context, document, localStorage, window } = runtime;
  let renderedEvidence;

  try {
    loadScript("js/storageService.js", context);
    loadScript("js/storyService.js", context);
    loadScript("js/app.js", context);
    await new Promise((resolve) => setImmediate(resolve));

    const userStory = window.HFStoryService.getStoryById(fixtureStoryId);
    assert.equal(userStory.source, "user", "Storage fixture must be normalized as a user story");

    const storiesCard = getRenderedCard(document.querySelector("#storyList").innerHTML, fixtureStoryId);
    const libraryCard = getRenderedCard(document.querySelector("#libraryList").innerHTML, fixtureStoryId);
    const authorCard = getRenderedCard(document.querySelector("#storyList").innerHTML, "lost-cloud");

    assert.ok(storiesCard.includes("story-source-badge--user"));
    assert.ok(storiesCard.includes("<span>Моя история</span>"));
    assert.ok(libraryCard.includes("story-source-badge--user"));
    assert.ok(libraryCard.includes("<span>Моя история</span>"));
    assert.ok(authorCard.includes("story-source-badge--author"));
    assert.ok(authorCard.includes("<span>История от автора</span>"));

    renderedEvidence = {
      source: userStory.source,
      storiesBadge: "Моя история",
      libraryBadge: "Моя история",
      authorBadge: "История от автора"
    };
  } finally {
    window.HFStorageService?.removeItem(userStoriesKey);
    assert.equal(localStorage.getItem(userStoriesKey), null, "Fixture key must be removed from localStorage");
    assert.equal(
      window.HFStoryService?.getUserStories().length || 0,
      0,
      "No fixture story may remain after cleanup"
    );
  }

  console.log("[story-badge-renderer]", JSON.stringify({
    ...renderedEvidence,
    cleanup: {
      storageKey: localStorage.getItem(userStoriesKey),
      remainingUserStories: window.HFStoryService.getUserStories().length
    }
  }));
});
