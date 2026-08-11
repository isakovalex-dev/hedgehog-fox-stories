(function (document, window) {
  "use strict";

  const analytics = window.HFAnalyticsService;
  if (!analytics) return;

  const { EVENTS, trackEvent } = analytics;
  trackEvent(EVENTS.ABOUT_OPENED, { source: "about_html" });

  document.querySelectorAll("[data-about-read-stories]").forEach((link) => {
    link.addEventListener("click", () => {
      trackEvent(EVENTS.ABOUT_READ_STORIES_CLICKED, { source: "about_html" });
    });
  });

  document.querySelectorAll("[data-about-create-story]").forEach((link) => {
    link.addEventListener("click", () => {
      trackEvent(EVENTS.ABOUT_CREATE_STORY_CLICKED, { source: "about_html" });
    });
  });
})(document, window);
