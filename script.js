(function (document) {
  "use strict";

  const scripts = [
    "js/config.js?v=9",
    "js/storageService.js?v=9",
    "js/supabaseService.js?v=9",
    "js/storyService.js?v=9",
    "js/likeService.js?v=9",
    "js/subscriptionService.js?v=9",
    "js/analyticsService.js?v=9",
    "js/app.js?v=9"
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
