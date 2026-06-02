(function (document) {
  "use strict";

  const scripts = [
    "js/storageService.js?v=6",
    "js/storyService.js?v=6",
    "js/likeService.js?v=6",
    "js/subscriptionService.js?v=6",
    "js/analyticsService.js?v=6",
    "js/app.js?v=6"
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
