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

  function getDiscoveredPlaceIds() {
    return new Set(getDiscoveries().map((item) => String(item.place || "cottage")));
  }

  function getJourneyProgress(places) {
    if (!Array.isArray(places) || !places.length) return 0;

    const discoveredPlaceIds = getDiscoveredPlaceIds();
    const furthestDiscoveredIndex = places.reduce((furthest, place, index) => {
      return discoveredPlaceIds.has(String(place?.id || "")) ? index : furthest;
    }, -1);

    if (furthestDiscoveredIndex < 0) return 0;

    const progress = furthestDiscoveredIndex / Math.max(places.length - 1, 1);
    return Math.min(1, Math.max(0, progress));
  }

  function clearDiscoveries() {
    return storage.removeItem(STORAGE_KEY);
  }

  window.HFJourneyService = {
    getDiscoveries,
    markDiscovered,
    isDiscovered,
    getDiscoveredPlaceIds,
    getJourneyProgress,
    clearDiscoveries
  };
})(window);
