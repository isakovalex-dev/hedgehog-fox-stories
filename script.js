(function (document) {
  "use strict";

  const scripts = [
    "js/config.js?v=8",
    "js/storageService.js?v=8",
    "js/supabaseService.js?v=8",
    "js/storyService.js?v=8",
    "js/likeService.js?v=8",
    "js/subscriptionService.js?v=8",
    "js/analyticsService.js?v=8",
    "js/app.js?v=8"
  ];

  function loadNextScript(index) {
    if (index >= scripts.length) return;

    const script = document.createElement("script");
    script.src = scripts[index];
    script.onload = () => loadNextScript(index + 1);
    script.onerror = () => {
      console.error(`[legacy script] Cannot load ${scripts[index]}`);
    };
    document.body.appendChild(script);
  }

  loadNextScript(0);
})(document);
