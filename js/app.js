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
  const PAYMENT_CHECKOUT_TIMEOUT_MS = 20000;
  const generationMiniGamesEnabled = appConfig.GENERATION_MINI_GAMES_ENABLED === true;
  const paymentReturnIntent = new URLSearchParams(window.location.search).get("payment") === "return";

  const storyList = document.querySelector("#storyList");
  const libraryList = document.querySelector("#libraryList");
  const libraryStatus = document.querySelector("#libraryStatus");
  const librarySearchInput = document.querySelector("#librarySearchInput");
  const librarySortSelect = document.querySelector("#librarySortSelect");
  const filters = document.querySelector("#filters");
  const reader = document.querySelector("#reader");
  const slides = document.querySelector("#slides");
  let readerTitle = document.querySelector("#readerTitle");
  const mainContent = document.querySelector("#mainContent");
  const readingProgress = document.querySelector("#readingProgress");
  const navTopButton = document.querySelector("#navTopButton");
  const navMenuButton = document.querySelector("#navMenuButton");
  const siteNavMenu = document.querySelector("#siteNavMenu");
  const navLoginButton = document.querySelector("#navLoginButton");
  const navStoriesButton = document.querySelector("#navStoriesButton");
  const navMemoryButton = document.querySelector("#navMemoryButton");
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
  const readerIllustrationAction = document.querySelector("#readerIllustrationAction");
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
  const paymentButtons = document.querySelectorAll("[data-start-checkout]");
  const paymentStatusElements = document.querySelectorAll("[data-payment-status]");
  const authPanel = document.querySelector("#authPanel");
  const authForm = document.querySelector("#authForm");
  const authAdultConsent = document.querySelector("#authAdultConsent");
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
  const memoryPromo = document.querySelector("#memoryPromo");
  const memoryGameSection = document.querySelector("#memoryGameSection");
  const readingValuesSection = document.querySelector("#why-read");
  const generatorSection = document.querySelector("#generator");
  const librarySection = document.querySelector("#library");
  const aboutSection = document.querySelector("#about");
  const hero = document.querySelector(".hero");
  let heroTitle = document.querySelector(".hero h1");

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
  const ILLUSTRATION_GENERATION_TIMEOUT_MS = 150000;

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
  let activeRoute = "home";
  let paymentCheckoutInProgress = false;
  let paymentCheckoutMessage = "";
  let paymentCheckoutTone = "";

  const PUBLIC_SITE_ORIGIN = "https://ezhik-i-lisenok.ru";
  const DEFAULT_DOCUMENT_TITLE = "Добрые сказки для детей 5–10 лет — Ежонок и Лисёнок";

  function setReaderTitle(text, useH1 = false) {
    const requiredTag = useH1 ? "H1" : "H2";

    if (readerTitle.tagName !== requiredTag) {
      const replacement = document.createElement(requiredTag.toLowerCase());
      replacement.id = "readerTitle";
      replacement.tabIndex = -1;
      readerTitle.replaceWith(replacement);
      readerTitle = replacement;
    }

    readerTitle.textContent = text;
  }

  function setHeroTitleLevel(useH1 = true) {
    const requiredTag = useH1 ? "H1" : "H2";

    if (heroTitle.tagName === requiredTag) return;

    const replacement = document.createElement(requiredTag.toLowerCase());
    replacement.innerHTML = heroTitle.innerHTML;
    heroTitle.replaceWith(replacement);
    heroTitle = replacement;
  }

  function getRouteFromLocation() {
    let path = decodeURIComponent(window.location.pathname || "/").replace(/\/+$/, "") || "/";
    let search = new URLSearchParams(window.location.search);
    const fallbackRoute = search.get("route");

    if (path === "/" && fallbackRoute) {
      try {
        const fallbackUrl = new URL(fallbackRoute, window.location.origin);
        path = fallbackUrl.pathname.replace(/\/+$/, "") || "/";
        search = fallbackUrl.searchParams;
        window.history.replaceState({}, "", `${path}${fallbackUrl.search}`);
      } catch (error) {
        console.warn("[app] Cannot restore the requested route", error);
      }
    }

    if (path === "/create") return { name: "create" };
    if (path === "/library") return { name: "library" };
    if (path === "/games/memory" || path === "/memory") return { name: "memory" };
    if (path === "/stories") return { name: "stories", filter: search.get("filter") || "all" };
    if (path.startsWith("/stories/")) return { name: "story", storyId: path.slice("/stories/".length) };
    return { name: "home", filter: search.get("filter") || "all" };
  }

  function getRouteUrl(route) {
    if (route.name === "create") return "/create";
    if (route.name === "library") return "/library";
    if (route.name === "memory") return "/games/memory";
    if (route.name === "story") return `/stories/${encodeURIComponent(route.storyId)}`;
    if (route.name === "stories") {
      return route.filter && route.filter !== "all" ? `/stories?filter=${encodeURIComponent(route.filter)}` : "/stories";
    }
    return route.filter && route.filter !== "all" ? `/?filter=${encodeURIComponent(route.filter)}` : "/";
  }

  function setMetaContent(selector, content) {
    const element = document.querySelector(selector);
    if (!element) return;
    if (element.tagName === "LINK") {
      element.setAttribute("href", content);
      return;
    }
    element.setAttribute("content", content);
  }

  function updateDocumentMeta(story = null, route = null) {
    if (!story) {
      const routeMeta = {
        create: {
          title: "Создать сказку — Ежонок и Лисёнок",
          description: "Создайте добрую персональную сказку про Ежонка и Лисёнка для семейного чтения.",
          url: `${PUBLIC_SITE_ORIGIN}/create`
        },
        stories: {
          title: "Все истории — Ежонок и Лисёнок",
          description: "Читайте добрые истории про Ежонка и Лисёнка для детей 5–10 лет.",
          url: `${PUBLIC_SITE_ORIGIN}/stories`
        },
        library: {
          title: "Моя библиотека — Ежонок и Лисёнок",
          description: "Личная библиотека созданных сказок.",
          url: `${PUBLIC_SITE_ORIGIN}/library`,
          noIndex: true
        },
        memory: {
          title: "Мемори с Ежонком и Лисёнком — игра для детей",
          description: "Открывайте карточки с иллюстрациями историй, запоминайте картинки и находите пары.",
          url: `${PUBLIC_SITE_ORIGIN}/games/memory`
        },
        home: {
          title: DEFAULT_DOCUMENT_TITLE,
          description: "Добрые сказки для детей 5–10 лет про Ежонка и Лисёнка: читайте готовые истории и создавайте семейные сказки для тихих вечеров.",
          url: `${PUBLIC_SITE_ORIGIN}/`
        }
      };
      const meta = routeMeta[route?.name] || routeMeta.home;
      document.title = meta.title;
      setMetaContent('meta[name="description"]', meta.description);
      setMetaContent('link[rel="canonical"]', meta.url);
      setMetaContent('meta[property="og:title"]', meta.title);
      setMetaContent('meta[property="og:description"]', meta.description);
      setMetaContent('meta[property="og:url"]', meta.url);
      setMetaContent('meta[name="twitter:title"]', meta.title);
      setMetaContent('meta[name="twitter:description"]', meta.description);
      setMetaContent('meta[name="robots"]', meta.noIndex ? "noindex,nofollow" : "index,follow");
      return;
    }

    const title = `${story.title} — Ежонок и Лисёнок`;
    const description = String(story.description || "Добрая история про Ежонка и Лисёнка.").slice(0, 160);
    const url = `${PUBLIC_SITE_ORIGIN}/stories/${encodeURIComponent(story.id)}`;
    document.title = title;
    setMetaContent('meta[name="description"]', description);
    setMetaContent('link[rel="canonical"]', url);
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[property="og:url"]', url);
    setMetaContent('meta[name="twitter:title"]', title);
    setMetaContent('meta[name="twitter:description"]', description);
    setMetaContent('meta[name="robots"]', "noindex,nofollow");
  }

  function setSectionVisibility(section, isVisible) {
    if (!section) return;
    section.classList.toggle("hidden", !isVisible);
  }

  function navigateTo(route, options = {}) {
    const url = getRouteUrl(route);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    const method = options.replace ? "replaceState" : "pushState";

    if (currentUrl !== url) {
      window.history[method]({ route }, "", url);
    }

    applyRoute({ focus: options.focus !== false });
  }

  function renderReaderUnavailable() {
    activeStory = null;
    setHeroTitleLevel(false);
    document.body.classList.add("reading");
    reader.classList.remove("hidden");
    setReaderTitle("История недоступна", true);
    slides.innerHTML = `
      <article class="slide end-slide">
        <div class="slide-card">
          <p class="slide-kicker">Библиотека историй</p>
          <p class="slide-text">Эта ссылка ведёт к личной истории, которая недоступна в текущем аккаунте, или к несуществующей сказке.</p>
          <div class="end-actions"><a class="button primary" href="/stories">Все истории</a></div>
        </div>
      </article>
    `;
    updateDocumentMeta(null, { name: "stories" });
    window.setTimeout(() => readerTitle.focus({ preventScroll: true }), 0);
  }

  function applyRoute(options = {}) {
    const route = getRouteFromLocation();
    activeRoute = route.name;

    if (route.filter && route.filter !== activeFilter) {
      setFilter(route.filter, { updateUrl: false });
    }

    if (route.name === "story") {
      openStory(route.storyId, { fromRoute: true });
      return;
    }

    document.body.classList.remove("reading");
    reader.classList.add("hidden");
    setHeroTitleLevel(route.name !== "memory");
    setReaderTitle("История", false);
    activeStory = null;
    readingProgress.style.width = "0%";
    setSectionVisibility(hero, route.name === "home");
    setSectionVisibility(storiesSection, route.name === "home" || route.name === "stories");
    setSectionVisibility(memoryPromo, route.name === "home");
    setSectionVisibility(memoryGameSection, route.name === "memory");
    setSectionVisibility(readingValuesSection, route.name === "home");
    setSectionVisibility(document.querySelector("#pricing"), route.name === "home");
    setSectionVisibility(generatorSection, route.name === "create");
    setSectionVisibility(librarySection, route.name === "library");
    setSectionVisibility(aboutSection, route.name === "home");
    navStoriesButton?.classList.toggle("active", route.name === "stories");
    navMemoryButton?.classList.toggle("active", route.name === "memory");
    navLibraryButton?.classList.toggle("active", route.name === "library");
    updateDocumentMeta(null, route);

    if (route.name === "memory") {
      window.HFMemoryGame?.initialize?.();
    }

    if (options.focus) {
      window.setTimeout(() => {
        mainContent?.focus({ preventScroll: true });
        mainContent?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
  }

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

  function setNavigationMenuOpen(isOpen) {
    if (!navMenuButton || !siteNavMenu) return;

    navMenuButton.setAttribute("aria-expanded", String(isOpen));
    navMenuButton.setAttribute("aria-label", isOpen ? "Закрыть меню" : "Открыть меню");
    siteNavMenu.classList.toggle("open", isOpen);
    document.body.classList.toggle("menu-open", isOpen);
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
    navigateTo({ name: "home" }, { focus: false });
    window.setTimeout(() => scrollToSection(aboutSection, EVENTS.ABOUT_OPENED), 0);
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

    return `Тариф: ${getTariffLabel(subscription.status)}. Использовано: ${usage.generationsUsed} из ${usage.generationLimit} ${getUsageLimitWord(usage.generationLimit)}.`;
  }

  function getUsageLimitWord(limit) {
    return Number(limit) === 1 ? "истории" : "историй";
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
    generationWaitPanel.classList.toggle("is-simple", !generationMiniGamesEnabled);
    generationWaitPanel.classList.remove("hidden");
    updateGenerationWaitTitle();

    window.clearInterval(generationTaskTimerId);
    window.clearInterval(generationProgressTimerId);

    if (generationMiniGamesEnabled) {
      window.HFMiniGames?.open?.(getFormValue(formData, "ageGroup", "5-7"));
      renderGenerationTask(buildGenerationTask(formData));
      generationTaskTimerId = window.setInterval(() => {
        renderGenerationTask(buildGenerationTask(formData));
      }, 18000);
    } else {
      // Код мини-игр остаётся подключённым, но экран и задания временно не запускаются.
      window.HFMiniGames?.close?.();
      activeGenerationTask = null;
    }

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
      accountPaymentText.textContent = isSignedIn
        ? subscription.status === "active"
          ? "Разовая оплата YooKassa, без автопродления"
          : "Разовая оплата YooKassa: 299 ₽ за 30 дней"
        : "Войдите, чтобы оплатить тариф";
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
        "Лимит бесплатных историй исчерпан. Семейный тариф: 299 ₽ за 30 дней, до 20 историй.";
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

  function hasActiveFamilyAccess(subscription, periodEnd) {
    return (
      subscription?.status === "active" &&
      Boolean(periodEnd) &&
      new Date(periodEnd).getTime() > Date.now()
    );
  }

  function setPaymentCheckoutStatus(message = "", tone = "") {
    paymentCheckoutMessage = message;
    paymentCheckoutTone = tone;

    paymentStatusElements.forEach((element) => {
      element.textContent = message;
      element.classList.toggle("success", tone === "success");
      element.classList.toggle("warning", tone === "warning");
    });
  }

  function renderPaymentActions() {
    const subscription = subscriptionService.getSubscriptionState();
    const usage = subscriptionService.getGenerationUsage();
    const periodEnd = usage.periodEnd || subscription.currentPeriodEnd;
    const hasActiveAccess = hasActiveFamilyAccess(subscription, periodEnd);
    const authState = supabaseService?.getAuthState?.() || { status: "signed_out" };
    const isSignedIn = authState.status === "signed_in" && Boolean(supabaseService?.getCurrentUser?.()?.id);

    paymentButtons.forEach((button) => {
      button.hidden = hasActiveAccess;
      button.disabled = paymentCheckoutInProgress;

      if (paymentCheckoutInProgress) {
        button.textContent = "Создаём оплату...";
      } else if (isSignedIn) {
        button.textContent = "Оплатить 299 ₽";
      } else {
        button.textContent = "Войти для оплаты";
      }
    });

    if (hasActiveAccess && !paymentCheckoutMessage) {
      setPaymentCheckoutStatus(`Семейный доступ активен до ${formatDate(periodEnd)}.`, "success");
    }
  }

  async function parsePaymentResponse(response) {
    const rawText = await response.text();
    let payload = null;

    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch (error) {
      throw new Error("Сервис оплаты вернул непонятный ответ. Попробуйте ещё раз.");
    }

    if (!response.ok) {
      throw new Error(payload?.message || "Не удалось подготовить оплату. Попробуйте ещё раз.");
    }

    return payload;
  }

  async function startSubscriptionCheckout() {
    if (paymentCheckoutInProgress) return;

    const session = await supabaseService?.ensureFreshSession?.();
    const accessToken = session?.access_token || "";

    if (!accessToken) {
      setPaymentCheckoutStatus("Чтобы оплатить тариф, войдите в аккаунт.", "warning");
      setAuthNotice("Войдите или зарегистрируйтесь, затем вернитесь к оплате тарифа.", "warning");
      navigateTo({ name: "library" });
      renderAuthPanel();
      window.setTimeout(() => document.querySelector("#authEmail")?.focus({ preventScroll: true }), 0);
      return;
    }

    if (!appConfig.PAYMENT_API_URL) {
      setPaymentCheckoutStatus("Оплата временно недоступна. Попробуйте позднее.", "warning");
      return;
    }

    paymentCheckoutInProgress = true;
    setPaymentCheckoutStatus("Создаём безопасную страницу оплаты YooKassa...");
    renderPaymentActions();
    trackEvent(EVENTS.SUBSCRIPTION_BUTTON_CLICKED, { plan: "family", amount: 299 });

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), PAYMENT_CHECKOUT_TIMEOUT_MS);

    try {
      const response = await window.fetch(appConfig.PAYMENT_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ plan: "family" }),
        signal: controller.signal
      });
      const payload = await parsePaymentResponse(response);
      const checkoutUrl = String(payload?.checkout?.checkoutUrl || "").trim();
      if (!checkoutUrl) {
        throw new Error("Сервис оплаты не вернул ссылку. Попробуйте ещё раз.");
      }
      const checkoutUrlObject = new URL(checkoutUrl);

      if (checkoutUrlObject.protocol !== "https:") {
        throw new Error("Сервис оплаты вернул небезопасную ссылку. Попробуйте ещё раз.");
      }

      window.location.assign(checkoutUrlObject.toString());
    } catch (error) {
      const message = error?.name === "AbortError"
        ? "Подготовка оплаты заняла слишком долго. Попробуйте ещё раз."
        : error?.message || "Не удалось подготовить оплату. Попробуйте ещё раз.";
      setPaymentCheckoutStatus(message, "warning");
      console.warn("[app] Cannot start checkout", error);
    } finally {
      window.clearTimeout(timeoutId);
      paymentCheckoutInProgress = false;
      renderPaymentActions();
    }
  }

  async function refreshAfterPaymentReturn() {
    if (!paymentReturnIntent) return;

    setPaymentCheckoutStatus("Проверяем оплату и обновляем тариф...");
    await new Promise((resolve) => window.setTimeout(resolve, 2500));

    try {
      await supabaseService.ensureFreshSession?.();
      await subscriptionService.initializeSubscription();
      const subscription = subscriptionService.getSubscriptionState();
      const usage = subscriptionService.getGenerationUsage();
      const periodEnd = usage.periodEnd || subscription.currentPeriodEnd;

      if (hasActiveFamilyAccess(subscription, periodEnd)) {
        setPaymentCheckoutStatus("Оплата подтверждена. Семейный тариф активирован.", "success");
      } else {
        setPaymentCheckoutStatus(
          "Оплата обрабатывается. Обычно это занимает меньше минуты. Нажмите «Обновить синхронизацию» немного позже.",
          "warning"
        );
      }
    } catch (error) {
      setPaymentCheckoutStatus(
        "Не удалось обновить статус оплаты. Нажмите «Обновить синхронизацию» немного позже.",
        "warning"
      );
      console.warn("[app] Cannot refresh payment status", error);
    }

    renderSubscriptionPanel();
    renderAuthPanel();
    updateGenerationStatus();
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
      subscriptionUsageText.textContent = `Использовано: ${usage.generationsUsed} из ${usage.generationLimit} ${getUsageLimitWord(usage.generationLimit)}.`;
    }

    if (subscriptionPeriodText) {
      subscriptionPeriodText.textContent = periodText
        ? `Период до: ${periodText}${periodText.endsWith(".") ? "" : "."}`
        : "Период будет создан при первой синхронизации.";
    }

    if (subscriptionFallbackNotice) {
      const isFallback = storageState.mode === "local_fallback";
      subscriptionFallbackNotice.classList.toggle("hidden", !isFallback);
      subscriptionFallbackNotice.textContent = isFallback
        ? "Облачная подписка временно недоступна. Лимиты применяются только на этом устройстве."
        : "";
    }

    renderAccountSummary();
    renderPaymentActions();
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
    const firstPage = Array.isArray(story.pages) ? story.pages[0] : null;

    if (story.imageUrl) {
      const builtInAsset = String(story.imageUrl).match(/^assets\/stories\/([a-z0-9-]+)\.png$/i);
      if (builtInAsset) {
        const assetName = builtInAsset[1];
        return `
          <picture>
            <source type="image/avif" srcset="assets/optimized/${assetName}-480.avif 480w, assets/optimized/${assetName}-768.avif 768w, assets/optimized/${assetName}-1200.avif 1200w" sizes="(max-width: 720px) 86vw, (max-width: 1100px) 44vw, 430px" />
            <img src="${escapeAttribute(story.imageUrl)}" alt="" loading="lazy" decoding="async" width="1536" height="1024" />
          </picture>
        `;
      }
      return `<img src="${escapeAttribute(story.imageUrl)}" alt="" loading="lazy" decoding="async" width="1536" height="1024" />`;
    }

    if (firstPage?.imageUrl) {
      return `<img src="${escapeAttribute(firstPage.imageUrl)}" alt="" loading="lazy" decoding="async" width="1536" height="1024" onerror="this.remove();" />`;
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
    const hasIllustrations = Array.isArray(story.pages) && story.pages.some((page) => page?.imageUrl);
    const illustrateButton = options.canDelete && story.storage === "supabase" && story.useIllustrations !== false
      ? `<button class="button secondary" data-illustrate-story="${escapeAttribute(story.id)}" data-force-illustrations="${hasIllustrations}" type="button">${hasIllustrations ? "Перерисовать иллюстрации" : "Нарисовать иллюстрации"}</button>`
      : "";

    return `
      <article class="story-card" style="--wash-color: ${top}88;" data-story-card="${escapeAttribute(story.id)}">
        <div
          class="story-art ${story.imageUrl || (story.source === "user" && story.useIllustrations !== false) ? "has-image" : ""}"
          style="--art-top: ${top}; --art-mid: ${mid}; --art-bottom: ${bottom};"
          role="img"
          aria-label="Иллюстрация к истории ${escapeAttribute(story.title)}"
        >
          ${renderStoryArt(story)}
        </div>
        <div class="story-content">
          <h3><a class="story-title-link" href="/stories/${encodeURIComponent(story.id)}" data-read="${escapeAttribute(story.id)}">${escapeHtml(story.title)}</a></h3>
          <div class="story-meta">
            <span class="pill">${escapeHtml(story.age)} лет</span>
            <span class="pill">${escapeHtml(story.time)}</span>
            ${sourcePill}
            ${renderLikeButton(story, "compact")}
          </div>
          <p>${escapeHtml(story.description)}</p>
          <div class="card-actions">
            <button class="button primary" data-read="${escapeAttribute(story.id)}" type="button">Читать</button>
            ${illustrateButton}
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

  function setFilter(filter, options = {}) {
    activeFilter = filter;
    document.querySelectorAll(".filter-button").forEach((button) => {
      const isActive = button.dataset.filter === filter;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
    renderStories();

    if (options.updateUrl !== false && activeRoute !== "story") {
      const route = activeRoute === "stories" ? { name: "stories", filter } : { name: "home", filter };
      window.history.replaceState({ route }, "", getRouteUrl(route));
    }
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
      const isBuiltInSlide = /^assets\/slides-web\//.test(page.imageUrl);
      const fallbackHandler = page.fallbackImageUrl
        ? `this.onerror=null; this.src='${escapeAttribute(page.fallbackImageUrl)}';`
        : "this.remove();";

      return `
        <img
          class="reader-illustration"
          src="${escapeAttribute(page.imageUrl)}"
          alt="Иллюстрация к истории ${escapeAttribute(storyTitle)}, страница ${page.pageNumber}"
          width="${isBuiltInSlide ? "1200" : "1536"}"
          height="${isBuiltInSlide ? "900" : "1024"}"
          loading="lazy"
          decoding="async"
          onerror="${fallbackHandler}"
        />
      `;
    }

    if (page.illustrationUnavailable) {
      return `
        <div class="reader-illustration-unavailable" role="status">
          Новая иллюстрация создана, но пока не загрузилась. Обновите страницу или попробуйте позднее.
        </div>
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

  function canRegenerateStoryIllustrations(story) {
    return Boolean(
      story?.source === "user" &&
      story?.storage === "supabase" &&
      story?.useIllustrations !== false &&
      canUseIllustrationApi()
    );
  }

  function renderReaderIllustrationAction(story) {
    if (!readerIllustrationAction) return;

    readerIllustrationAction.innerHTML = canRegenerateStoryIllustrations(story)
      ? `<button class="button quiet reader-illustration-button" type="button" data-regenerate-illustrations="${escapeAttribute(story.id)}" aria-label="Перерисовать иллюстрации по тексту сказки">Перерисовать</button>`
      : "";
  }

  function renderReaderIllustrationEndAction(story) {
    if (!canRegenerateStoryIllustrations(story)) return "";

    return `
      <div class="reader-illustration-actions">
        <button class="button secondary" type="button" data-regenerate-illustrations="${escapeAttribute(story.id)}">Перерисовать иллюстрации по тексту</button>
        <p class="reader-illustration-status" id="readerIllustrationStatus" role="status"></p>
      </div>
    `;
  }

  function openStory(storyId, options = {}) {
    const story = storyService.getStoryById(storyId);
    if (!story) {
      if (options.fromRoute) renderReaderUnavailable();
      return;
    }

    activeStory = storyService.prepareStoryForReader(story);
    activeStoryFinishedTracked = false;
    setHeroTitleLevel(false);
    setReaderTitle(activeStory.title, true);
    updateDocumentMeta(activeStory);
    renderReaderLike();
    renderReaderIllustrationAction(activeStory);
    document.body.classList.add("reading");
    hero.classList.add("hidden");
    storiesSection.classList.add("hidden");
    readingValuesSection?.classList.add("hidden");
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
              <span class="slide-kicker">Страница ${page.pageNumber} из ${activeStory.readerPages.length}</span>
              ${illustration}
              <p class="slide-text">${escapeHtml(page.text)}</p>
            </div>
            <div class="slide-navigation" aria-label="Навигация по страницам">
              <button class="button quiet" type="button" data-reader-previous="${page.pageNumber - 1}" ${page.pageNumber === 1 ? "disabled" : ""}>Предыдущая</button>
              <button class="button primary" type="button" data-reader-next="${page.pageNumber + 1}">Следующая</button>
            </div>
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
          ${renderReaderIllustrationEndAction(activeStory)}
          <div class="end-actions">
            <button class="button secondary" id="backToStoriesEnd">Вернуться к историям</button>
            <button class="button primary" id="readAnother">Читать другую</button>
          </div>
        </div>
      </article>
    `;

    slides.scrollTop = 0;
    updateProgress();
    window.setTimeout(() => readerTitle.focus({ preventScroll: true }), 0);
    if (!options.fromRoute) {
      navigateTo({ name: "story", storyId: activeStory.id }, { focus: false });
    }
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
    renderReaderIllustrationAction(null);
    navigateTo({ name: "stories", filter: activeFilter }, { focus: true });
  }

  function scrollToReaderPage(pageNumber) {
    const pageIndex = Math.max(0, Number(pageNumber || 1) - 1);
    const target = slides.querySelectorAll(".slide")[pageIndex];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.querySelector(".slide-text")?.focus?.({ preventScroll: true });
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

  function canUseIllustrationApi() {
    return Boolean(appConfig.ILLUSTRATION_API_ENABLED && appConfig.ILLUSTRATION_API_URL);
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

  async function requestStoryIllustration(storyId, pageNumber, options = {}) {
    if (!canUseIllustrationApi() || !storyId || !pageNumber) {
      return { illustrated: false, reason: "disabled" };
    }

    const session = await supabaseService?.ensureFreshSession?.();
    const accessToken = session?.access_token || "";
    if (!accessToken) return { illustrated: false, reason: "signed_out" };

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ILLUSTRATION_GENERATION_TIMEOUT_MS);

    try {
      const response = await window.fetch(appConfig.ILLUSTRATION_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ storyId, pageNumber, force: options.force === true }),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || "Не удалось создать иллюстрацию");
      }

      return payload || { illustrated: false, reason: "empty_response" };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function requestStoryIllustrations(story, options = {}) {
    const pages = Array.isArray(story?.pages) ? story.pages : [];
    const result = {
      illustrated: false,
      completed: 0,
      failed: 0,
      total: pages.length,
      missingConfiguration: []
    };
    const actionLabel = options.force ? "Перерисовываю" : "Рисую";

    for (let index = 0; index < pages.length; index += 1) {
      const pageNumber = Number(pages[index]?.pageNumber || index + 1);
      updateGenerationStatus(`${actionLabel} иллюстрацию ${index + 1} из ${pages.length}...`);

      try {
        const pageResult = await requestStoryIllustration(story.id, pageNumber, options);
        if (pageResult?.illustrated) {
          result.illustrated = true;
          result.completed += 1;
        } else {
          const missingConfiguration = Array.isArray(pageResult?.missingConfiguration)
            ? pageResult.missingConfiguration
            : [];
          missingConfiguration.forEach((name) => {
            if (!result.missingConfiguration.includes(name)) result.missingConfiguration.push(name);
          });
          result.failed += 1;
        }
      } catch (error) {
        console.warn("[app] Cannot generate page illustration", error);
        result.failed += 1;
      }
    }

    return result;
  }

  function getIllustrationConfigurationMessage(result) {
    const missing = Array.isArray(result?.missingConfiguration) ? result.missingConfiguration : [];
    if (!missing.length) return "Иллюстрации пока не созданы. Проверьте подключение OpenAI Images в Vercel.";

    return `Vercel не видит переменные: ${missing.join(", ")}. Откройте Settings → Environments и проверьте их значения, затем сделайте Redeploy.`;
  }

  async function regenerateStoryIllustrations(storyId, button) {
    const story = storyService.getStoryById(storyId);
    const status = document.querySelector("#readerIllustrationStatus");
    if (!story) return;

    button.disabled = true;
    button.textContent = "Перерисовываем...";
    if (status) status.textContent = "Перерисовываем страницы по точному тексту сказки...";

    try {
      const result = await requestStoryIllustrations(story, { force: true });
      await storyService.initializeUserStories();
      renderAllStoryLists();

      if (!result.illustrated) {
        if (status) status.textContent = getIllustrationConfigurationMessage(result);
        return;
      }

      if (result.failed) {
        openStory(story.id, { fromRoute: true });
        const refreshedStatus = document.querySelector("#readerIllustrationStatus");
        if (refreshedStatus) {
          refreshedStatus.textContent =
            "Часть иллюстраций обновлена. Для оставшихся можно повторить перерисовку позже.";
        }
        return;
      }

      if (status) status.textContent = "Иллюстрации обновлены. Открываем новую версию сказки...";
      openStory(story.id, { fromRoute: true });
    } catch (error) {
      console.warn("[app] Cannot regenerate story illustrations", error);
      if (status) status.textContent = `Не удалось обновить иллюстрации: ${error.message || "ошибка"}`;
    } finally {
      button.disabled = false;
      button.textContent = "Перерисовать";
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
        label: getBackendGenerationLabel(backendResult.meta),
        meta: backendResult.meta
      };
    } catch (error) {
      if (supabaseService?.isAuthenticated?.()) {
        throw new Error("Сервис генерации временно недоступен. История не была сохранена, чтобы не обойти лимит тарифа. Попробуйте ещё раз немного позже.");
      }

      if (!isBackendUnavailableError(error)) {
        throw error;
      }

      console.warn("[app] Backend generation unavailable, using browser mock", error);
      return {
        story: buildMockStory(formData),
        mode: "browser-mock-fallback",
        label: "локальный mock, backend временно недоступен",
        fallbackReason: error.message || "backend unavailable"
      };
    }
  }

  function validateGeneratorForm() {
    const requiredFields = Array.from(generatorForm.querySelectorAll("[required]"));
    const invalidField = requiredFields.find((field) => !String(field.value || "").trim());

    requiredFields.forEach((field) => field.removeAttribute("aria-invalid"));

    if (!invalidField) return true;

    const label = invalidField.closest("label")?.querySelector("span")?.textContent?.trim() || "обязательное поле";
    invalidField.setAttribute("aria-invalid", "true");
    updateGenerationStatus(`Заполните поле «${label}», чтобы создать историю.`);
    invalidField.focus();
    return false;
  }

  async function handleGeneratorSubmit(event) {
    event.preventDefault();

    if (!validateGeneratorForm()) return;

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
        await subscriptionService.incrementLocalGenerationUsage();
      }

      let illustrationResult = null;
      if (isBackendGenerated && savedStory.useIllustrations !== false) {
        updateGenerationStatus("Рисую иллюстрации для страниц истории...");
        try {
          illustrationResult = await requestStoryIllustrations(savedStory);
          if (illustrationResult?.illustrated) {
            await storyService.initializeUserStories();
            savedStory = storyService.getStoryById(savedStory.id) || savedStory;
          }
        } catch (illustrationError) {
          console.warn("[app] Cannot generate story illustration", illustrationError);
        }
      }

      const storageState = storyService.getUserStoriesStorageState();
      hideSubscriptionScreen();
      updateGenerationStatus(
        storageState.mode === "supabase"
          ? illustrationResult?.illustrated
            ? illustrationResult.failed
              ? `История создана: ${generated.label}. Часть иллюстраций готова и сохранена в Supabase.`
              : `История создана: ${generated.label}. Иллюстрации готовы и сохранены в Supabase.`
            : `История создана: ${generated.label}. Сохранена в Supabase.`
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
      analyticsService.recordGenerationResult({
        mode: generated.mode,
        meta: generated.meta,
        fallbackReason: generated.fallbackReason
      });
      if (generationMiniGamesEnabled) {
        window.HFMiniGames?.storyReady?.(savedStory.id);
      }
    } catch (error) {
      console.warn("[app] Cannot save generated story", error);
      updateGenerationStatus(`Не удалось создать историю: ${error.message || "ошибка"}`);
      renderAuthPanel();
      if (generationMiniGamesEnabled) {
        window.HFMiniGames?.storyError?.();
      }
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
      return;
    }

    const storyCard = event.target.closest("[data-story-card]");
    if (storyCard && !event.target.closest("button, a, input, select, textarea")) {
      openStory(storyCard.dataset.storyCard);
    }
  }

  async function handleLibraryClick(event) {
    const createStoryButton = event.target.closest("[data-library-create-story]");
    if (createStoryButton) {
      navigateTo({ name: "create" });
      trackEvent(EVENTS.GENERATOR_OPENED);
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

    const illustrateButton = event.target.closest("[data-illustrate-story]");
    if (illustrateButton) {
      const story = storyService.getStoryById(illustrateButton.dataset.illustrateStory);
      if (!story) return;

      illustrateButton.disabled = true;
      const force = illustrateButton.dataset.forceIllustrations === "true";
      libraryStatus.textContent = force
        ? "Перерисовываем иллюстрации строго по тексту страниц..."
        : "Готовим иллюстрации к страницам истории...";

      try {
        const result = await requestStoryIllustrations(story, { force });
        await storyService.initializeUserStories();
        renderAllStoryLists();
        libraryStatus.textContent = result.illustrated
          ? result.failed
            ? "Часть иллюстраций готова. Для остальных временно используется акварельная библиотека."
            : "Иллюстрации ко всем страницам готовы."
          : getIllustrationConfigurationMessage(result);
      } catch (error) {
        console.warn("[app] Cannot illustrate saved story", error);
        libraryStatus.textContent = `Не удалось создать иллюстрации: ${error.message || "ошибка"}`;
      } finally {
        illustrateButton.disabled = false;
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

    if (action === "signup" && !authAdultConsent?.checked) {
      setAuthNotice("Подтвердите, что аккаунт создаёт взрослый или родитель, и примите условия сайта.", "warning");
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

  paymentButtons.forEach((button) => {
    button.addEventListener("click", () => {
      void startSubscriptionCheckout();
    });
  });

  document.querySelector("#openReadyStoryButton")?.addEventListener("click", () => {
    const storyId = window.HFMiniGames?.getStoryId?.();
    if (!storyId) return;
    trackEvent(EVENTS.STORY_OPENED_FROM_GAME, { storyId });
    window.HFMiniGames.close();
    openStory(storyId);
  });

  document.querySelector("#retryGenerationButton")?.addEventListener("click", () => {
    generatorForm.requestSubmit();
  });

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

  if (readerLike) {
    readerLike.addEventListener("click", (event) => {
      const likeButton = event.target.closest("[data-like]");
      if (!likeButton) return;
      handleStoryLike(likeButton.dataset.like);
    });
  }

  if (readerIllustrationAction) {
    readerIllustrationAction.addEventListener("click", (event) => {
      const regenerateButton = event.target.closest("[data-regenerate-illustrations]");
      if (!regenerateButton) return;
      void regenerateStoryIllustrations(regenerateButton.dataset.regenerateIllustrations, regenerateButton);
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
      return;
    }

    const regenerateButton = event.target.closest("[data-regenerate-illustrations]");
    if (regenerateButton) {
      void regenerateStoryIllustrations(regenerateButton.dataset.regenerateIllustrations, regenerateButton);
      return;
    }

    const previousButton = event.target.closest("[data-reader-previous]");
    if (previousButton) {
      scrollToReaderPage(previousButton.dataset.readerPrevious);
      return;
    }

    const nextButton = event.target.closest("[data-reader-next]");
    if (nextButton) scrollToReaderPage(nextButton.dataset.readerNext);
  });

  slides.addEventListener("scroll", updateProgress);

  backToStoriesTop.addEventListener("click", closeReader);

  chooseStoryButton.addEventListener("click", () => {
    navigateTo({ name: "stories", filter: activeFilter });
  });

  if (navMenuButton) {
    navMenuButton.addEventListener("click", () => {
      setNavigationMenuOpen(navMenuButton.getAttribute("aria-expanded") !== "true");
    });
  }

  if (siteNavMenu) {
    siteNavMenu.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) setNavigationMenuOpen(false);
    });
  }

  if (navLoginButton) {
    navLoginButton.addEventListener("click", (event) => {
      event.preventDefault();
      navigateTo({ name: "library" });
      window.setTimeout(() => document.querySelector("#authEmail")?.focus({ preventScroll: true }), 0);
    });
  }

  navTopButton.addEventListener("click", (event) => {
    event.preventDefault();
    navigateTo({ name: "home" });
  });

  navStoriesButton.addEventListener("click", (event) => {
    event.preventDefault();
    navigateTo({ name: "stories", filter: activeFilter });
  });

  navMemoryButton?.addEventListener("click", (event) => {
    event.preventDefault();
    navigateTo({ name: "memory" });
  });

  navGeneratorButton.addEventListener("click", (event) => {
    event.preventDefault();
    navigateTo({ name: "create" });
    trackEvent(EVENTS.GENERATOR_OPENED);
  });

  navLibraryButton.addEventListener("click", (event) => {
    event.preventDefault();
    navigateTo({ name: "library" });
    trackEvent(EVENTS.LIBRARY_OPENED);
  });

  navAboutButton.addEventListener("click", (event) => {
    event.preventDefault();
    openAboutSection();
  });

  readFirstButton.addEventListener("click", () => {
    const [firstStory] = storyService.getAllStories();
    if (firstStory) openStory(firstStory.id);
  });

  openGeneratorButton.addEventListener("click", () => {
    navigateTo({ name: "create" });
    trackEvent(EVENTS.GENERATOR_OPENED);
  });

  openLibraryButton.addEventListener("click", () => {
    navigateTo({ name: "library" });
    trackEvent(EVENTS.LIBRARY_OPENED);
  });

  openAboutButton.addEventListener("click", openAboutSection);

  document.querySelectorAll("[data-open-memory]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigateTo({ name: "memory" });
    });
  });

  document.querySelector(".memory-back-link")?.addEventListener("click", (event) => {
    event.preventDefault();
    navigateTo({ name: "stories", filter: activeFilter });
  });

  document.querySelectorAll("[data-about-read-stories]").forEach((button) => {
    button.addEventListener("click", () => {
      trackEvent(EVENTS.ABOUT_READ_STORIES_CLICKED);
      navigateTo({ name: "stories", filter: activeFilter });
    });
  });

  document.querySelectorAll("[data-about-create-story]").forEach((button) => {
    button.addEventListener("click", () => {
      trackEvent(EVENTS.ABOUT_CREATE_STORY_CLICKED);
      navigateTo({ name: "create" });
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeStory) {
      closeReader();
      return;
    }

    if (event.key === "Escape") setNavigationMenuOpen(false);
  });

  window.addEventListener("popstate", () => applyRoute({ focus: true }));

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

    await refreshAfterPaymentReturn();

    if (passwordRecoverySession || supabaseService?.hasPasswordRecoveryIntent?.()) {
      navigateTo({ name: "library" }, { replace: true, focus: false });
    } else {
      applyRoute({ focus: false });
    }
  }

  initializeApp();
})(window, document);
