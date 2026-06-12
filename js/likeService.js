(function (window) {
  "use strict";

  const LIKED_STORIES_KEY = "hedgehogFoxLikedStories";
  const supabaseService = window.HFSupabaseService;

  let remoteLikedStories = [];
  let storageMode = "local";
  let lastStorageError = "";

  function getLikedStories() {
    if (storageMode === "supabase") {
      return [...remoteLikedStories];
    }

    const likedStories = window.HFStorageService.getJSON(LIKED_STORIES_KEY, []);
    return Array.isArray(likedStories) ? likedStories.filter(Boolean) : [];
  }

  function saveLikedStories(likedStories) {
    window.HFStorageService.setJSON(LIKED_STORIES_KEY, Array.from(new Set(likedStories)));
  }

  function isStoryLiked(storyId) {
    return getLikedStories().includes(storyId);
  }

  function canUseSupabaseLikes() {
    return Boolean(supabaseService?.isEnabled?.() && supabaseService?.isAuthenticated?.());
  }

  function setRemoteLikedStories(storyIds) {
    remoteLikedStories = Array.from(new Set((storyIds || []).filter(Boolean)));
  }

  async function initializeLikes() {
    if (!canUseSupabaseLikes()) {
      setRemoteLikedStories([]);
      storageMode = "local";
      lastStorageError = "";
      return getLikedStories();
    }

    try {
      setRemoteLikedStories(await supabaseService.fetchLikedStoryIds());
      storageMode = "supabase";
      lastStorageError = "";
    } catch (error) {
      console.warn("[likeService] Supabase likes unavailable, using localStorage", error);
      setRemoteLikedStories([]);
      storageMode = "local_fallback";
      lastStorageError = error.message || "Supabase недоступен";
    }

    return getLikedStories();
  }

  async function toggleLocalStoryLike(storyId) {
    const likedStories = getLikedStories();

    if (likedStories.includes(storyId)) {
      saveLikedStories(likedStories.filter((id) => id !== storyId));
      return false;
    }

    saveLikedStories([...likedStories, storyId]);
    return true;
  }

  async function toggleRemoteStoryLike(storyId) {
    const wasLiked = remoteLikedStories.includes(storyId);

    if (wasLiked) {
      setRemoteLikedStories(remoteLikedStories.filter((id) => id !== storyId));
      await supabaseService.unlikeStory(storyId);
      return false;
    }

    setRemoteLikedStories([...remoteLikedStories, storyId]);

    try {
      await supabaseService.likeStory(storyId);
    } catch (error) {
      const message = `${error.message || ""} ${JSON.stringify(error.details || {})}`;
      if (!message.includes("duplicate key") && !message.includes("23505")) {
        throw error;
      }
    }

    return true;
  }

  async function toggleStoryLike(storyId) {
    if (storageMode === "supabase" && canUseSupabaseLikes()) {
      try {
        lastStorageError = "";
        return await toggleRemoteStoryLike(storyId);
      } catch (error) {
        console.warn("[likeService] Cannot save like to Supabase, using localStorage fallback", error);
        setRemoteLikedStories([]);
        storageMode = "local_fallback";
        lastStorageError = error.message || "Supabase недоступен";
      }
    }

    return toggleLocalStoryLike(storyId);
  }

  function getStoryLikeCount(story) {
    const baseLikes = Number.isFinite(story.baseLikes) ? story.baseLikes : 0;
    return baseLikes + (isStoryLiked(story.id) ? 1 : 0);
  }

  function getStorageState() {
    return {
      mode: storageMode,
      isRemote: storageMode === "supabase",
      isFallback: storageMode === "local_fallback",
      lastError: lastStorageError
    };
  }

  window.HFLikeService = {
    getLikedStories,
    initializeLikes,
    isStoryLiked,
    toggleStoryLike,
    getStoryLikeCount,
    getStorageState
  };
})(window);
