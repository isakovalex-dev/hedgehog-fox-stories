(function (window) {
  "use strict";

  const FOCUSABLE_SELECTOR = [
    "button:not([disabled])",
    "[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])"
  ].join(", ");
  const PHASE_INTERVAL_MS = 12000;
  const CORRECT_ANSWER_DELAY_MS = 700;

  function create(options) {
    const root = options && options.root;
    const documentRef = root && root.ownerDocument ? root.ownerDocument : window.document;
    const body = documentRef && documentRef.body;
    const onOpenStory = typeof options?.onOpenStory === "function" ? options.onOpenStory : () => {};
    const onRetry = typeof options?.onRetry === "function" ? options.onRetry : () => {};
    const onHide = typeof options?.onHide === "function" ? options.onHide : () => {};
    const elements = {
      title: find("#generationOverlayTitle"),
      progress: find("#generationProgress"),
      taskPanel: find("#generationTasksPanel"),
      taskCards: find("#generationTaskCards"),
      activeTaskCard: find("#generationTaskCard"),
      taskText: find("#generationTaskText"),
      taskOptions: find("#generationTaskOptions"),
      feedback: find("#generationTaskFeedback"),
      hint: find("#generationTaskHint"),
      skip: find("#generationTaskSkip"),
      next: find("#generationTaskNext"),
      retry: find("#generationRetry"),
      close: find("#generationClose"),
      open: find("#generationOpenStoryButton"),
      error: find("#generationErrorMessage")
    };
    const phases = findAll("[data-generation-phase]");
    const staticBindings = [];
    const taskBindings = [];
    let phaseTimerId = null;
    let advanceTimerId = null;
    let triggerElement = null;
    let tasks = [];
    let taskIndex = 0;
    let wrongAnswerCount = 0;
    let phaseIndex = 0;
    let storyId = "";
    let state = "idle";
    let open = false;
    let destroyed = false;

    function find(selector) {
      return root && typeof root.querySelector === "function" ? root.querySelector(selector) : null;
    }

    function findAll(selector) {
      return root && typeof root.querySelectorAll === "function" ? Array.from(root.querySelectorAll(selector)) : [];
    }

    function addListener(element, type, listener, bindings) {
      if (!element || typeof element.addEventListener !== "function") return;
      element.addEventListener(type, listener);
      bindings.push({ element, type, listener });
    }

    function removeListeners(bindings) {
      bindings.splice(0).forEach(({ element, type, listener }) => {
        element.removeEventListener?.(type, listener);
      });
    }

    function clearTimers() {
      if (phaseTimerId) window.clearInterval(phaseTimerId);
      if (advanceTimerId) window.clearTimeout(advanceTimerId);
      phaseTimerId = null;
      advanceTimerId = null;
    }

    function updatePhase() {
      if (!phases.length) return;
      phases.forEach((phase, index) => {
        const active = index === phaseIndex;
        phase.classList?.toggle("is-active", active);
        phase.classList?.toggle("is-complete", state === "ready" || index < phaseIndex);
        if (active) phase.setAttribute?.("aria-current", "step");
        else phase.removeAttribute?.("aria-current");
      });
      if (elements.progress) elements.progress.dataset.activePhase = String(phaseIndex);
    }

    function show(nextState, shouldFocus) {
      state = nextState;
      open = true;
      root.hidden = false;
      root.dataset.state = nextState;
      body?.classList?.add("create-overlay-open");
      bindListeners();
      if (shouldFocus) root.focus?.();
    }

    function bindListeners() {
      if (staticBindings.length) return;
      addListener(root, "keydown", handleKeydown, staticBindings);
      addListener(elements.close, "click", hide, staticBindings);
      addListener(elements.open, "click", openStory, staticBindings);
      addListener(elements.retry, "click", () => onRetry(), staticBindings);
      addListener(elements.skip, "click", advanceTask, staticBindings);
      addListener(elements.next, "click", advanceTask, staticBindings);
      addListener(window, "resize", refreshTaskCards, staticBindings);
    }

    function setText(element, value) {
      if (element) element.textContent = value;
    }

    function setHidden(element, hidden) {
      if (element) element.hidden = hidden;
    }

    function isFocusable(element) {
      if (!element || element.disabled) return false;

      let currentElement = element;
      while (currentElement) {
        if (currentElement.hidden) return false;
        if (currentElement === root) break;
        currentElement = currentElement.parentElement;
      }
      return true;
    }

    function shouldShowTaskPreviews() {
      return Boolean(window.matchMedia?.("(min-width: 960px)").matches);
    }

    function createPreviewCard(task, position) {
      const preview = documentRef.createElement("article");
      const label = documentRef.createElement("p");
      const text = documentRef.createElement("p");
      preview.className = "generation-task-card generation-task-card--preview";
      preview.setAttribute?.("aria-hidden", "true");
      label.className = "generation-task-card__eyebrow";
      label.textContent = `Следующая задачка ${position}`;
      text.className = "generation-task-card__text";
      text.textContent = task.text || "Новая маленькая задачка уже ждёт.";
      preview.append?.(label, text);
      return preview;
    }

    function renderTaskCards(task) {
      if (!elements.taskCards || !elements.activeTaskCard) return;
      const previews = shouldShowTaskPreviews()
        ? tasks
            .map((previewTask, index) => ({ previewTask, index }))
            .filter(({ index }) => index !== taskIndex)
            .slice(0, 2)
            .map(({ previewTask }, index) => createPreviewCard(previewTask, index + 1))
        : [];
      elements.taskCards.replaceChildren?.(elements.activeTaskCard, ...previews);
    }

    function refreshTaskCards() {
      if (state === "generating" && tasks[taskIndex]) renderTaskCards(tasks[taskIndex]);
    }

    function renderTask() {
      removeListeners(taskBindings);
      const task = tasks[taskIndex];
      wrongAnswerCount = 0;
      setText(elements.feedback, "");
      setText(elements.hint, "");
      setHidden(elements.hint, true);

      if (!task) {
        setHidden(elements.taskPanel, true);
        return;
      }

      setHidden(elements.taskPanel, false);
      renderTaskCards(task);
      setText(elements.taskText, task.text || "");
      if (!elements.taskOptions) return;

      const answerButtons = (task.options || []).map((answer) => {
        const button = documentRef.createElement("button");
        button.type = "button";
        button.className = "generation-task-answer";
        button.dataset.answer = String(answer);
        button.textContent = String(answer);
        addListener(button, "click", () => answerTask(task, String(answer)), taskBindings);
        return button;
      });
      elements.taskOptions.replaceChildren?.(...answerButtons);
    }

    function answerTask(task, answer) {
      if (state !== "generating") return;
      const result = window.HFGenerationTasks?.checkAnswer?.(task, answer);
      if (result?.correct) {
        setText(elements.feedback, "Верно!");
        if (advanceTimerId) window.clearTimeout(advanceTimerId);
        advanceTimerId = window.setTimeout(() => {
          advanceTimerId = null;
          advanceTask();
        }, CORRECT_ANSWER_DELAY_MS);
        return;
      }

      wrongAnswerCount += 1;
      setText(elements.feedback, "Попробуй ещё раз");
      if (wrongAnswerCount >= 2) {
        setText(elements.hint, result?.hint || task.hint || "");
        setHidden(elements.hint, false);
      }
    }

    function advanceTask() {
      if (!tasks.length || state !== "generating") return;
      if (advanceTimerId) window.clearTimeout(advanceTimerId);
      advanceTimerId = null;
      taskIndex = (taskIndex + 1) % tasks.length;
      renderTask();
    }

    function start({ ageGroup, trigger } = {}) {
      if (destroyed || !root) return;
      clearTimers();
      removeListeners(staticBindings);
      removeListeners(taskBindings);
      triggerElement = trigger || documentRef?.activeElement || null;
      storyId = "";
      taskIndex = 0;
      phaseIndex = 0;
      tasks = window.HFGenerationTasks?.createTaskSet?.(ageGroup, 3) || [];
      show("generating", true);
      setText(elements.title, "Мы создаём вашу историю…");
      setText(elements.error, "");
      setHidden(elements.open, true);
      setHidden(elements.retry, true);
      setHidden(elements.next, true);
      updatePhase();
      renderTask();
      phaseTimerId = window.setInterval(() => {
        phaseIndex = phases.length ? (phaseIndex + 1) % phases.length : 0;
        updatePhase();
      }, PHASE_INTERVAL_MS);
    }

    function setReady({ storyId: nextStoryId } = {}) {
      if (destroyed || !root) return;
      clearTimers();
      storyId = String(nextStoryId || "");
      show("ready", false);
      setText(elements.title, "Ваша сказка готова!");
      setHidden(elements.open, false);
      setHidden(elements.retry, true);
      setHidden(elements.taskPanel, true);
      phaseIndex = phases.length ? phases.length - 1 : 0;
      updatePhase();
      if (elements.open) elements.open.dataset.storyId = storyId;
      elements.open?.focus?.();
    }

    function setError({ message } = {}) {
      if (destroyed || !root) return;
      clearTimers();
      show("error", false);
      setText(elements.title, "Пока не получилось создать сказку");
      setText(elements.error, message || "Попробуйте ещё раз.");
      setHidden(elements.open, true);
      setHidden(elements.taskPanel, true);
      setHidden(elements.retry, false);
    }

    function openStory() {
      if (state !== "ready" || !storyId) return;
      const readyStoryId = storyId;
      hide();
      onOpenStory(readyStoryId);
    }

    function handleKeydown(event) {
      if (event.key === "Escape" && (state === "generating" || state === "ready")) {
        event.preventDefault();
        hide();
        return;
      }
      if (event.key !== "Tab") return;

      const focusableElements = findAll(FOCUSABLE_SELECTOR).filter(isFocusable);
      if (!focusableElements.length) {
        event.preventDefault();
        root.focus?.();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && documentRef.activeElement === first) {
        event.preventDefault();
        last.focus?.();
      } else if (!event.shiftKey && documentRef.activeElement === last) {
        event.preventDefault();
        first.focus?.();
      }
    }

    function hide() {
      if (!root) return;
      const previousState = state;
      clearTimers();
      removeListeners(staticBindings);
      removeListeners(taskBindings);
      root.hidden = true;
      body?.classList?.remove("create-overlay-open");
      open = false;
      if (triggerElement?.focus) triggerElement.focus();
      onHide({ state: previousState });
    }

    function destroy() {
      hide();
      destroyed = true;
      tasks = [];
      triggerElement = null;
    }

    function isOpen() {
      return open;
    }

    return { start, setReady, setError, hide, destroy, isOpen };
  }

  window.HFCreateStoryFlow = { create };
})(window);
