(function (root, documentRef) {
  "use strict";

  const INTRO_CONFIG = {
    enabled: true,
    showOncePerSession: true,
    dayStartHour: 8,
    nightStartHour: 20,
    exitDurationMs: 600,
    sessionStorageKey: "ezhik-intro-seen-v1"
  };

  function getIntroTheme(date = new Date()) {
    const hour = date.getHours();
    return hour >= INTRO_CONFIG.dayStartHour && hour < INTRO_CONFIG.nightStartHour ? "day" : "night";
  }

  function getIntroLayout() {
    const viewportWidth = Number(root.innerWidth) || 0;
    const viewportHeight = Number(root.innerHeight) || 0;
    const narrow = viewportWidth < 768;
    const portrait = viewportHeight > viewportWidth * 1.1;

    return narrow || portrait ? "mobile" : "desktop";
  }

  function getIntroMedia(theme, layout) {
    const name = `intro-${theme}-${layout}`;
    const basePath = "/assets/intro";

    return {
      mp4: `${basePath}/${name}.mp4`,
      poster: `${basePath}/${name}-poster.webp`,
      webm: `${basePath}/${name}.webm`
    };
  }

  function safelyReadSessionStorage() {
    try {
      return root.sessionStorage?.getItem(INTRO_CONFIG.sessionStorageKey) === "true";
    } catch (error) {
      return false;
    }
  }

  function safelyWriteSessionStorage() {
    try {
      root.sessionStorage?.setItem(INTRO_CONFIG.sessionStorageKey, "true");
    } catch (error) {
      // Private browsing and restrictive browser settings must not block the page.
    }
  }

  function shouldShowIntro() {
    const pathname = root.location?.pathname || "/";
    const isHomePage = pathname === "/" || pathname === "";

    if (!INTRO_CONFIG.enabled || !isHomePage) return false;
    return !INTRO_CONFIG.showOncePerSession || !safelyReadSessionStorage();
  }

  function releaseVideo(video) {
    if (!video) return;

    video.pause();
    video.removeAttribute("src");
    video.querySelectorAll("source").forEach((source) => source.removeAttribute("src"));
    video.load();
  }

  function mountIntroSplash() {
    if (!documentRef?.body || !shouldShowIntro()) return null;

    const body = documentRef.body;
    const mainContent = documentRef.querySelector("#mainContent");
    const overlay = documentRef.createElement("section");
    const frame = documentRef.createElement("div");
    const poster = documentRef.createElement("img");
    const closeButton = documentRef.createElement("button");
    const inertElements = [];
    let activeVideo = null;
    let isExiting = false;
    let isFinished = false;
    let activeTheme = "";
    let activeLayout = "";
    let finishTimerId = null;

    overlay.className = "intro-splash";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Добро пожаловать в мир приключений Ёжика и Лисёнка");

    frame.className = "intro-frame";

    poster.className = "intro-poster";
    poster.alt = "";
    poster.setAttribute("aria-hidden", "true");

    closeButton.className = "intro-hit-button";
    closeButton.type = "button";
    closeButton.setAttribute(
      "aria-label",
      "Добро пожаловать в мир приключений. Перейти на главную страницу"
    );

    frame.append(poster, closeButton);
    overlay.append(frame);
    body.append(overlay);
    body.classList.add("intro-splash-open");

    function setMainContentInert() {
      Array.from(body.children).forEach((element) => {
        if (element === overlay || !("inert" in element)) return;

        inertElements.push({ element, value: element.inert });
        element.inert = true;
      });
    }

    function restoreMainContentInteractivity() {
      inertElements.forEach(({ element, value }) => {
        element.inert = value;
      });
    }

    function prefersReducedMotion() {
      return root.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    }

    function markVideoUnavailable() {
      activeVideo?.classList.add("is-unavailable");
    }

    function createVideo(media) {
      const video = documentRef.createElement("video");
      const webmSource = documentRef.createElement("source");
      const mp4Source = documentRef.createElement("source");
      let failedSources = 0;

      video.className = "intro-video";
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "auto";
      video.setAttribute("autoplay", "");
      video.setAttribute("muted", "");
      video.setAttribute("loop", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("aria-hidden", "true");

      webmSource.src = media.webm;
      webmSource.type = "video/webm";
      mp4Source.src = media.mp4;
      mp4Source.type = "video/mp4";
      const handleSourceError = () => {
        failedSources += 1;
        if (failedSources === 2) markVideoUnavailable();
      };

      webmSource.addEventListener("error", handleSourceError);
      mp4Source.addEventListener("error", handleSourceError);
      video.append(webmSource, mp4Source);
      video.addEventListener("error", markVideoUnavailable);

      return video;
    }

    function renderMedia() {
      const nextTheme = activeTheme || getIntroTheme();
      const nextLayout = getIntroLayout();

      if (nextTheme === activeTheme && nextLayout === activeLayout) return;

      activeTheme = nextTheme;
      activeLayout = nextLayout;
      const media = getIntroMedia(activeTheme, activeLayout);

      overlay.dataset.theme = activeTheme;
      overlay.dataset.layout = activeLayout;
      frame.className = `intro-frame intro-frame--${activeLayout}`;
      closeButton.className = `intro-hit-button intro-hit-button--${activeLayout}`;
      poster.src = media.poster;

      if (activeVideo) {
        releaseVideo(activeVideo);
        activeVideo.remove();
        activeVideo = null;
      }

      if (prefersReducedMotion()) return;

      activeVideo = createVideo(media);
      frame.insertBefore(activeVideo, closeButton);
      const playPromise = activeVideo.play();
      if (playPromise?.catch) playPromise.catch(markVideoUnavailable);
    }

    function finishClosing() {
      if (isFinished) return;

      isFinished = true;
      if (finishTimerId) root.clearTimeout(finishTimerId);
      releaseVideo(activeVideo);
      root.removeEventListener("resize", renderMedia);
      documentRef.removeEventListener("keydown", handleKeydown, true);
      restoreMainContentInteractivity();
      body.classList.remove("intro-splash-open");
      overlay.remove();
      mainContent?.focus({ preventScroll: true });
    }

    function handleTransitionEnd(event) {
      if (event.target === overlay && event.propertyName === "opacity") finishClosing();
    }

    function closeIntro() {
      if (isExiting) return;

      isExiting = true;
      closeButton.disabled = true;
      safelyWriteSessionStorage();
      overlay.classList.add("is-exiting");
      overlay.addEventListener("transitionend", handleTransitionEnd);
      finishTimerId = root.setTimeout(finishClosing, INTRO_CONFIG.exitDurationMs + 100);
    }

    function handleKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeIntro();
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        overlay.classList.add("is-keyboard-navigation");
        closeButton.focus();
      }
    }

    setMainContentInert();
    renderMedia();
    closeButton.addEventListener("click", closeIntro);
    root.addEventListener("resize", renderMedia, { passive: true });
    documentRef.addEventListener("keydown", handleKeydown, true);
    root.requestAnimationFrame?.(() => closeButton.focus({ preventScroll: true }));

    return { close: closeIntro, element: overlay };
  }

  const introApi = {
    INTRO_CONFIG,
    getIntroLayout,
    getIntroMedia,
    getIntroTheme,
    mountIntroSplash
  };
  root.HFIntroSplash = introApi;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = introApi;
  }
  if (documentRef) {
    if (documentRef.readyState === "loading") {
      documentRef.addEventListener("DOMContentLoaded", mountIntroSplash, { once: true });
    } else {
      mountIntroSplash();
    }
  }
})(typeof window !== "undefined" ? window : globalThis, typeof document !== "undefined" ? document : null);
