(function (window, document) {
  "use strict";

  const storyService = window.HFStoryService;
  const likeService = window.HFLikeService;
  const subscriptionService = window.HFSubscriptionService;
  const analyticsService = window.HFAnalyticsService;
  const { EVENTS, trackEvent } = analyticsService;

  const storyList = document.querySelector("#storyList");
  const libraryList = document.querySelector("#libraryList");
  const libraryStatus = document.querySelector("#libraryStatus");
  const filters = document.querySelector("#filters");
  const reader = document.querySelector("#reader");
  const slides = document.querySelector("#slides");
  const readerTitle = document.querySelector("#readerTitle");
  const readingProgress = document.querySelector("#readingProgress");
  const chooseStoryButton = document.querySelector("#chooseStoryButton");
  const readFirstButton = document.querySelector("#readFirstButton");
  const openGeneratorButton = document.querySelector("#openGeneratorButton");
  const openLibraryButton = document.querySelector("#openLibraryButton");
  const backToStoriesTop = document.querySelector("#backToStoriesTop");
  const readerLike = document.querySelector("#readerLike");
  const generatorForm = document.querySelector("#generatorForm");
  const generationStatus = document.querySelector("#generationStatus");
  const subscriptionScreen = document.querySelector("#subscriptionScreen");
  const activateSubscriptionButton = document.querySelector("#activateSubscriptionButton");
  const storiesSection = document.querySelector("#stories");
  const generatorSection = document.querySelector("#generator");
  const librarySection = document.querySelector("#library");
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
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    if (eventName) trackEvent(eventName);
  }

  function getUsageText() {
    const subscription = subscriptionService.getSubscriptionState();
    const usage = subscriptionService.getGenerationUsage();

    return `Статус: ${subscription.status}. Создано: ${usage.generationsUsed} из ${usage.generationLimit}.`;
  }

  function updateGenerationStatus(message = "") {
    if (!generationStatus) return;
    generationStatus.textContent = message || getUsageText();
  }

  function showSubscriptionScreen() {
    subscriptionScreen.classList.remove("hidden");
    updateGenerationStatus("Лимит исчерпан.");
    trackEvent(EVENTS.SUBSCRIPTION_SCREEN_OPENED, subscriptionService.getGenerationUsage());
  }

  function hideSubscriptionScreen() {
    subscriptionScreen.classList.add("hidden");
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

    libraryStatus.textContent = userStories.length
      ? `${userStories.length} пользовательских историй. ${getUsageText()}`
      : `Пока нет пользовательских историй. ${getUsageText()}`;

    libraryList.innerHTML = userStories
      .map((story) => renderStoryCard(story, { canDelete: true }))
      .join("");
  }

  function renderAllStoryLists() {
    renderStories();
    renderLibrary();
  }

  function setFilter(filter) {
    activeFilter = filter;
    document.querySelectorAll(".filter-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.filter === filter);
    });
    renderStories();
  }

  function handleStoryLike(storyId) {
    const wasLiked = likeService.isStoryLiked(storyId);
    const isLiked = likeService.toggleStoryLike(storyId);

    renderAllStoryLists();
    renderReaderLike();
    trackEvent(isLiked ? EVENTS.STORY_LIKED : EVENTS.STORY_UNLIKED, {
      storyId,
      wasLiked
    });
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

  function handleGeneratorSubmit(event) {
    event.preventDefault();

    if (!subscriptionService.canGenerateStory()) {
      showSubscriptionScreen();
      return;
    }

    const formData = new FormData(generatorForm);
    const story = buildMockStory(formData);
    const savedStory = storyService.saveUserStory(story);

    subscriptionService.incrementGenerationUsage();
    hideSubscriptionScreen();
    updateGenerationStatus("История создана и сохранена в библиотеке.");
    renderAllStoryLists();
    generatorForm.reset();
    librarySection.scrollIntoView({ behavior: "smooth", block: "start" });
    trackEvent(EVENTS.STORY_GENERATED_MOCK, {
      storyId: savedStory.id,
      pageCount: savedStory.pages.length,
      mood: savedStory.mood
    });
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

  function handleLibraryClick(event) {
    const deleteButton = event.target.closest("[data-delete-story]");
    if (deleteButton) {
      storyService.deleteUserStory(deleteButton.dataset.deleteStory);
      renderAllStoryLists();
      updateGenerationStatus();
      return;
    }

    handleStoryListClick(event);
  }

  filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    setFilter(button.dataset.filter);
  });

  storyList.addEventListener("click", handleStoryListClick);
  libraryList.addEventListener("click", handleLibraryClick);

  generatorForm.addEventListener("submit", handleGeneratorSubmit);

  activateSubscriptionButton.addEventListener("click", () => {
    trackEvent(EVENTS.SUBSCRIPTION_BUTTON_CLICKED);
    subscriptionService.activateMockSubscription();
    hideSubscriptionScreen();
    updateGenerationStatus("Mock-подписка активна.");
    renderLibrary();
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

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeStory) {
      closeReader();
    }
  });

  updateGenerationStatus();
  renderAllStoryLists();
})(window, document);
