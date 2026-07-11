(function (window, document) {
  "use strict";

  const storyService = window.HFStoryService;
  const likeService = window.HFLikeService;
  const subscriptionService = window.HFSubscriptionService;
  const analyticsService = window.HFAnalyticsService;
  const supabaseService = window.HFSupabaseService;
  const appConfig = window.HFConfig || {};
  const { EVENTS, trackEvent } = analyticsService;
  const BACKEND_GENERATION_TIMEOUT_MS = 30000;

  const storyList = document.querySelector("#storyList");
  const libraryList = document.querySelector("#libraryList");
  const libraryStatus = document.querySelector("#libraryStatus");
  const librarySearchInput = document.querySelector("#librarySearchInput");
  const librarySortSelect = document.querySelector("#librarySortSelect");
  const filters = document.querySelector("#filters");
  const reader = document.querySelector("#reader");
  const slides = document.querySelector("#slides");
  const readerTitle = document.querySelector("#readerTitle");
  const readingProgress = document.querySelector("#readingProgress");
  const navTopButton = document.querySelector("#navTopButton");
  const navStoriesButton = document.querySelector("#navStoriesButton");
  const navGeneratorButton = document.querySelector("#navGeneratorButton");
  const navLibraryButton = document.querySelector("#navLibraryButton");
  const navAboutButton = document.querySelector("#navAboutButton");
  const chooseStoryButton = document.querySelector("#chooseStoryButton");
  const readFirstButton = document.querySelector("#readFirstButton");
  const openGeneratorButton = document.querySelector("#openGeneratorButton");
  const openLibraryButton = document.querySelector("#openLibraryButton");
  const openAboutButton = document.querySelector("#openAboutButton");
  const backToStoriesTop = document.querySelector("#backToStoriesTop");
  const readerLike = document.querySelector("#readerLike");
  const generatorForm = document.querySelector("#generatorForm");
  const generationStatus = document.querySelector("#generationStatus");
  const generationWaitPanel = document.querySelector("#generationWaitPanel");
  const generationWaitTitle = document.querySelector("#generationWaitTitle");
  const generationTaskText = document.querySelector("#generationTaskText");
  const generationTaskAnswer = document.querySelector("#generationTaskAnswer");
  const generationTaskFeedback = document.querySelector("#generationTaskFeedback");
  const checkGenerationTaskButton = document.querySelector("#checkGenerationTaskButton");
  const nextGenerationTaskButton = document.querySelector("#nextGenerationTaskButton");
  const subscriptionScreen = document.querySelector("#subscriptionScreen");
  const subscriptionTitle = document.querySelector("#subscriptionTitle");
  const subscriptionUsageText = document.querySelector("#subscriptionUsageText");
  const subscriptionPeriodText = document.querySelector("#subscriptionPeriodText");
  const subscriptionWarning = document.querySelector("#subscriptionWarning");
  const subscriptionFallbackNotice = document.querySelector("#subscriptionFallbackNotice");
  const activateSubscriptionButton = document.querySelector("#activateSubscriptionButton");
  const authPanel = document.querySelector("#authPanel");
  const authForm = document.querySelector("#authForm");
  const passwordResetForm = document.querySelector("#passwordResetForm");
  const cancelPasswordResetButton = document.querySelector("#cancelPasswordResetButton");
  const authStatus = document.querySelector("#authStatus");
  const accountEmailText = document.querySelector("#accountEmailText");
  const accountStorageText = document.querySelector("#accountStorageText");
  const accountTariffText = document.querySelector("#accountTariffText");
  const accountPaymentText = document.querySelector("#accountPaymentText");
  const authSessionActions = document.querySelector("#authSessionActions");
  const refreshAccountButton = document.querySelector("#refreshAccountButton");
  const signOutButton = document.querySelector("#signOutButton");
  const passwordToggleButtons = document.querySelectorAll("[data-password-toggle]");
  const storiesSection = document.querySelector("#stories");
  const generatorSection = document.querySelector("#generator");
  const librarySection = document.querySelector("#library");
  const aboutSection = document.querySelector("#about");
  const hero = document.querySelector(".hero");

  const moodLabels = {
    bedtime: "перед сном",
    adventure: "приключение",
    friendship: "про дружбу",
    bravery: "про смелость"
  };

  const moodTags = {
    bedtime: "bedtime",
    adventure: "adventure",
    friendship: "friendship",
    bravery: "bravery"
  };

  const moodColors = {
    bedtime: ["#9dccd8", "#f4d39a", "#6f9a67"],
    adventure: ["#cfeaf1", "#efd6a6", "#db7b3f"],
    friendship: ["#d9eac5", "#f8e9be", "#9fca84"],
    bravery: ["#f5c98d", "#d9eac5", "#c96d4a"]
  };

  const sceneSequences = {
    bedtime: ["cozy_house", "starry_sky", "forest_night", "warm_kitchen", "hill_clouds"],
    adventure: ["forest_day", "small_bridge", "river_bank", "mushroom_glade", "hill_clouds"],
    friendship: ["sunny_meadow", "sea_bench", "forest_day", "warm_kitchen", "starry_sky"],
    bravery: ["autumn_path", "rainy_forest", "small_bridge", "forest_night", "campfire_evening"]
  };

  let activeFilter = "all";
  let activeStory = null;
  let activeStoryFinishedTracked = false;
  let authNotice = { message: "", tone: "" };
  let passwordRecoverySession = null;
  let activeGenerationTask = null;
  let generationTaskTimerId = null;
  let generationProgressTimerId = null;
  let generationWaitStartedAt = 0;
  let librarySearchQuery = "";
  let librarySortMode = "newest";

  const generationWaitMessages = [
    "Ежонок собирает слова...",
    "Лисёнок выбирает тёплые картинки...",
    "Страницы складываются в сказку...",
    "Герои ищут добрый конец...",
    "История почти готова..."
  ];

  const missingLetterTasks = [
    { word: "л_са", answer: "и", hint: "рыжая лесная героиня" },
    { word: "ёж_к", answer: "и", hint: "маленький колючий друг" },
    { word: "м_ре", answer: "о", hint: "большая вода" },
    { word: "др_г", answer: "у", hint: "тот, кто рядом" },
    { word: "с_нце", answer: "о", hint: "светит утром" },
    { word: "зв_зда", answer: "е", hint: "горит в небе ночью" }
  ];

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function getSceneClass(sceneTag) {
    const safeTag = String(sceneTag || "forest_day").replace(/[^a-z0-9_-]/gi, "");
    return `scene-${safeTag || "forest_day"}`;
  }

  function getStorySceneTag(story) {
    return story.pages && story.pages[0] && story.pages[0].sceneTag
      ? story.pages[0].sceneTag
      : "forest_day";
  }

  function scrollToSection(section, eventName) {
    if (!section) return;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    if (eventName) trackEvent(eventName);
  }

  function focusPasswordResetForm() {
    if (!librarySection) return;

    window.setTimeout(() => {
      librarySection.scrollIntoView({ behavior: "smooth", block: "start" });
      const resetInput = document.querySelector("#newPassword");
      const resetFormVisible = passwordResetForm && !passwordResetForm.classList.contains("hidden");

      if (resetFormVisible && resetInput) {
        resetInput.focus({ preventScroll: true });
        return;
      }

      document.querySelector("#authEmail")?.focus({ preventScroll: true });
    }, 80);
  }

  function openAboutSection() {
    scrollToSection(aboutSection, EVENTS.ABOUT_OPENED);
  }

  function getTariffLabel(status) {
    if (status === "active") return "Семейный";
    if (status === "trial") return "Пробный";
    if (status === "expired") return "Истёк";
    return "Бесплатный";
  }

  function formatDate(value) {
    if (!value) return "";

    try {
      return new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(new Date(value));
    } catch (error) {
      return "";
    }
  }

  function getUsageText() {
    const subscription = subscriptionService.getSubscriptionState();
    const usage = subscriptionService.getGenerationUsage();

    return `Тариф: ${getTariffLabel(subscription.status)}. Использовано: ${usage.generationsUsed} из ${usage.generationLimit}.`;
  }

  function updateGenerationStatus(message = "") {
    if (!generationStatus) return;
    generationStatus.textContent = message || getUsageText();
  }

  function getRandomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pickRandom(items) {
    return items[getRandomInteger(0, items.length - 1)];
  }

  function normalizeTaskAnswer(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/ё/g, "е");
  }

  function buildArithmeticTask(ageGroup) {
    const isOlder = ageGroup === "8-10";
    const taskType = isOlder ? pickRandom(["addition", "subtraction", "multiplication"]) : pickRandom(["addition", "subtraction"]);

    if (taskType === "multiplication") {
      const left = getRandomInteger(2, 5);
      const right = getRandomInteger(2, 6);
      return {
        text: `Таблица умножения: сколько будет ${left} × ${right}?`,
        answer: String(left * right),
        success: "Верно! Таблица умножения помогла Лисёнку.",
        retry: "Почти. Попробуйте ещё раз."
      };
    }

    if (taskType === "subtraction") {
      const answer = getRandomInteger(2, isOlder ? 18 : 9);
      const right = getRandomInteger(1, isOlder ? 12 : 6);
      const left = answer + right;
      return {
        text: `Посчитайте: ${left} − ${right} = ?`,
        answer: String(answer),
        success: "Правильно! Ежонок аккуратно записал ответ.",
        retry: "Почти. Посчитайте ещё раз не спеша."
      };
    }

    const left = getRandomInteger(2, isOlder ? 24 : 9);
    const right = getRandomInteger(1, isOlder ? 18 : 8);
    return {
      text: `Посчитайте: ${left} + ${right} = ?`,
      answer: String(left + right),
      success: "Точно! Ещё одна страница стала ближе.",
      retry: "Почти. Попробуйте сложить ещё раз."
    };
  }

  function buildMissingLetterTask() {
    const task = pickRandom(missingLetterTasks);
    return {
      text: `Вставьте пропущенную букву: ${task.word}. Подсказка: ${task.hint}.`,
      answer: task.answer,
      success: "Верно! Слово снова целое.",
      retry: "Почти. Нужна одна буква."
    };
  }

  function buildGenerationTask(formData = null) {
    const ageGroup = formData ? getFormValue(formData, "ageGroup", "5-7") : "5-7";
    return Math.random() < 0.68 ? buildArithmeticTask(ageGroup) : buildMissingLetterTask();
  }

  function renderGenerationTask(task) {
    activeGenerationTask = task;

    if (generationTaskText) {
      generationTaskText.textContent = task.text;
    }

    if (generationTaskAnswer) {
      generationTaskAnswer.value = "";
    }

    if (generationTaskFeedback) {
      generationTaskFeedback.textContent = "";
    }
  }

  function updateGenerationWaitTitle() {
    if (!generationWaitTitle || !generationWaitStartedAt) return;

    const elapsedSeconds = Math.max(0, Math.round((Date.now() - generationWaitStartedAt) / 1000));
    const messageIndex = Math.floor(elapsedSeconds / 12) % generationWaitMessages.length;
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = String(elapsedSeconds % 60).padStart(2, "0");

    generationWaitTitle.textContent = `${generationWaitMessages[messageIndex]} ${minutes}:${seconds}`;
  }

  function startGenerationWaiting(formData) {
    if (!generationWaitPanel) return;

    generationWaitStartedAt = Date.now();
    generationWaitPanel.classList.remove("hidden");
    renderGenerationTask(buildGenerationTask(formData));
    updateGenerationWaitTitle();

    window.clearInterval(generationTaskTimerId);
    window.clearInterval(generationProgressTimerId);
    generationTaskTimerId = window.setInterval(() => {
      renderGenerationTask(buildGenerationTask(formData));
    }, 18000);
    generationProgressTimerId = window.setInterval(updateGenerationWaitTitle, 1000);
  }

  function stopGenerationWaiting() {
    window.clearInterval(generationTaskTimerId);
    window.clearInterval(generationProgressTimerId);
    generationTaskTimerId = null;
    generationProgressTimerId = null;
    generationWaitStartedAt = 0;
    activeGenerationTask = null;
    generationWaitPanel?.classList.add("hidden");
  }

  function checkGenerationTaskAnswer() {
    if (!activeGenerationTask || !generationTaskAnswer || !generationTaskFeedback) return;

    const answer = normalizeTaskAnswer(generationTaskAnswer.value);
    const expected = normalizeTaskAnswer(activeGenerationTask.answer);

    if (!answer) {
      generationTaskFeedback.textContent = "Введите ответ.";
      return;
    }

    generationTaskFeedback.textContent = answer === expected ? activeGenerationTask.success : activeGenerationTask.retry;
  }

  function getStorageStatusText() {
    const storageState = storyService.getUserStoriesStorageState();

    if (storageState.mode === "supabase") {
      return "Истории синхронизируются с Supabase.";
    }

    if (storageState.mode === "local_fallback") {
      return `Supabase временно недоступен, используется localStorage. ${storageState.lastError || ""}`.trim();
    }

    return "Истории сохраняются на этом устройстве.";
  }

  function getShortStorageStatusText(storageState) {
    if (storageState.mode === "supabase") return "Supabase";
    if (storageState.mode === "local_fallback") return "Локально, Supabase недоступен";
    return "На этом устройстве";
  }

  function renderAccountSummary() {
    const authState = supabaseService?.getAuthState?.() || { status: "disabled" };
    const user = authState.user || authState.session?.user || null;
    const storageState = storyService.getUserStoriesStorageState();
    const subscription = subscriptionService.getSubscriptionState();
    const usage = subscriptionService.getGenerationUsage();
    const isSignedIn = authState.status === "signed_in" && user?.email;

    if (accountEmailText) {
      accountEmailText.textContent = isSignedIn ? user.email : "Гость";
    }

    if (accountStorageText) {
      accountStorageText.textContent = getShortStorageStatusText(storageState);
    }

    if (accountTariffText) {
      accountTariffText.textContent = `${getTariffLabel(subscription.status)}: ${usage.generationsUsed}/${usage.generationLimit}`;
    }

    if (accountPaymentText) {
      accountPaymentText.textContent = "YooKassa отложена";
    }
  }

  function setAuthNotice(message = "", tone = "") {
    authNotice = { message, tone };
  }

  function getAuthErrorMessage(error, action) {
    const rawMessage = String(error?.message || "").toLowerCase();
    const rawDetails = JSON.stringify(error?.details || {}).toLowerCase();
    const source = `${rawMessage} ${rawDetails}`;

    if (source.includes("email not confirmed")) {
      return "Почта ещё не подтверждена. Откройте письмо от Ежонка и Лисёнка и перейдите по ссылке подтверждения.";
    }

    if (source.includes("invalid login credentials") || source.includes("invalid credentials")) {
      return "Не удалось войти. Проверьте email и пароль.";
    }

    if (source.includes("user already registered") || source.includes("already registered")) {
      return "Аккаунт с такой почтой уже есть. Попробуйте войти или восстановить доступ через Supabase.";
    }

    if (source.includes("password") && source.includes("six")) {
      return "Пароль должен быть не короче 6 символов.";
    }

    if (source.includes("new password should be different")) {
      return "Новый пароль должен отличаться от старого.";
    }

    if (source.includes("signup") && source.includes("disabled")) {
      return "Регистрация временно выключена в настройках Supabase.";
    }

    if (source.includes("rate limit") || source.includes("too many")) {
      return "Слишком много попыток. Подождите немного и попробуйте ещё раз.";
    }

    if (source.includes("failed to fetch") || source.includes("network")) {
      return "Не удалось связаться с Supabase. Проверьте интернет и попробуйте ещё раз.";
    }

    if (action === "recover") {
      return "Не удалось отправить письмо восстановления. Проверьте email и попробуйте ещё раз.";
    }

    return action === "signup"
      ? "Не удалось зарегистрироваться. Проверьте email и пароль, затем попробуйте ещё раз."
      : "Не удалось войти. Проверьте email и пароль, затем попробуйте ещё раз.";
  }

  function setAuthFormBusy(isBusy) {
    if (!authForm) return;

    authForm.querySelectorAll("input, button").forEach((element) => {
      element.disabled = isBusy;
    });
    passwordResetForm?.querySelectorAll("input, button").forEach((element) => {
      element.disabled = isBusy;
    });
    authSessionActions?.querySelectorAll("button").forEach((element) => {
      element.disabled = isBusy;
    });
  }

  function handlePasswordToggle(event) {
    const button = event.currentTarget;
    const inputId = button.dataset.passwordToggle;
    const input = inputId ? document.getElementById(inputId) : null;

    if (!input) return;

    const shouldShow = input.type === "password";
    input.type = shouldShow ? "text" : "password";
    button.textContent = shouldShow ? "Скрыть" : "Показать";
    button.setAttribute("aria-label", shouldShow ? "Скрыть пароль" : "Показать пароль");
    button.setAttribute("aria-pressed", String(shouldShow));
  }

  function renderAuthPanel() {
    if (!authPanel || !authStatus) return;

    const authState = supabaseService?.getAuthState?.() || { status: "disabled" };
    const user = authState.user || authState.session?.user || null;
    const storageState = storyService.getUserStoriesStorageState();
    const isSignedIn = authState.status === "signed_in" && user?.email;
    const isPasswordRecovery = Boolean(passwordRecoverySession);
    const hasFallback = storageState.mode === "local_fallback";

    renderAccountSummary();
    authStatus.classList.remove("success", "warning");

    if (!supabaseService?.isEnabled?.()) {
      authForm?.classList.add("hidden");
      passwordResetForm?.classList.add("hidden");
      authSessionActions?.classList.add("hidden");
      authStatus.textContent = "Supabase выключен в конфиге. Истории сохраняются локально.";
      authStatus.classList.add("warning");
      return;
    }

    if (isPasswordRecovery) {
      authForm?.classList.add("hidden");
      passwordResetForm?.classList.remove("hidden");
      authSessionActions?.classList.add("hidden");

      if (authNotice.message) {
        authStatus.textContent = authNotice.message;
        if (authNotice.tone) authStatus.classList.add(authNotice.tone);
        return;
      }

      authStatus.textContent = "Введите новый пароль для аккаунта.";
      authStatus.classList.add("warning");
      return;
    }

    if (isSignedIn) {
      authForm?.classList.add("hidden");
      passwordResetForm?.classList.add("hidden");
      authSessionActions?.classList.remove("hidden");
      authStatus.textContent = hasFallback
        ? `Вы вошли как ${user.email}, но Supabase сейчас недоступен. Истории временно сохраняются локально.`
        : `Вы вошли как ${user.email}. ${getStorageStatusText()}`;
      authStatus.classList.add(hasFallback ? "warning" : "success");
      return;
    }

    authForm?.classList.remove("hidden");
    passwordResetForm?.classList.add("hidden");
    authSessionActions?.classList.add("hidden");

    if (authNotice.message) {
      authStatus.textContent = authNotice.message;
      if (authNotice.tone) authStatus.classList.add(authNotice.tone);
      return;
    }

    if (authState.status === "pending_confirmation") {
      authStatus.textContent = "Регистрация создана. Проверьте почту и подтвердите email, если Supabase требует подтверждение.";
      authStatus.classList.add("warning");
      return;
    }

    authStatus.textContent = `Без входа ${getStorageStatusText()}`;
  }

  function showSubscriptionScreen() {
    subscriptionScreen?.classList.remove("hidden");
    if (subscriptionWarning) {
      subscriptionWarning.classList.remove("hidden");
      subscriptionWarning.textContent =
        "Лимит бесплатных историй исчерпан. Чтобы создавать больше историй, активируйте mock-подписку.";
    }
    updateGenerationStatus("Лимит бесплатных историй исчерпан.");
    renderSubscriptionPanel();
    subscriptionScreen?.scrollIntoView({ behavior: "smooth", block: "center" });
    trackEvent(EVENTS.SUBSCRIPTION_SCREEN_OPENED, subscriptionService.getGenerationUsage());
  }

  function hideSubscriptionScreen() {
    if (subscriptionWarning) {
      subscriptionWarning.classList.add("hidden");
      subscriptionWarning.textContent = "";
    }
    renderSubscriptionPanel();
  }

  function renderSubscriptionPanel() {
    if (!subscriptionScreen) return;

    const subscription = subscriptionService.getSubscriptionState();
    const usage = subscriptionService.getGenerationUsage();
    const storageState = subscriptionService.getStorageState?.() || { mode: "local" };
    const periodEnd = usage.periodEnd || subscription.currentPeriodEnd;
    const periodText = formatDate(periodEnd);

    if (subscriptionTitle) {
      subscriptionTitle.textContent = `Ваш тариф: ${getTariffLabel(subscription.status)}`;
    }

    if (subscriptionUsageText) {
      subscriptionUsageText.textContent = `Использовано: ${usage.generationsUsed} из ${usage.generationLimit} историй.`;
    }

    if (subscriptionPeriodText) {
      subscriptionPeriodText.textContent = periodText ? `Период до: ${periodText}.` : "Период будет создан при первой синхронизации.";
    }

    if (subscriptionFallbackNotice) {
      const isFallback = storageState.mode === "local_fallback";
      subscriptionFallbackNotice.classList.toggle("hidden", !isFallback);
      subscriptionFallbackNotice.textContent = isFallback
        ? "Облачная подписка временно недоступна. Лимиты применяются только на этом устройстве."
        : "";
    }

    renderAccountSummary();
  }

  function renderLikeButton(story, variant = "") {
    const liked = likeService.isStoryLiked(story.id);
    const variantClass = variant ? ` ${variant}` : "";

    return `
      <button
        class="like-button${variantClass} ${liked ? "liked" : ""}"
        type="button"
        data-like="${escapeAttribute(story.id)}"
        aria-pressed="${liked}"
        aria-label="${liked ? "Убрать лайк" : "Поставить лайк"}: ${escapeAttribute(story.title)}"
      >
        <span class="like-icon" aria-hidden="true">${liked ? "♥" : "♡"}</span>
        <span class="like-text">Нравится</span>
        <span class="like-count">${likeService.getStoryLikeCount(story)}</span>
      </button>
    `;
  }

  function renderStoryArt(story) {
    const sceneTag = getStorySceneTag(story);

    if (story.imageUrl) {
      return `<img src="${escapeAttribute(story.imageUrl)}" alt="" loading="lazy" />`;
    }

    if (story.source === "user" && story.useIllustrations !== false) {
      return `<div class="story-scene-preview ${getSceneClass(sceneTag)}" aria-hidden="true"></div>`;
    }

    return "";
  }

  function renderStoryCard(story, options = {}) {
    const [top, mid, bottom] = story.colors;
    const sourcePill = story.source === "user" ? `<span class="pill user-pill">Моя история</span>` : "";
    const deleteButton = options.canDelete
      ? `<button class="button quiet" data-delete-story="${escapeAttribute(story.id)}" type="button">Удалить</button>`
      : "";

    return `
      <article class="story-card" style="--wash-color: ${top}88;">
        <div
          class="story-art ${story.imageUrl ? "has-image" : ""}"
          style="--art-top: ${top}; --art-mid: ${mid}; --art-bottom: ${bottom};"
          role="img"
          aria-label="Иллюстрация к истории ${escapeAttribute(story.title)}"
        >
          ${renderStoryArt(story)}
        </div>
        <div class="story-content">
          <h3>${escapeHtml(story.title)}</h3>
          <div class="story-meta">
            <span class="pill">${escapeHtml(story.age)} лет</span>
            <span class="pill">${escapeHtml(story.time)}</span>
            ${sourcePill}
            ${renderLikeButton(story, "compact")}
          </div>
          <p>${escapeHtml(story.description)}</p>
          <div class="card-actions">
            <button class="button primary" data-read="${escapeAttribute(story.id)}" type="button">Читать</button>
            ${deleteButton}
          </div>
        </div>
      </article>
    `;
  }

  function getLibrarySearchText(story) {
    return [
      story.title,
      story.description,
      story.lesson,
      story.mood,
      story.age,
      ...(story.tags || [])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function getStoryCreatedAtTime(story) {
    const time = new Date(story.createdAt || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function getVisibleLibraryStories(userStories) {
    const query = librarySearchQuery.trim().toLowerCase();
    const visibleStories = query
      ? userStories.filter((story) => getLibrarySearchText(story).includes(query))
      : [...userStories];

    return visibleStories.sort((left, right) => {
      if (librarySortMode === "oldest") {
        return getStoryCreatedAtTime(left) - getStoryCreatedAtTime(right);
      }

      if (librarySortMode === "title") {
        return String(left.title || "").localeCompare(String(right.title || ""), "ru");
      }

      return getStoryCreatedAtTime(right) - getStoryCreatedAtTime(left);
    });
  }

  function renderLibraryEmptyState({ hasStories, storageText }) {
    const title = hasStories ? "Истории не найдены" : "В библиотеке пока пусто";
    const description = hasStories
      ? "Попробуйте изменить поисковый запрос или сбросить поле поиска."
      : `Создайте первую историю, и она появится здесь. ${storageText}`;
    const action = hasStories
      ? `<button class="button secondary" data-clear-library-search type="button">Сбросить поиск</button>`
      : `<button class="button primary" data-library-create-story type="button">Создать историю</button>`;

    return `
      <article class="library-empty">
        <p class="eyebrow">Моя библиотека</p>
        <h3>${title}</h3>
        <p>${escapeHtml(description)}</p>
        ${action}
      </article>
    `;
  }

  function renderReaderLike() {
    if (!readerLike) return;
    readerLike.innerHTML = activeStory ? renderLikeButton(activeStory) : "";
  }

  function renderStories() {
    const visibleStories = storyService.getAllStories().filter((story) => {
      return activeFilter === "all" || story.tags.includes(activeFilter);
    });

    storyList.innerHTML = visibleStories.map((story) => renderStoryCard(story)).join("");
  }

  function renderLibrary() {
    const userStories = storyService.getUserStories();
    const visibleStories = getVisibleLibraryStories(userStories);
    const storageText = getStorageStatusText();
    const searchText = librarySearchQuery.trim();

    if (librarySearchInput && librarySearchInput.value !== librarySearchQuery) {
      librarySearchInput.value = librarySearchQuery;
    }

    if (librarySortSelect && librarySortSelect.value !== librarySortMode) {
      librarySortSelect.value = librarySortMode;
    }

    libraryStatus.textContent = userStories.length
      ? `${visibleStories.length} из ${userStories.length} историй. ${storageText} ${getUsageText()}`
      : `Пока нет пользовательских историй. ${storageText} ${getUsageText()}`;

    if (!visibleStories.length) {
      libraryList.innerHTML = renderLibraryEmptyState({
        hasStories: Boolean(userStories.length || searchText),
        storageText
      });
    } else {
      libraryList.innerHTML = visibleStories
        .map((story) => renderStoryCard(story, { canDelete: true }))
        .join("");
    }

    renderAccountSummary();
  }

  function renderAllStoryLists() {
    renderStories();
    renderLibrary();
    renderSubscriptionPanel();
  }

  function setFilter(filter) {
    activeFilter = filter;
    document.querySelectorAll(".filter-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.filter === filter);
    });
    renderStories();
  }

  async function handleStoryLike(storyId) {
    const wasLiked = likeService.isStoryLiked(storyId);

    try {
      const isLiked = await likeService.toggleStoryLike(storyId);

      renderAllStoryLists();
      renderReaderLike();
      trackEvent(isLiked ? EVENTS.STORY_LIKED : EVENTS.STORY_UNLIKED, {
        storyId,
        wasLiked
      });
    } catch (error) {
      console.warn("[app] Cannot toggle story like", error);
      renderAllStoryLists();
      renderReaderLike();
    }
  }

  function renderPageIllustration(page, storyTitle) {
    if (page.imageUrl) {
      const fallbackHandler = page.fallbackImageUrl
        ? `this.onerror=null; this.src='${escapeAttribute(page.fallbackImageUrl)}';`
        : "this.remove();";

      return `
        <img
          class="reader-illustration"
          src="${escapeAttribute(page.imageUrl)}"
          alt="Иллюстрация к истории ${escapeAttribute(storyTitle)}, страница ${page.pageNumber}"
          onerror="${fallbackHandler}"
        />
      `;
    }

    if (page.useSceneIllustration) {
      return `
        <div
          class="reader-illustration scene-illustration ${getSceneClass(page.sceneTag)}"
          role="img"
          aria-label="Акварельная сцена к странице ${page.pageNumber}"
        ></div>
      `;
    }

    return "";
  }

  function openStory(storyId) {
    const story = storyService.getStoryById(storyId);
    if (!story) return;

    activeStory = storyService.prepareStoryForReader(story);
    activeStoryFinishedTracked = false;
    readerTitle.textContent = activeStory.title;
    renderReaderLike();
    document.body.classList.add("reading");
    hero.classList.add("hidden");
    storiesSection.classList.add("hidden");
    generatorSection.classList.add("hidden");
    librarySection.classList.add("hidden");
    aboutSection.classList.add("hidden");
    reader.classList.remove("hidden");

    const [top, mid, bottom] = activeStory.colors;
    const storySlides = activeStory.readerPages
      .map((page) => {
        const illustration = renderPageIllustration(page, activeStory.title);
        const illustrationClass = illustration ? " with-illustration" : "";

        return `
          <article
            class="slide"
            style="--slide-top: ${top}; --slide-wash: ${mid}99;"
          >
            <div class="slide-scene" aria-hidden="true"></div>
            <div class="slide-card${illustrationClass}">
              <span class="slide-kicker">${page.pageNumber} из ${activeStory.readerPages.length}</span>
              ${illustration}
              <p class="slide-text">${escapeHtml(page.text)}</p>
            </div>
            <div class="slide-hint">Листай дальше</div>
          </article>
        `;
      })
      .join("");

    slides.innerHTML = `
      ${storySlides}
      <article class="slide end-slide" style="--slide-top: ${bottom}; --slide-wash: ${top}99;">
        <div class="slide-scene" aria-hidden="true"></div>
        <div class="slide-card">
          <span class="slide-kicker">Конец истории</span>
          <p class="slide-text">Спасибо, что читали вместе с Ежонком и Лисёнком.</p>
          <div class="end-like">${renderLikeButton(activeStory)}</div>
          <div class="end-actions">
            <button class="button secondary" id="backToStoriesEnd">Вернуться к историям</button>
            <button class="button primary" id="readAnother">Читать другую</button>
          </div>
        </div>
      </article>
    `;

    slides.scrollTop = 0;
    updateProgress();
    trackEvent(EVENTS.STORY_OPENED, {
      storyId: activeStory.id,
      title: activeStory.title,
      source: activeStory.source
    });
  }

  function closeReader() {
    activeStory = null;
    activeStoryFinishedTracked = false;
    renderReaderLike();
    document.body.classList.remove("reading");
    reader.classList.add("hidden");
    hero.classList.remove("hidden");
    storiesSection.classList.remove("hidden");
    generatorSection.classList.remove("hidden");
    librarySection.classList.remove("hidden");
    aboutSection.classList.remove("hidden");
    readingProgress.style.width = "0%";
    storiesSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateProgress() {
    const scrollable = slides.scrollHeight - slides.clientHeight;
    const progress = scrollable <= 0 ? 0 : (slides.scrollTop / scrollable) * 100;
    readingProgress.style.width = `${Math.min(100, Math.max(0, progress))}%`;

    if (activeStory && !activeStoryFinishedTracked && progress >= 98) {
      activeStoryFinishedTracked = true;
      trackEvent(EVENTS.STORY_FINISHED, {
        storyId: activeStory.id,
        title: activeStory.title,
        source: activeStory.source
      });
    }
  }

  function getFormValue(formData, key, fallback) {
    const value = String(formData.get(key) || "").trim();
    return value || fallback;
  }

  function capitalize(value) {
    return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
  }

  function getMockPageText({ topic, mood, lesson, pageNumber, pageCount }) {
    const isLastPage = pageNumber === pageCount;
    const moodLabel = moodLabels[mood] || moodLabels.bedtime;

    if (pageNumber === 1) {
      return `Ежонок и Лисёнок нашли маленькую подсказку про ${topic}. Она лежала тихо-тихо, будто ждала именно их, и звала друзей в историю ${moodLabel}.`;
    }

    if (isLastPage) {
      return `Когда путь закончился, Ежонок улыбнулся, а Лисёнок мягко махнул хвостом. Друзья поняли главное: ${lesson}.`;
    }

    if (mood === "bravery") {
      return `На странице ${pageNumber} Ежонку стало немного тревожно, но Лисёнок шёл рядом. Они сделали один маленький смелый шаг и увидели, что ${topic} совсем не страшная.`;
    }

    if (mood === "friendship") {
      return `На странице ${pageNumber} друзья помогали друг другу: Ежонок замечал детали, а Лисёнок смело искал дорогу. Так ${topic} становилась теплее и понятнее.`;
    }

    if (mood === "adventure") {
      return `На странице ${pageNumber} тропинка повернула за травы и камушки. Ежонок задавал вопросы, Лисёнок проверял путь, и ${topic} открывала новый добрый секрет.`;
    }

    return `На странице ${pageNumber} вечер становился мягче. Ежонок слушал тишину, Лисёнок берёг тёплый свет, и ${topic} укладывалась в спокойную сказку.`;
  }

  function buildMockStory(formData) {
    const topic = getFormValue(formData, "topic", "маленькое приключение");
    const ageGroup = getFormValue(formData, "ageGroup", "5-7");
    const mood = getFormValue(formData, "mood", "bedtime");
    const lesson = getFormValue(formData, "lesson", "доброта становится сильнее, когда ей делятся");
    const pageCount = Number(getFormValue(formData, "pageCount", "3"));
    const useIllustrations = getFormValue(formData, "illustrations", "yes") === "yes";
    const scenes = sceneSequences[mood] || sceneSequences.bedtime;
    const pages = Array.from({ length: pageCount }, (_, index) => {
      const pageNumber = index + 1;
      const sceneTag = scenes[index % scenes.length];

      return {
        pageNumber,
        text: getMockPageText({ topic, mood, lesson, pageNumber, pageCount }),
        sceneTag,
        imagePrompt: `Нежная акварельная сцена: Ежонок и Лисёнок, ${topic}, ${moodLabels[mood]}, страница ${pageNumber}`
      };
    });

    return {
      id: `user-story-${Date.now()}`,
      title: `Ежонок, Лисёнок и ${capitalize(topic)}`,
      age: ageGroup.replace("-", "–"),
      ageGroup,
      mood: moodLabels[mood],
      lesson,
      time: `${pageCount + 2} минут`,
      tags: Array.from(new Set([ageGroup, moodTags[mood]].filter(Boolean))),
      imageUrl: "",
      baseLikes: 0,
      colors: moodColors[mood] || moodColors.bedtime,
      description: `Пользовательская история про ${topic}, где друзья узнают: ${lesson}.`,
      pages,
      slides: pages.map((page) => page.text),
      useIllustrations,
      createdAt: new Date().toISOString()
    };
  }

  function getGenerationRequestPayload(formData) {
    return {
      topic: getFormValue(formData, "topic", "маленькое приключение"),
      ageGroup: getFormValue(formData, "ageGroup", "5-7"),
      mood: getFormValue(formData, "mood", "bedtime"),
      lesson: getFormValue(formData, "lesson", "доброта становится сильнее, когда ей делятся"),
      pageCount: Number(getFormValue(formData, "pageCount", "3"))
    };
  }

  function getStoryFromBackendResponse(payload, formData) {
    const backendStory = payload?.story;
    if (!backendStory || !Array.isArray(backendStory.pages)) {
      throw new Error("Backend returned an invalid story");
    }

    const mood = getFormValue(formData, "mood", "bedtime");
    const useIllustrations = getFormValue(formData, "illustrations", "yes") === "yes";
    const pages = backendStory.pages.map((page, index) => ({
      pageNumber: Number(page.pageNumber || index + 1),
      text: page.text || "",
      sceneTag: page.sceneTag || "forest_day",
      imagePrompt: page.imagePrompt || ""
    }));

    return {
      id: backendStory.id || `backend-story-${Date.now()}`,
      title: backendStory.title || "Новая история",
      age: (backendStory.ageGroup || "5-7").replace("-", "–"),
      ageGroup: backendStory.ageGroup || "5-7",
      mood: backendStory.mood || moodLabels[mood] || moodLabels.bedtime,
      lesson: backendStory.lesson || getFormValue(formData, "lesson", ""),
      time: `${pages.length + 2} минут`,
      tags: Array.from(new Set([backendStory.ageGroup || "5-7", moodTags[mood]].filter(Boolean))),
      imageUrl: "",
      baseLikes: 0,
      colors: moodColors[mood] || moodColors.bedtime,
      description: backendStory.lesson
        ? `Пользовательская история, где друзья узнают: ${backendStory.lesson}.`
        : "Пользовательская история про Ежонка и Лисёнка.",
      pages,
      slides: pages.map((page) => page.text),
      useIllustrations,
      createdAt: new Date().toISOString()
    };
  }

  function getBackendGenerationLabel(meta) {
    if (meta?.mode === "ai") return "backend ai";
    if (meta?.mode === "mock-fallback") return "backend mock-fallback";
    if (meta?.mode === "mock") return "backend mock";
    return "backend";
  }

  function canUseGenerationApi() {
    return Boolean(appConfig.GENERATION_API_ENABLED && appConfig.GENERATION_API_URL);
  }

  function isBackendUnavailableError(error) {
    return Boolean(error?.isBackendUnavailable);
  }

  async function requestBackendStory(formData) {
    if (!canUseGenerationApi()) {
      const error = new Error("Generation API is disabled");
      error.isBackendUnavailable = true;
      throw error;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), BACKEND_GENERATION_TIMEOUT_MS);
    const session = await supabaseService?.ensureFreshSession?.();
    const accessToken = session?.access_token || "";

    if (!accessToken) {
      const error = new Error("Backend generation requires an authenticated user");
      error.isBackendUnavailable = true;
      throw error;
    }

    try {
      const response = await window.fetch(appConfig.GENERATION_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify(getGenerationRequestPayload(formData)),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.details?.[0] || payload?.message || payload?.error || "Backend generation failed";
        const error = new Error(message);
        error.status = response.status;
        error.isBackendUnavailable = response.status === 404 || response.status >= 500;
        throw error;
      }

      return {
        story: getStoryFromBackendResponse(payload, formData),
        meta: payload?.meta || {}
      };
    } catch (error) {
      if (error.name === "AbortError" || error instanceof TypeError) {
        error.isBackendUnavailable = true;
      }

      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function generateStory(formData) {
    if (!canUseGenerationApi()) {
      return {
        story: buildMockStory(formData),
        mode: "browser-mock",
        label: "локальный mock"
      };
    }

    try {
      const backendResult = await requestBackendStory(formData);

      return {
        story: backendResult.story,
        mode: `backend-${backendResult.meta?.mode || "unknown"}`,
        label: getBackendGenerationLabel(backendResult.meta)
      };
    } catch (error) {
      if (!isBackendUnavailableError(error)) {
        throw error;
      }

      console.warn("[app] Backend generation unavailable, using browser mock", error);
      return {
        story: buildMockStory(formData),
        mode: "browser-mock-fallback",
        label: "локальный mock, backend временно недоступен"
      };
    }
  }

  async function handleGeneratorSubmit(event) {
    event.preventDefault();

    if (!subscriptionService.canGenerateStory()) {
      showSubscriptionScreen();
      return;
    }

    const formData = new FormData(generatorForm);

    try {
      updateGenerationStatus("Создаю историю...");
      startGenerationWaiting(formData);
      const generated = await generateStory(formData);
      const story = generated.story;
      const isBackendGenerated = generated.mode.startsWith("backend-");

      updateGenerationStatus(
        isBackendGenerated ? "Обновляю библиотеку..." : "Сохраняю историю..."
      );
      let savedStory = story;

      if (isBackendGenerated) {
        await storyService.initializeUserStories();
        await subscriptionService.initializeSubscription();
        savedStory = storyService.getStoryById(story.id) || story;
      } else {
        savedStory = await storyService.saveUserStory(story);
        await subscriptionService.incrementGenerationUsage();
      }

      const storageState = storyService.getUserStoriesStorageState();
      hideSubscriptionScreen();
      updateGenerationStatus(
        storageState.mode === "supabase"
          ? `История создана: ${generated.label}. Сохранена в Supabase.`
          : `История создана: ${generated.label}. Сохранена локально.`
      );
      renderSubscriptionPanel();
      renderAuthPanel();
      renderAllStoryLists();
      generatorForm.reset();
      librarySection.scrollIntoView({ behavior: "smooth", block: "start" });
      trackEvent(EVENTS.STORY_GENERATED_MOCK, {
        storyId: savedStory.id,
        pageCount: savedStory.pages.length,
        mood: savedStory.mood
      });
    } catch (error) {
      console.warn("[app] Cannot save generated story", error);
      updateGenerationStatus(`Не удалось создать историю: ${error.message || "ошибка"}`);
      renderAuthPanel();
    } finally {
      stopGenerationWaiting();
    }
  }

  function handleStoryListClick(event) {
    const likeButton = event.target.closest("[data-like]");
    if (likeButton) {
      handleStoryLike(likeButton.dataset.like);
      return;
    }

    const readButton = event.target.closest("[data-read]");
    if (readButton) {
      openStory(readButton.dataset.read);
    }
  }

  async function handleLibraryClick(event) {
    const createStoryButton = event.target.closest("[data-library-create-story]");
    if (createStoryButton) {
      scrollToSection(generatorSection, EVENTS.GENERATOR_OPENED);
      return;
    }

    const clearSearchButton = event.target.closest("[data-clear-library-search]");
    if (clearSearchButton) {
      librarySearchQuery = "";
      renderLibrary();
      librarySearchInput?.focus();
      return;
    }

    const deleteButton = event.target.closest("[data-delete-story]");
    if (deleteButton) {
      deleteButton.disabled = true;

      try {
        await storyService.deleteUserStory(deleteButton.dataset.deleteStory);
        renderAuthPanel();
        renderAllStoryLists();
        updateGenerationStatus();
      } catch (error) {
        console.warn("[app] Cannot delete user story", error);
        renderAuthPanel();
        libraryStatus.textContent = `Не удалось удалить историю: ${error.message || "ошибка Supabase"}`;
      } finally {
        deleteButton.disabled = false;
      }

      return;
    }

    handleStoryListClick(event);
  }

  function handleLibrarySearchInput(event) {
    librarySearchQuery = String(event.target.value || "");
    renderLibrary();
  }

  function handleLibrarySortChange(event) {
    librarySortMode = String(event.target.value || "newest");
    renderLibrary();
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!supabaseService?.isEnabled?.()) return;

    const formData = new FormData(authForm);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const action = event.submitter?.dataset.authAction || "signin";

    if (!email) {
      setAuthNotice("Введите email.", "warning");
      renderAuthPanel();
      return;
    }

    if (!authForm.elements.email.checkValidity()) {
      setAuthNotice("Введите корректный email.", "warning");
      renderAuthPanel();
      return;
    }

    if (action !== "recover" && !password) {
      setAuthNotice("Введите email и пароль.", "warning");
      renderAuthPanel();
      return;
    }

    setAuthFormBusy(true);
    setAuthNotice(
      action === "recover"
        ? "Отправляю письмо для восстановления пароля..."
        : action === "signup"
          ? "Создаю аккаунт..."
          : "Выполняю вход...",
      ""
    );
    renderAuthPanel();

    try {
      if (action === "recover") {
        await supabaseService.requestPasswordRecovery(email);
        setAuthNotice(
          "Письмо для восстановления пароля отправлено. Откройте ссылку из письма: сайт покажет форму нового пароля в блоке аккаунта.",
          "success"
        );
      } else if (action === "signup") {
        const authState = await supabaseService.signUpWithPassword(email, password);
        setAuthNotice(
          authState.status === "pending_confirmation"
            ? "Регистрация создана. Проверьте почту и перейдите по ссылке подтверждения."
            : "Аккаунт создан, вход выполнен.",
          authState.status === "pending_confirmation" ? "warning" : "success"
        );
      } else {
        await supabaseService.signInWithPassword(email, password);
        setAuthNotice("Вход выполнен.", "success");
      }

      if (action !== "recover") {
        await storyService.initializeUserStories();
        await subscriptionService.initializeSubscription();
        await likeService.initializeLikes();
        authForm.reset();
        renderAllStoryLists();
      }

      renderAuthPanel();
    } catch (error) {
      console.warn("[app] Auth failed", error);
      setAuthNotice(getAuthErrorMessage(error, action), "warning");
      renderAuthPanel();
    } finally {
      setAuthFormBusy(false);
    }
  }

  async function handlePasswordResetSubmit(event) {
    event.preventDefault();

    if (!passwordRecoverySession?.access_token) {
      setAuthNotice("Ссылка восстановления устарела. Запросите новое письмо.", "warning");
      passwordRecoverySession = null;
      supabaseService?.clearAuthParamsFromUrl?.();
      renderAuthPanel();
      return;
    }

    const formData = new FormData(passwordResetForm);
    const newPassword = String(formData.get("newPassword") || "");
    const confirmNewPassword = String(formData.get("confirmNewPassword") || "");

    if (!newPassword || !confirmNewPassword) {
      setAuthNotice("Введите новый пароль два раза.", "warning");
      renderAuthPanel();
      return;
    }

    if (newPassword.length < 6) {
      setAuthNotice("Пароль должен быть не короче 6 символов.", "warning");
      renderAuthPanel();
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setAuthNotice("Пароли не совпадают.", "warning");
      renderAuthPanel();
      return;
    }

    setAuthFormBusy(true);
    setAuthNotice("Сохраняю новый пароль...", "");
    renderAuthPanel();

    try {
      await supabaseService.updatePassword(passwordRecoverySession.access_token, newPassword);
      passwordRecoverySession = null;
      passwordResetForm.reset();
      supabaseService.clearAuthParamsFromUrl?.();
      await supabaseService.signOut();
      await storyService.initializeUserStories();
      await subscriptionService.initializeSubscription();
      await likeService.initializeLikes();
      setAuthNotice("Пароль обновлён. Теперь войдите с новым паролем.", "success");
      renderAuthPanel();
      renderAllStoryLists();
    } catch (error) {
      console.warn("[app] Password reset failed", error);
      setAuthNotice(getAuthErrorMessage(error, "recover"), "warning");
      renderAuthPanel();
    } finally {
      setAuthFormBusy(false);
    }
  }

  function cancelPasswordReset() {
    passwordRecoverySession = null;
    passwordResetForm?.reset();
    supabaseService?.clearAuthParamsFromUrl?.();
    setAuthNotice("Восстановление пароля отменено.", "warning");
    renderAuthPanel();
  }

  async function handleSignOut() {
    if (!supabaseService?.isEnabled?.()) return;

    await supabaseService.signOut();
    await storyService.initializeUserStories();
    await subscriptionService.initializeSubscription();
    await likeService.initializeLikes();
    setAuthNotice("Вы вышли из аккаунта. Теперь истории снова сохраняются локально.", "warning");
    renderAuthPanel();
    renderAllStoryLists();
  }

  async function handleRefreshAccount() {
    if (!supabaseService?.isEnabled?.()) return;

    setAuthFormBusy(true);
    setAuthNotice("Обновляю синхронизацию аккаунта...", "");
    renderAuthPanel();

    try {
      await supabaseService.ensureFreshSession?.();
      await storyService.initializeUserStories();
      await subscriptionService.initializeSubscription();
      await likeService.initializeLikes();
      setAuthNotice("Синхронизация обновлена.", "success");
      renderAllStoryLists();
      renderAuthPanel();
      updateGenerationStatus();
    } catch (error) {
      console.warn("[app] Cannot refresh account sync", error);
      setAuthNotice("Не удалось обновить синхронизацию. Проверьте интернет и попробуйте ещё раз.", "warning");
      renderAuthPanel();
    } finally {
      setAuthFormBusy(false);
    }
  }

  filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    setFilter(button.dataset.filter);
  });

  storyList.addEventListener("click", handleStoryListClick);
  libraryList.addEventListener("click", handleLibraryClick);

  if (librarySearchInput) {
    librarySearchInput.addEventListener("input", handleLibrarySearchInput);
  }

  if (librarySortSelect) {
    librarySortSelect.addEventListener("change", handleLibrarySortChange);
  }

  generatorForm.addEventListener("submit", handleGeneratorSubmit);

  if (authForm) {
    authForm.addEventListener("submit", handleAuthSubmit);
  }

  if (passwordResetForm) {
    passwordResetForm.addEventListener("submit", handlePasswordResetSubmit);
  }

  if (cancelPasswordResetButton) {
    cancelPasswordResetButton.addEventListener("click", cancelPasswordReset);
  }

  if (refreshAccountButton) {
    refreshAccountButton.addEventListener("click", handleRefreshAccount);
  }

  if (signOutButton) {
    signOutButton.addEventListener("click", handleSignOut);
  }

  passwordToggleButtons.forEach((button) => {
    button.addEventListener("click", handlePasswordToggle);
  });

  if (checkGenerationTaskButton) {
    checkGenerationTaskButton.addEventListener("click", checkGenerationTaskAnswer);
  }

  if (nextGenerationTaskButton) {
    nextGenerationTaskButton.addEventListener("click", () => {
      renderGenerationTask(buildGenerationTask(new FormData(generatorForm)));
      generationTaskAnswer?.focus();
    });
  }

  if (generationTaskAnswer) {
    generationTaskAnswer.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        checkGenerationTaskAnswer();
      }
    });
  }

  activateSubscriptionButton.addEventListener("click", async () => {
    trackEvent(EVENTS.SUBSCRIPTION_BUTTON_CLICKED);
    activateSubscriptionButton.disabled = true;
    updateGenerationStatus("Активирую mock-подписку...");

    try {
      await subscriptionService.activateMockSubscription();
      hideSubscriptionScreen();
      updateGenerationStatus("Mock-подписка активна. Это тестовая подписка для проверки работы MVP.");
      renderSubscriptionPanel();
      renderLibrary();
    } catch (error) {
      console.warn("[app] Cannot activate mock subscription", error);
      updateGenerationStatus(`Не удалось активировать mock-подписку: ${error.message || "ошибка"}`);
      renderSubscriptionPanel();
    } finally {
      activateSubscriptionButton.disabled = false;
    }
  });

  if (readerLike) {
    readerLike.addEventListener("click", (event) => {
      const likeButton = event.target.closest("[data-like]");
      if (!likeButton) return;
      handleStoryLike(likeButton.dataset.like);
    });
  }

  slides.addEventListener("click", (event) => {
    const likeButton = event.target.closest("[data-like]");
    if (likeButton) {
      handleStoryLike(likeButton.dataset.like);
      return;
    }

    if (event.target.id === "backToStoriesEnd" || event.target.id === "readAnother") {
      closeReader();
    }
  });

  slides.addEventListener("scroll", updateProgress);

  backToStoriesTop.addEventListener("click", closeReader);

  chooseStoryButton.addEventListener("click", () => {
    scrollToSection(storiesSection);
  });

  navTopButton.addEventListener("click", () => {
    scrollToSection(hero);
  });

  navStoriesButton.addEventListener("click", () => {
    scrollToSection(storiesSection);
  });

  navGeneratorButton.addEventListener("click", () => {
    scrollToSection(generatorSection, EVENTS.GENERATOR_OPENED);
  });

  navLibraryButton.addEventListener("click", () => {
    scrollToSection(librarySection, EVENTS.LIBRARY_OPENED);
  });

  navAboutButton.addEventListener("click", openAboutSection);

  readFirstButton.addEventListener("click", () => {
    const [firstStory] = storyService.getAllStories();
    if (firstStory) openStory(firstStory.id);
  });

  openGeneratorButton.addEventListener("click", () => {
    scrollToSection(generatorSection, EVENTS.GENERATOR_OPENED);
  });

  openLibraryButton.addEventListener("click", () => {
    scrollToSection(librarySection, EVENTS.LIBRARY_OPENED);
  });

  openAboutButton.addEventListener("click", openAboutSection);

  document.querySelectorAll("[data-about-read-stories]").forEach((button) => {
    button.addEventListener("click", () => {
      trackEvent(EVENTS.ABOUT_READ_STORIES_CLICKED);
      scrollToSection(storiesSection);
    });
  });

  document.querySelectorAll("[data-about-create-story]").forEach((button) => {
    button.addEventListener("click", () => {
      trackEvent(EVENTS.ABOUT_CREATE_STORY_CLICKED);
      scrollToSection(generatorSection);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeStory) {
      closeReader();
    }
  });

  async function initializeApp() {
    updateGenerationStatus();
    await subscriptionService.initializeSubscription();
    renderSubscriptionPanel();
    renderAuthPanel();
    renderAllStoryLists();

    if (supabaseService?.isEnabled?.()) {
      const hasRecoveryIntent = supabaseService.hasPasswordRecoveryIntent?.();
      const authUrlError = supabaseService.getAuthErrorFromUrl?.();

      try {
        passwordRecoverySession = await supabaseService.getPasswordRecoverySessionFromUrl();
      } catch (error) {
        console.warn("[app] Cannot read password recovery session", error);
        setAuthNotice("Ссылка восстановления устарела. Запросите новое письмо.", "warning");
      }

      if (passwordRecoverySession) {
        setAuthNotice("Введите новый пароль для аккаунта.", "warning");
        focusPasswordResetForm();
      } else if (hasRecoveryIntent) {
        const isExpiredLink = authUrlError?.errorCode === "otp_expired";
        setAuthNotice(
          isExpiredLink
            ? "Ссылка восстановления устарела или уже была использована. Запросите новое письмо и откройте самую свежую ссылку."
            : "Не удалось открыть форму восстановления. Запросите новое письмо и попробуйте ещё раз.",
          "warning"
        );
        supabaseService.clearAuthParamsFromUrl?.();
        await supabaseService.initializeAuth();
        focusPasswordResetForm();
      } else {
        await supabaseService.initializeAuth();
        await subscriptionService.initializeSubscription();
        await storyService.initializeUserStories();
        await likeService.initializeLikes();
      }

      renderSubscriptionPanel();
      renderAuthPanel();
      renderAllStoryLists();
    }
  }

  initializeApp();
})(window, document);
