const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...values) {
    values.forEach((value) => this.values.add(value));
  }

  remove(...values) {
    values.forEach((value) => this.values.delete(value));
  }

  contains(value) {
    return this.values.has(value);
  }

  toggle(value, force) {
    const shouldAdd = force === undefined ? !this.values.has(value) : force;
    if (shouldAdd) this.values.add(value);
    else this.values.delete(value);
    return shouldAdd;
  }
}

class FakeElement {
  constructor(documentRef, id = "") {
    this.ownerDocument = documentRef;
    this.id = id;
    this.dataset = {};
    this.classList = new FakeClassList();
    this.listeners = new Map();
    this.children = [];
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.type = "";
    this.focused = false;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    this.listeners.set(type, listeners.filter((item) => item !== listener));
  }

  dispatch(type, extras = {}) {
    const event = {
      type,
      target: this,
      currentTarget: this,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...extras
    };
    (this.listeners.get(type) || []).forEach((listener) => listener(event));
    return event;
  }

  click() {
    return this.dispatch("click");
  }

  focus() {
    this.focused = true;
    this.ownerDocument.activeElement = this;
  }

  append(...children) {
    children.forEach((child) => {
      child.parentElement = this;
      this.children.push(child);
    });
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }
}

function createOverlayEnvironment() {
  const documentRef = {
    activeElement: null,
    body: { classList: new FakeClassList() },
    createElement: () => new FakeElement(documentRef)
  };
  const window = {
    document: documentRef,
    HFGenerationTasks: {
      createTaskSet: (ageGroup) => [{
        id: `${ageGroup}-task`,
        text: "Сколько будет 2 + 3?",
        options: ["4", "5"],
        correctAnswer: "5",
        hint: "Сложи два числа.",
        explanation: "2 + 3 = 5"
      }],
      checkAnswer: (task, answer) => ({
        correct: task.correctAnswer === answer,
        hint: task.hint,
        explanation: task.explanation
      })
    },
    intervalCalls: [],
    timeoutCalls: [],
    clearedIntervals: [],
    clearedTimeouts: [],
    setInterval(callback, delay) {
      const id = { callback, delay };
      this.intervalCalls.push(id);
      return id;
    },
    clearInterval(id) {
      this.clearedIntervals.push(id);
    },
    setTimeout(callback, delay) {
      const id = { callback, delay };
      this.timeoutCalls.push(id);
      return id;
    },
    clearTimeout(id) {
      this.clearedTimeouts.push(id);
    }
  };
  documentRef.defaultView = window;

  const overlay = new FakeElement(documentRef, "generationOverlay");
  const trigger = new FakeElement(documentRef, "createStoryButton");
  const title = new FakeElement(documentRef, "generationOverlayTitle");
  const progress = new FakeElement(documentRef, "generationProgress");
  const taskPanel = new FakeElement(documentRef, "generationTasksPanel");
  const taskText = new FakeElement(documentRef, "generationTaskText");
  const taskOptions = new FakeElement(documentRef, "generationTaskOptions");
  const feedback = new FakeElement(documentRef, "generationTaskFeedback");
  const hint = new FakeElement(documentRef, "generationTaskHint");
  const skipButton = new FakeElement(documentRef, "generationTaskSkip");
  const nextButton = new FakeElement(documentRef, "generationTaskNext");
  const retryButton = new FakeElement(documentRef, "generationRetry");
  const closeButton = new FakeElement(documentRef, "generationClose");
  const openButton = new FakeElement(documentRef, "generationOpenStoryButton");
  const phases = Array.from({ length: 5 }, () => new FakeElement(documentRef));
  overlay.append(taskPanel, closeButton, skipButton, nextButton, retryButton, openButton);
  taskPanel.append(taskText, taskOptions, feedback, hint);
  const elements = {
    "#generationOverlayTitle": title,
    "#generationProgress": progress,
    "#generationTasksPanel": taskPanel,
    "#generationTaskText": taskText,
    "#generationTaskOptions": taskOptions,
    "#generationTaskFeedback": feedback,
    "#generationTaskHint": hint,
    "#generationTaskSkip": skipButton,
    "#generationTaskNext": nextButton,
    "#generationRetry": retryButton,
    "#generationClose": closeButton,
    "#generationOpenStoryButton": openButton
  };
  overlay.querySelector = (selector) => elements[selector] || null;
  overlay.querySelectorAll = (selector) => {
    if (selector === "[data-generation-phase]") return phases;
    if (selector.includes("button")) return [closeButton, skipButton, nextButton, retryButton, openButton, ...taskOptions.children]
      .filter((element) => !element.hidden && !element.disabled);
    return [];
  };

  return {
    window,
    documentRef,
    trigger,
    overlay,
    title,
    taskOptions,
    feedback,
    hint,
    skipButton,
    retryButton,
    closeButton,
    openButton,
    phases
  };
}

function loadFlow(window, documentRef) {
  global.window = window;
  global.document = documentRef;
  const modulePath = path.join(__dirname, "..", "js", "createStoryFlow.js");
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
}

test("overlay keeps generation pending until ready, restores focus, and opens the exact story", () => {
  const { window, documentRef, trigger, overlay, openButton } = createOverlayEnvironment();
  loadFlow(window, documentRef);
  let openedStoryId = "";
  const flow = window.HFCreateStoryFlow.create({
    root: overlay,
    onOpenStory: (storyId) => { openedStoryId = storyId; }
  });

  flow.start({ ageGroup: "7-8", trigger });
  assert.equal(flow.isOpen(), true);
  assert.equal(overlay.dataset.state, "generating");
  assert.equal(openButton.hidden, true);

  flow.setReady({ storyId: "story-42" });
  assert.equal(overlay.dataset.state, "ready");
  assert.equal(openButton.hidden, false);
  openButton.click();
  assert.equal(openedStoryId, "story-42");

  flow.hide();
  assert.equal(flow.isOpen(), false);
  assert.equal(trigger.focused, true);
});

test("overlay reports the prior state when an explicit close hides it", () => {
  const { window, documentRef, trigger, overlay, closeButton } = createOverlayEnvironment();
  loadFlow(window, documentRef);
  const hiddenStates = [];
  const flow = window.HFCreateStoryFlow.create({
    root: overlay,
    onHide: ({ state }) => hiddenStates.push(state)
  });

  flow.start({ ageGroup: "5-6", trigger });
  closeButton.click();
  flow.start({ ageGroup: "7-8", trigger });
  flow.setReady({ storyId: "story-42" });
  closeButton.click();
  flow.setError({ message: "Сеть недоступна" });
  closeButton.click();

  assert.deepEqual(hiddenStates, ["generating", "ready", "error"]);
});

test("overlay has one phase interval and cleans it up when hidden", () => {
  const { window, documentRef, trigger, overlay } = createOverlayEnvironment();
  loadFlow(window, documentRef);
  const flow = window.HFCreateStoryFlow.create({ root: overlay });

  flow.start({ ageGroup: "5-6", trigger });
  flow.start({ ageGroup: "9-10", trigger });
  assert.equal(window.intervalCalls.length, 2);
  assert.equal(window.intervalCalls[0].delay, 12000);
  assert.equal(window.clearedIntervals.length, 1);

  flow.hide();
  assert.equal(window.clearedIntervals.length, 2);
  assert.equal(window.timeoutCalls.length, 0);
});

test("ready state moves focus back into the overlay after pending Escape", () => {
  const { window, documentRef, trigger, overlay, openButton } = createOverlayEnvironment();
  loadFlow(window, documentRef);
  const flow = window.HFCreateStoryFlow.create({ root: overlay });

  flow.start({ ageGroup: "7-8", trigger });
  overlay.dispatch("keydown", { key: "Escape" });
  assert.equal(documentRef.activeElement, trigger);

  flow.setReady({ storyId: "story-42" });
  assert.equal(flow.isOpen(), true);
  assert.equal(documentRef.activeElement, openButton);
});

test("ready state excludes answers inside the hidden task panel from Tab wrapping", () => {
  const { window, documentRef, trigger, overlay, closeButton, openButton } = createOverlayEnvironment();
  loadFlow(window, documentRef);
  const flow = window.HFCreateStoryFlow.create({ root: overlay });

  flow.start({ ageGroup: "7-8", trigger });
  flow.setReady({ storyId: "story-42" });
  openButton.focus();
  const tabEvent = overlay.dispatch("keydown", { key: "Tab" });

  assert.equal(tabEvent.defaultPrevented, true);
  assert.equal(documentRef.activeElement, closeButton);
});

test("overlay traps Tab, hides with Escape without retrying, and follows answer feedback rules", () => {
  const { window, documentRef, trigger, overlay, taskOptions, feedback, hint, skipButton, retryButton, closeButton } = createOverlayEnvironment();
  loadFlow(window, documentRef);
  let retries = 0;
  const flow = window.HFCreateStoryFlow.create({ root: overlay, onRetry: () => { retries += 1; } });

  flow.start({ ageGroup: "7-8", trigger });
  const firstAnswer = taskOptions.children.find((button) => button.dataset.answer === "4");
  const correctAnswer = taskOptions.children.find((button) => button.dataset.answer === "5");
  firstAnswer.click();
  assert.equal(feedback.textContent, "Попробуй ещё раз");
  assert.equal(hint.hidden, true);
  firstAnswer.click();
  assert.equal(hint.hidden, false);
  correctAnswer.click();
  assert.equal(feedback.textContent, "Верно!");
  assert.equal(window.timeoutCalls.at(-1).delay, 700);
  skipButton.click();
  assert.equal(feedback.textContent, "");

  closeButton.focus();
  const tabEvent = overlay.dispatch("keydown", { key: "Tab", shiftKey: true });
  assert.equal(tabEvent.defaultPrevented, true);
  assert.equal(documentRef.activeElement, taskOptions.children.at(-1));
  const escapeEvent = overlay.dispatch("keydown", { key: "Escape" });
  assert.equal(escapeEvent.defaultPrevented, true);
  assert.equal(flow.isOpen(), false);
  assert.equal(retries, 0);

  flow.setError({ message: "Сеть недоступна" });
  retryButton.click();
  assert.equal(retries, 1);
});
