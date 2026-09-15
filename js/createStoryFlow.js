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
      taskImage: find("#generationTaskImage"),
      taskOptions: find("#generationTaskOptions"),
      feedback: find("#generationTaskFeedback"),
      selection: find("#generationTaskSelection"),
      illustrationProgress: find("#generationIllustrationProgress"),
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
    let ageGroup = "5-6";
    let recentTaskIds = [];
    let preloadedTask = null;
    let wrongAnswerCount = 0;
    let phaseIndex = 0;
    let storyId = "";
    let illustrationsPending = false;
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
        phase.classList?.toggle("is-complete", (state === "ready" && !illustrationsPending) || index < phaseIndex);
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

    function renderTaskCards(task) {
      if (!elements.taskCards || !elements.activeTaskCard) return;
      elements.taskCards.replaceChildren?.(elements.activeTaskCard);
    }

    function refreshTaskCards() {
      if ((state === "generating" || state === "ready") && tasks[taskIndex]) renderTaskCards(tasks[taskIndex]);
    }

    function renderTask() {
      removeListeners(taskBindings);
      const task = tasks[taskIndex];
      wrongAnswerCount = 0;
      setText(elements.feedback, "");
      setText(elements.selection, "");
      setText(elements.hint, "");
      setHidden(elements.hint, true);

      if (!task) {
        setHidden(elements.taskPanel, false);
        setHidden(elements.taskImage, true);
        elements.taskCards?.replaceChildren?.(elements.activeTaskCard);
        elements.taskOptions?.replaceChildren?.();
        setHidden(elements.skip, true);
        setHidden(elements.next, true);
        return;
      }

      setHidden(elements.taskPanel, false);
      setHidden(elements.skip, false);
      setHidden(elements.next, false);
      setText(elements.next, "Другая задачка");
      renderTaskCards(task);
      if (elements.taskImage) {
        elements.taskImage.src = task.image || "";
        elements.taskImage.alt = task.text ? `Задание: ${task.text}` : "Иллюстрация к заданию";
        setHidden(elements.taskImage, !task.image);
      }
      if (!elements.taskOptions) return;

      const answerButtons = (task.options || []).map((answer, index) => {
        const button = documentRef.createElement("button");
        button.type = "button";
        button.className = "generation-task-answer";
        button.dataset.answer = String(answer);
        button.textContent = String(answer);
        button.setAttribute("aria-label", `Выбрать вариант: ${answer}`);
        button.setAttribute("aria-pressed", "false");
        const bounds = task.answerBounds?.[index];
        if (bounds) {
          const [left, top, width, height] = bounds.map((value) => value / 3.2);
          button.setAttribute("style", `left:${left}%;top:${top}%;width:${width}%;height:${height}%`);
        }
        addListener(button, "click", () => answerTask(task, String(answer), button), taskBindings);
        return button;
      });
      elements.taskOptions.replaceChildren?.(...answerButtons);
    }

    function answerTask(task, answer, button) {
      if (state !== "generating" && state !== "ready") return;
      if (button?.disabled || task !== tasks[taskIndex]) return;
      Array.from(elements.taskOptions?.children || []).forEach((answerButton) => {
        answerButton.setAttribute("aria-pressed", String(answerButton === button));
        answerButton.classList?.remove("is-wrong", "is-correct");
      });
      setText(elements.selection, `Твой ответ: ${answer}`);
      const result = window.HFGenerationTasks?.checkAnswer?.(task, answer);
      if (result?.correct) {
        button?.classList?.add("is-correct");
        Array.from(elements.taskOptions?.children || []).forEach((answerButton) => { answerButton.disabled = true; });
        setText(elements.feedback, "Верно! ⭐");
        if (advanceTimerId) window.clearTimeout(advanceTimerId);
        advanceTimerId = window.setTimeout(() => {
          advanceTimerId = null;
          advanceTask();
        }, CORRECT_ANSWER_DELAY_MS);
        return;
      }

      wrongAnswerCount += 1;
      button?.classList?.add("is-wrong");
      setText(elements.feedback, "Попробуй ещё раз");
      if (wrongAnswerCount >= 2) {
        setText(elements.hint, result?.hint || task.hint || "");
        setHidden(elements.hint, false);
      }
    }

    function advanceTask() {
      if (state !== "generating" && state !== "ready") return;
      if (advanceTimerId) window.clearTimeout(advanceTimerId);
      advanceTimerId = null;
      selectNextTask();
    }

    function preloadNextTask() {
      if (preloadedTask || !window.HFGenerationTasks?.pickNextTask) return;
      preloadedTask = window.HFGenerationTasks.pickNextTask(ageGroup, recentTaskIds);
      if (!preloadedTask?.image || typeof window.Image !== "function") return;
      const image = new window.Image();
      image.src = preloadedTask.image;
    }

    function selectNextTask() {
      const nextTask = preloadedTask || window.HFGenerationTasks?.pickNextTask?.(ageGroup, recentTaskIds);
      if (!nextTask) {
        tasks = [];
        renderTask();
        return;
      }
      preloadedTask = null;
      tasks = [nextTask];
      taskIndex = 0;
      recentTaskIds = [...recentTaskIds, nextTask.id].slice(-2);
      renderTask();
      preloadNextTask();
    }

    function start({ ageGroup: requestedAgeGroup, trigger } = {}) {
      if (destroyed || !root) return;
      clearTimers();
      removeListeners(staticBindings);
      removeListeners(taskBindings);
      triggerElement = trigger || documentRef?.activeElement || null;
      storyId = "";
      illustrationsPending = false;
      taskIndex = 0;
      ageGroup = String(requestedAgeGroup || "5-6");
      recentTaskIds = [];
      preloadedTask = null;
      phaseIndex = 0;
      tasks = [];
      show("generating", true);
      setText(elements.title, "Мы создаём вашу историю…");
      setText(elements.error, "");
      setText(elements.illustrationProgress, "");
      setHidden(elements.open, true);
      setHidden(elements.retry, true);
      setHidden(elements.next, false);
      updatePhase();
      selectNextTask();
      phaseTimerId = window.setInterval(() => {
        const pendingPhaseCount = Math.max(phases.length - 1, 1);
        phaseIndex = phases.length ? (phaseIndex + 1) % pendingPhaseCount : 0;
        updatePhase();
      }, PHASE_INTERVAL_MS);
    }

    function setReady({ storyId: nextStoryId, illustrationsPending: nextIllustrationsPending = false } = {}) {
      if (destroyed || !root) return;
      clearTimers();
      storyId = String(nextStoryId || "");
      illustrationsPending = nextIllustrationsPending === true;
      show("ready", false);
      setText(elements.title, illustrationsPending ? "Текст готов — рисуем картинки…" : "Сказка готова!");
      setText(elements.illustrationProgress, illustrationsPending ? "Иллюстрации ещё создаются. Они появятся в сказке автоматически." : "");
      setHidden(elements.open, false);
      setHidden(elements.retry, true);
      setHidden(elements.taskPanel, false);
      setText(elements.open, illustrationsPending ? "Читать, пока рисуются картинки" : "Читать сказку");
      renderTask();
      phaseIndex = phases.length ? Math.max(0, phases.length - (illustrationsPending ? 2 : 1)) : 0;
      updatePhase();
      if (elements.open) elements.open.dataset.storyId = storyId;
      elements.open?.focus?.();
    }

    function setIllustrationProgress({ storyId: updatedStoryId, completed = 0, total = 0, failed = 0, finished = false, syncFailed = false } = {}) {
      if (destroyed || state !== "ready" || storyId !== updatedStoryId) return;
      if (syncFailed) {
        illustrationsPending = true;
        setText(elements.title, "Текст готов. Не удалось обновить картинки");
        setText(elements.illustrationProgress, `Готово картинок: ${completed} из ${total}. Не удалось загрузить обновления. Открой сказку, чтобы загрузить их снова.`);
        setText(elements.open, "Открыть сказку");
        return;
      }
      const allReady = finished && total > 0 && completed === total && failed === 0;
      illustrationsPending = !allReady;
      setText(elements.title, allReady ? "Сказка готова!" : finished ? "Текст готов. Не все картинки получились" : "Текст готов — рисуем картинки…");
      setText(elements.illustrationProgress, allReady
        ? `Все картинки готовы: ${completed} из ${total}.`
        : finished
          ? `Готово картинок: ${completed} из ${total}. Открой сказку и нажми «${completed > 0 ? "Дорисовать" : "Нарисовать"} иллюстрации», чтобы попробовать снова.`
          : `Готово картинок: ${completed} из ${total}. ${completed === total ? "Подготавливаем сказку к чтению." : "Остальные ещё рисуются."}`);
      setText(elements.open, allReady ? "Читать сказку" : finished ? "Читать готовый текст" : "Читать, пока рисуются картинки");
      phaseIndex = phases.length ? Math.max(0, phases.length - (allReady ? 1 : 2)) : 0;
      updatePhase();
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
      elements.retry?.focus?.();
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
      onHide({ state: previousState });
      if (triggerElement?.focus) triggerElement.focus();
    }

    function destroy() {
      hide();
      destroyed = true;
      tasks = [];
      recentTaskIds = [];
      preloadedTask = null;
      triggerElement = null;
    }

    function isOpen() {
      return open;
    }

    return { start, setReady, setIllustrationProgress, setError, hide, destroy, isOpen };
  }

  window.HFCreateStoryFlow = { create };
})(window);
