(function (window) {
  "use strict";

  const LIKED_STORIES_KEY = "hedgehogFoxLikedStories";

  function getLikedStories() {
    const likedStories = window.HFStorageService.getJSON(LIKED_STORIES_KEY, []);
    return Array.isArray(likedStories) ? likedStories.filter(Boolean) : [];
  }

  function saveLikedStories(likedStories) {
    window.HFStorageService.setJSON(LIKED_STORIES_KEY, Array.from(new Set(likedStories)));
  }

  function isStoryLiked(storyId) {
    return getLikedStories().includes(storyId);
  }

  function toggleStoryLike(storyId) {
    const likedStories = getLikedStories();

    if (likedStories.includes(storyId)) {
      saveLikedStories(likedStories.filter((id) => id !== storyId));
      return false;
    }

    saveLikedStories([...likedStories, storyId]);
    return true;
  }

  function getStoryLikeCount(story) {
    const baseLikes = Number.isFinite(story.baseLikes) ? story.baseLikes : 0;
    return baseLikes + (isStoryLiked(story.id) ? 1 : 0);
  }

  window.HFLikeService = {
    getLikedStories,
    isStoryLiked,
    toggleStoryLike,
    getStoryLikeCount
  };
})(window);
