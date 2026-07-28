(function (window) {
  "use strict";

  const STORAGE_KEY = "hedgehogFoxJourneyDiscoveriesV1";
  const storage = window.HFStorageService;

  function getDiscoveries() {
    const items = storage.getJSON(STORAGE_KEY, []);
    return Array.isArray(items) ? items.filter((item) => item && item.storyId) : [];
  }

  function markDiscovered(story) {
    if (!story?.id) return null;
    const current = getDiscoveries();
    const existing = current.find((item) => item.storyId === story.id);
    if (existing) return existing;

    const discovery = {
      storyId: String(story.id),
      place: String(story.journeyPlace || "cottage"),
      keepsake: String(story.keepsake || "feather"),
      discoveredAt: new Date().toISOString()
    };

    storage.setJSON(STORAGE_KEY, [...current, discovery]);
    return discovery;
  }

  function isDiscovered(storyId) {
    return getDiscoveries().some((item) => item.storyId === storyId);
  }

  function clearDiscoveries() {
    return storage.removeItem(STORAGE_KEY);
  }

  window.HFJourneyService = {
    getDiscoveries,
    markDiscovered,
    isDiscovered,
    clearDiscoveries
  };
})(window);
