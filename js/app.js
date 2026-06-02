(function (window, document) {
  "use strict";

  const storyService = window.HFStoryService;
  const likeService = window.HFLikeService;
  const analyticsService = window.HFAnalyticsService;
  const { EVENTS, trackEvent } = analyticsService;

  const storyList = document.querySelector("#storyList");
  const filters = document.querySelector("#filters");
  const reader = document.querySelector("#reader");
  const slides = document.querySelector("#slides");
  const readerTitle = document.querySelector("#readerTitle");
  const readingProgress = document.querySelector("#readingProgress");
  const chooseStoryButton = document.querySelector("#chooseStoryButton");
  const readFirstButton = document.querySelector("#readFirstButton");
  const backToStoriesTop = document.querySelector("#backToStoriesTop");
  const readerLike = document.querySelector("#readerLike");
  const storiesSection = document.querySelector("#stories");
  const hero = document.querySelector(".hero");

  let activeFilter = "all";
  let activeStory = null;
  let activeStoryFinishedTracked = false;

  function renderLikeButton(story, variant = "") {
    const liked = likeService.isStoryLiked(story.id);
    const variantClass = variant ? ` ${variant}` : "";

    return `
      <button
        class="like-button${variantClass} ${liked ? "liked" : ""}"
        type="button"
        data-like="${story.id}"
        aria-pressed="${liked}"
        aria-label="${liked ? "Убрать лайк" : "Поставить лайк"}: ${story.title}"
      >
        <span class="like-icon" aria-hidden="true">${liked ? "♥" : "♡"}</span>
        <span class="like-text">Нравится</span>
        <span class="like-count">${likeService.getStoryLikeCount(story)}</span>
      </button>
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

    storyList.innerHTML = visibleStories
      .map((story) => {
        const [top, mid, bottom] = story.colors;

        return `
          <article class="story-card" style="--wash-color: ${top}88;">
            <div
              class="story-art ${story.imageUrl ? "has-image" : ""}"
              style="--art-top: ${top}; --art-mid: ${mid}; --art-bottom: ${bottom};"
              role="img"
              aria-label="Иллюстрация к истории ${story.title}"
            >
              ${story.imageUrl ? `<img src="${story.imageUrl}" alt="" loading="lazy" />` : ""}
            </div>
            <div class="story-content">
              <h3>${story.title}</h3>
              <div class="story-meta">
                <span class="pill">${story.age} лет</span>
                <span class="pill">${story.time}</span>
                ${renderLikeButton(story, "compact")}
              </div>
              <p>${story.description}</p>
              <div class="card-actions">
                <button class="button primary" data-read="${story.id}">Читать</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
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

    renderStories();
    renderReaderLike();
    trackEvent(isLiked ? EVENTS.STORY_LIKED : EVENTS.STORY_UNLIKED, {
      storyId,
      wasLiked
    });
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
    reader.classList.remove("hidden");

    const [top, mid, bottom] = activeStory.colors;
    const storySlides = activeStory.readerPages
      .map((page, index) => {
        return `
          <article
            class="slide"
            style="--slide-top: ${top}; --slide-wash: ${mid}99;"
          >
            <div class="slide-scene" aria-hidden="true"></div>
            <div class="slide-card with-illustration">
              <span class="slide-kicker">${page.pageNumber} из ${activeStory.readerPages.length}</span>
              <img
                class="reader-illustration"
                src="${page.imageUrl}"
                alt="Иллюстрация к истории ${activeStory.title}, страница ${page.pageNumber}"
                onerror="this.onerror=null; this.src='${page.fallbackImageUrl}';"
              />
              <p class="slide-text">${page.text}</p>
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

  filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    setFilter(button.dataset.filter);
  });

  storyList.addEventListener("click", (event) => {
    const likeButton = event.target.closest("[data-like]");
    if (likeButton) {
      handleStoryLike(likeButton.dataset.like);
      return;
    }

    const button = event.target.closest("[data-read]");
    if (!button) return;
    openStory(button.dataset.read);
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
    storiesSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  readFirstButton.addEventListener("click", () => {
    const [firstStory] = storyService.getAllStories();
    if (firstStory) openStory(firstStory.id);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeStory) {
      closeReader();
    }
  });

  renderStories();
})(window, document);
