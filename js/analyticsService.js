(function (window) {
  "use strict";

  const EVENTS = {
    STORY_OPENED: "story_opened",
    STORY_FINISHED: "story_finished",
    STORY_LIKED: "story_liked",
    STORY_UNLIKED: "story_unliked",
    GENERATOR_OPENED: "generator_opened",
    STORY_GENERATED_MOCK: "story_generated_mock",
    LIBRARY_OPENED: "library_opened",
    SUBSCRIPTION_SCREEN_OPENED: "subscription_screen_opened",
    SUBSCRIPTION_BUTTON_CLICKED: "subscription_button_clicked"
  };

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
    trackEvent
  };
})(window);
