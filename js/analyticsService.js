(function (window) {
  "use strict";

  const GENERATION_DIAGNOSTICS_KEY = "hedgehogFoxGenerationDiagnostics";
  const MAX_GENERATION_DIAGNOSTICS = 50;

  const EVENTS = {
    STORY_OPENED: "story_opened",
    STORY_FINISHED: "story_finished",
    JOURNEY_PLACE_OPENED: "journey_place_opened",
    JOURNEY_KEEPSAKE_FOUND: "journey_keepsake_found",
    STORY_LIKED: "story_liked",
    STORY_UNLIKED: "story_unliked",
    GENERATOR_OPENED: "generator_opened",
    STORY_GENERATED_MOCK: "story_generated_mock",
    LIBRARY_OPENED: "library_opened",
    SUBSCRIPTION_SCREEN_OPENED: "subscription_screen_opened",
    SUBSCRIPTION_BUTTON_CLICKED: "subscription_button_clicked",
    SUBSCRIPTION_LOADED: "subscription_loaded",
    GENERATION_LIMIT_CHECKED: "generation_limit_checked",
    GENERATION_LIMIT_REACHED: "generation_limit_reached",
    GENERATION_USAGE_INCREMENTED: "generation_usage_incremented",
    MOCK_SUBSCRIPTION_ACTIVATED: "mock_subscription_activated",
    SUBSCRIPTION_ERROR: "subscription_error",
    ABOUT_OPENED: "about_opened",
    ABOUT_READ_STORIES_CLICKED: "about_read_stories_clicked",
    ABOUT_CREATE_STORY_CLICKED: "about_create_story_clicked",
    GENERATION_WAITING_SCREEN_OPENED: "generation_waiting_screen_opened",
    MINI_GAME_SELECTED: "mini_game_selected",
    MINI_GAME_STARTED: "mini_game_started",
    MINI_GAME_COMPLETED: "mini_game_completed",
    MINI_GAME_SKIPPED: "mini_game_skipped",
    STORY_READY_DURING_GAME: "story_ready_during_game",
    STORY_OPENED_FROM_GAME: "story_opened_from_game"
  };

  function readGenerationDiagnostics() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(GENERATION_DIAGNOSTICS_KEY) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      console.warn("[analyticsService] Cannot read generation diagnostics", error);
      return [];
    }
  }

  function saveGenerationDiagnostics(items) {
    try {
      window.localStorage.setItem(
        GENERATION_DIAGNOSTICS_KEY,
        JSON.stringify(items.slice(-MAX_GENERATION_DIAGNOSTICS))
      );
    } catch (error) {
      console.warn("[analyticsService] Cannot save generation diagnostics", error);
    }
  }

  function normalizeFallbackReason(value) {
    const reason = String(value || "").trim();
    return reason ? reason.slice(0, 160) : "";
  }

  function recordGenerationResult({ mode, meta, fallbackReason } = {}) {
    const normalizedMode = String(mode || "unknown");
    const item = {
      createdAt: new Date().toISOString(),
      mode: normalizedMode,
      aiProvider: String(meta?.aiProvider || ""),
      hasFallback: normalizedMode.includes("fallback"),
      fallbackReason: normalizeFallbackReason(meta?.aiFallbackReason || fallbackReason)
    };
    const items = readGenerationDiagnostics();

    items.push(item);
    saveGenerationDiagnostics(items);
    trackEvent("generation_result_recorded", {
      mode: item.mode,
      aiProvider: item.aiProvider || undefined,
      hasFallback: item.hasFallback
    });

    return item;
  }

  function getGenerationDiagnostics() {
    const items = readGenerationDiagnostics();
    const fallbackCount = items.filter((item) => item.hasFallback).length;
    const aiCount = items.filter((item) => item.mode === "backend-ai").length;
    const browserMockCount = items.filter((item) => item.mode === "browser-mock").length;
    const fallbackModes = items.filter((item) => item.hasFallback);

    return {
      total: items.length,
      aiCount,
      fallbackCount,
      browserMockCount,
      fallbackRate: items.length ? Math.round((fallbackCount / items.length) * 1000) / 10 : 0,
      latestFallbackReasons: fallbackModes.slice(-5).map((item) => ({
        createdAt: item.createdAt,
        mode: item.mode,
        reason: item.fallbackReason || "не указана"
      })),
      items
    };
  }

  function getMetrikaCounterId() {
    return window.HEDGEHOG_FOX_METRIKA_ID || window.YANDEX_METRIKA_COUNTER_ID || null;
  }

  function trackEvent(eventName, params = {}) {
    const payload = {
      ...params,
      eventName,
      sentAt: new Date().toISOString()
    };
    const counterId = getMetrikaCounterId();

    try {
      if (counterId && typeof window.ym === "function") {
        window.ym(counterId, "reachGoal", eventName, payload);
        return;
      }
    } catch (error) {
      console.warn("[analyticsService] Yandex Metrika event failed", error);
    }

    console.log("[analytics]", eventName, payload);
  }

  window.HFAnalyticsService = {
    EVENTS,
    trackEvent,
    recordGenerationResult,
    getGenerationDiagnostics
  };
})(window);
