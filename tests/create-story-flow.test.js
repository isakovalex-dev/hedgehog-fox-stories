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
    if (this.disabled) return;
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
      pickNextTask: (ageGroup, recentTaskIds) => [
        {
          id: `${ageGroup}-01`,
          text: "Сколько будет 2 + 3?",
          image: `/images/generation-tasks/${ageGroup}/task-01.webp`,
          options: ["4", "5"],
          correctAnswer: "5",
          hint: "Сложи два числа."
        },
        {
          id: `${ageGroup}-02`,
          text: "Сколько будет 3 + 3?",
          image: `/images/generation-tasks/${ageGroup}/task-02.webp`,
          options: ["5", "6"],
          correctAnswer: "6",
          hint: "Сложи три и три."
        },
        {
          id: `${ageGroup}-03`,
          text: "Сколько будет 4 + 3?",
          image: `/images/generation-tasks/${ageGroup}/task-03.webp`,
          options: ["6", "7"],
          correctAnswer: "7",
          hint: "Сложи четыре и три."
        }
      ].find((task) => !recentTaskIds.slice(-2).includes(task.id)),
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
  const taskImage = new FakeElement(documentRef, "generationTaskImage");
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
  taskPanel.append(taskImage, taskText, taskOptions, feedback, hint);
  const elements = {
    "#generationOverlayTitle": title,
    "#generationProgress": progress,
    "#generationTasksPanel": taskPanel,
    "#generationTaskImage": taskImage,
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
    taskPanel,
    taskImage,
    taskText,
    taskOptions,
    feedback,
    hint,
    skipButton,
    nextButton,
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

test("ready story keeps the tasks available and opens the exact story", () => {
  const { window, documentRef, trigger, overlay, openButton, taskPanel } = createOverlayEnvironment();
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
  assert.equal(taskPanel.hidden, false);
  openButton.click();
  assert.equal(openedStoryId, "story-42");

  flow.hide();
  assert.equal(flow.isOpen(), false);
  assert.equal(trigger.focused, true);
});

test("pending illustrations do not announce a finished story and completion preserves the current answer", () => {
  const { window, documentRef, overlay, title, taskOptions, feedback, openButton } = createOverlayEnvironment();
  loadFlow(window, documentRef);
  const flow = window.HFCreateStoryFlow.create({ root: overlay });
  flow.start({ ageGroup: "9-10" });
  flow.setReady({ storyId: "story-42", illustrationsPending: true });
  assert.match(title.textContent, /Текст готов/);
  assert.match(openButton.textContent, /пока рисуются/);
  taskOptions.children[0].click();
  const selectedButton = taskOptions.children[0];
  flow.setIllustrationProgress({ storyId: "story-42", completed: 2, total: 2, failed: 0 });
  assert.match(title.textContent, /Текст готов/);
  flow.setIllustrationProgress({ storyId: "story-42", completed: 2, total: 2, failed: 0, finished: true });
  assert.equal(title.textContent, "Сказка готова!");
  assert.equal(openButton.textContent, "Читать сказку");
  assert.equal(taskOptions.children[0], selectedButton);
  assert.equal(feedback.textContent, "Попробуй ещё раз");
});

test("illustration failures and late results cannot announce full completion or reopen a closed dialog", () => {
  const { window, documentRef, overlay, title } = createOverlayEnvironment();
  loadFlow(window, documentRef);
  const flow = window.HFCreateStoryFlow.create({ root: overlay });
  flow.start();
  flow.setReady({ storyId: "story-42", illustrationsPending: true });
  flow.hide();
  flow.setIllustrationProgress({ storyId: "story-42", completed: 1, total: 2, failed: 1, finished: true });
  assert.match(title.textContent, /Текст готов/);
  assert.equal(flow.isOpen(), false);
  flow.start();
  flow.setIllustrationProgress({ storyId: "story-42", completed: 2, total: 2, finished: true });
  assert.equal(overlay.dataset.state, "generating");
});

test("ready story lets a child answer a task", () => {
  const { window, documentRef, trigger, overlay, taskOptions, feedback } = createOverlayEnvironment();
  loadFlow(window, documentRef);
  const flow = window.HFCreateStoryFlow.create({ root: overlay });

  flow.start({ ageGroup: "7-8", trigger });
  flow.setReady({ storyId: "story-42" });
  taskOptions.children.find((button) => button.dataset.answer === "5").click();

  assert.equal(feedback.textContent, "Верно! ⭐");
});

test("skipping a task immediately shows another task with its own illustration", () => {
  const { window, documentRef, trigger, overlay, taskImage, skipButton, nextButton } = createOverlayEnvironment();
  loadFlow(window, documentRef);
  const flow = window.HFCreateStoryFlow.create({ root: overlay });

  flow.start({ ageGroup: "7-8", trigger });
  assert.equal(taskImage.src, "/images/generation-tasks/7-8/task-01.webp");
  skipButton.click();

  assert.equal(taskImage.alt, "Задание: Сколько будет 3 + 3?");
  assert.equal(taskImage.src, "/images/generation-tasks/7-8/task-02.webp");
  assert.equal(skipButton.hidden, false);
  assert.equal(nextButton.hidden, false);
});

test("story readiness keeps the current task available and exposes the reader action", () => {
  const { window, documentRef, trigger, overlay, taskImage, skipButton, nextButton, openButton } = createOverlayEnvironment();
  loadFlow(window, documentRef);
  const flow = window.HFCreateStoryFlow.create({ root: overlay });

  flow.start({ ageGroup: "7-8", trigger });
  flow.setReady({ storyId: "story-42" });
  skipButton.click();

  assert.equal(taskImage.alt, "Задание: Сколько будет 3 + 3?");
  assert.equal(openButton.hidden, false);
  assert.equal(skipButton.hidden, false);
  assert.equal(nextButton.hidden, false);
});

test("a correct answer is visibly confirmed before the next task is loaded", () => {
  const { window, documentRef, trigger, overlay, taskOptions, feedback } = createOverlayEnvironment();
  loadFlow(window, documentRef);
  const flow = window.HFCreateStoryFlow.create({ root: overlay });

  flow.start({ ageGroup: "7-8", trigger });
  const correctAnswer = taskOptions.children.find((button) => button.dataset.answer === "5");
  correctAnswer.click();

  assert.equal(feedback.textContent, "Верно! ⭐");
  assert.equal(correctAnswer.classList.contains("is-correct"), true);
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

test("pending progress cycles only through the first four phases until the story is ready", () => {
  const { window, documentRef, trigger, overlay, phases } = createOverlayEnvironment();
  loadFlow(window, documentRef);
  const flow = window.HFCreateStoryFlow.create({ root: overlay });

  flow.start({ ageGroup: "5-6", trigger });
  const cycle = window.intervalCalls[0].callback;
  cycle();
  cycle();
  cycle();
  cycle();

  assert.equal(phases[4].classList.contains("is-active"), false);
  assert.equal(phases[4].classList.contains("is-complete"), false);

  flow.setReady({ storyId: "story-42" });
  assert.equal(phases[4].classList.contains("is-complete"), true);
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

test("ready state includes task answers in Tab wrapping", () => {
  const { window, documentRef, trigger, overlay, closeButton, openButton } = createOverlayEnvironment();
  loadFlow(window, documentRef);
  const flow = window.HFCreateStoryFlow.create({ root: overlay });

  flow.start({ ageGroup: "7-8", trigger });
  flow.setReady({ storyId: "story-42" });
  const taskAnswer = overlay.querySelector("#generationTaskOptions").children.at(-1);
  taskAnswer.focus();
  const tabEvent = overlay.dispatch("keydown", { key: "Tab" });

  assert.equal(tabEvent.defaultPrevented, true);
  assert.equal(documentRef.activeElement, closeButton);
  assert.notEqual(documentRef.activeElement, openButton);
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
  assert.equal(feedback.textContent, "Верно! ⭐");
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

test("error state focuses Retry and enables the trigger before focus is restored", () => {
  const { window, documentRef, trigger, overlay, retryButton } = createOverlayEnvironment();
  loadFlow(window, documentRef);
  trigger.disabled = true;
  const flow = window.HFCreateStoryFlow.create({
    root: overlay,
    onHide: () => {
      trigger.disabled = false;
    }
  });

  flow.start({ ageGroup: "9-10", trigger });
  flow.setError({ message: "Сеть недоступна" });
  assert.equal(documentRef.activeElement, retryButton);

  flow.hide();
  assert.equal(documentRef.activeElement, trigger);
});
