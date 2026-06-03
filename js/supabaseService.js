(function (window) {
  "use strict";

  const SESSION_KEY = "hedgehogFoxSupabaseSession";
  const config = window.HFConfig || {};
  const storage = window.HFStorageService;
  const listeners = [];

  let authState = {
    status: "signed_out",
    session: null,
    user: null,
    lastError: null
  };

  function isEnabled() {
    return Boolean(config.SUPABASE_ENABLED && config.SUPABASE_URL && config.SUPABASE_ANON_KEY);
  }

  function getBaseUrl() {
    return String(config.SUPABASE_URL || "").replace(/\/$/, "");
  }

  function getStoredSession() {
    if (!storage) return null;
    return storage.getJSON(SESSION_KEY, null);
  }

  function saveStoredSession(session) {
    if (!storage) return;
    if (session) {
      storage.setJSON(SESSION_KEY, session);
      return;
    }

    storage.removeItem(SESSION_KEY);
  }

  function notifyAuthListeners() {
    listeners.forEach((listener) => {
      try {
        listener(getAuthState());
      } catch (error) {
        console.warn("[supabaseService] Auth listener failed", error);
      }
    });
  }

  function setAuthState(nextState, shouldNotify = true) {
    authState = {
      ...authState,
      ...nextState
    };

    if (shouldNotify) notifyAuthListeners();
  }

  function getAuthState() {
    return {
      status: authState.status,
      session: authState.session,
      user: authState.user,
      lastError: authState.lastError
    };
  }

  function getCurrentUser() {
    return authState.user || authState.session?.user || null;
  }

  function isAuthenticated() {
    return Boolean(isEnabled() && authState.session?.access_token && getCurrentUser()?.id);
  }

  function onAuthStateChange(listener) {
    listeners.push(listener);

    return function unsubscribe() {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    };
  }

  function getAuthHeaders(accessToken) {
    return {
      apikey: config.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken || config.SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json"
    };
  }

  async function parseResponse(response) {
    const rawText = await response.text();
    const data = rawText ? JSON.parse(rawText) : null;

    if (!response.ok) {
      const message =
        data?.msg ||
        data?.message ||
        data?.error_description ||
        data?.hint ||
        response.statusText ||
        "Supabase request failed";
      const error = new Error(message);
      error.status = response.status;
      error.details = data;
      throw error;
    }

    return data;
  }

  async function request(path, options = {}, accessToken = null) {
    if (!isEnabled()) {
      throw new Error("Supabase is disabled");
    }

    const response = await window.fetch(`${getBaseUrl()}${path}`, {
      ...options,
      headers: {
        ...getAuthHeaders(accessToken),
        ...(options.headers || {})
      }
    });

    return parseResponse(response);
  }

  function normalizeAuthSession(payload) {
    if (!payload) return null;

    const source = payload.session || payload;
    if (!source.access_token) return null;

    return {
      access_token: source.access_token,
      refresh_token: source.refresh_token || payload.refresh_token || "",
      expires_at:
        source.expires_at ||
        Math.floor(Date.now() / 1000) + Number(source.expires_in || payload.expires_in || 3600),
      user: source.user || payload.user || null
    };
  }

  function isSessionExpired(session) {
    if (!session?.expires_at) return false;
    return session.expires_at <= Math.floor(Date.now() / 1000) + 60;
  }

  async function loadUser(session) {
    if (!session?.access_token) return null;

    if (session.user?.id) {
      return session.user;
    }

    return request("/auth/v1/user", { method: "GET" }, session.access_token);
  }

  async function refreshSession(session) {
    if (!session?.refresh_token) return null;

    const payload = await request(
      "/auth/v1/token?grant_type=refresh_token",
      {
        method: "POST",
        body: JSON.stringify({ refresh_token: session.refresh_token })
      },
      config.SUPABASE_ANON_KEY
    );
    const nextSession = normalizeAuthSession(payload);

    if (!nextSession) return null;

    nextSession.user = nextSession.user || session.user || null;
    saveStoredSession(nextSession);
    setAuthState({
      status: "signed_in",
      session: nextSession,
      user: nextSession.user,
      lastError: null
    });

    return nextSession;
  }

  async function ensureFreshSession() {
    if (!isAuthenticated()) return null;

    if (!isSessionExpired(authState.session)) {
      return authState.session;
    }

    return refreshSession(authState.session);
  }

  async function initializeAuth() {
    if (!isEnabled()) {
      setAuthState({ status: "disabled", session: null, user: null, lastError: null });
      return getAuthState();
    }

    const storedSession = getStoredSession();
    if (!storedSession?.access_token) {
      setAuthState({ status: "signed_out", session: null, user: null, lastError: null });
      return getAuthState();
    }

    try {
      const session = isSessionExpired(storedSession)
        ? await refreshSession(storedSession)
        : storedSession;
      const user = await loadUser(session);
      const nextSession = { ...session, user };

      saveStoredSession(nextSession);
      setAuthState({
        status: "signed_in",
        session: nextSession,
        user,
        lastError: null
      });
    } catch (error) {
      console.warn("[supabaseService] Cannot restore auth session", error);
      saveStoredSession(null);
      setAuthState({
        status: "signed_out",
        session: null,
        user: null,
        lastError: error.message
      });
    }

    return getAuthState();
  }

  async function signInWithPassword(email, password) {
    const payload = await request(
      "/auth/v1/token?grant_type=password",
      {
        method: "POST",
        body: JSON.stringify({ email, password })
      },
      config.SUPABASE_ANON_KEY
    );
    const session = normalizeAuthSession(payload);

    if (!session) {
      throw new Error("Supabase did not return an auth session");
    }

    const user = await loadUser(session);
    const nextSession = { ...session, user };

    saveStoredSession(nextSession);
    setAuthState({
      status: "signed_in",
      session: nextSession,
      user,
      lastError: null
    });

    return getAuthState();
  }

  async function signUpWithPassword(email, password) {
    const payload = await request(
      "/auth/v1/signup",
      {
        method: "POST",
        body: JSON.stringify({ email, password })
      },
      config.SUPABASE_ANON_KEY
    );
    const session = normalizeAuthSession(payload);

    if (!session) {
      setAuthState({
        status: "pending_confirmation",
        session: null,
        user: payload?.user || null,
        lastError: null
      });
      return getAuthState();
    }

    const user = await loadUser(session);
    const nextSession = { ...session, user };

    saveStoredSession(nextSession);
    setAuthState({
      status: "signed_in",
      session: nextSession,
      user,
      lastError: null
    });

    return getAuthState();
  }

  async function signOut() {
    if (authState.session?.access_token) {
      try {
        await request("/auth/v1/logout", { method: "POST" }, authState.session.access_token);
      } catch (error) {
        console.warn("[supabaseService] Remote logout failed", error);
      }
    }

    saveStoredSession(null);
    setAuthState({
      status: "signed_out",
      session: null,
      user: null,
      lastError: null
    });
  }

  function getMoodTag(mood) {
    const source = String(mood || "").toLowerCase();
    if (source.includes("сон") || source.includes("bedtime")) return "bedtime";
    if (source.includes("друж") || source.includes("friend")) return "friendship";
    if (source.includes("смел") || source.includes("bravery")) return "bravery";
    if (source.includes("приключ") || source.includes("adventure")) return "adventure";
    return "";
  }

  function getClientStoryFromRows(storyRow, pageRows) {
    const sortedPages = [...pageRows].sort((a, b) => Number(a.page_number) - Number(b.page_number));
    const pages = sortedPages.map((pageRow, index) => ({
      pageNumber: Number(pageRow.page_number || index + 1),
      text: pageRow.text || "",
      sceneTag: pageRow.scene_tag || "forest_day",
      imageUrl: pageRow.image_url || "",
      imagePrompt: pageRow.image_prompt || ""
    }));
    const ageGroup = storyRow.age_group || "5-7";
    const moodTag = getMoodTag(storyRow.mood);

    return {
      id: storyRow.id,
      title: storyRow.title || "Новая история",
      age: ageGroup.replace("-", "–"),
      ageGroup,
      mood: storyRow.mood || "",
      lesson: storyRow.lesson || "",
      time: `${Math.max(3, pages.length + 2)} минут`,
      tags: Array.from(new Set([ageGroup, moodTag].filter(Boolean))),
      imageUrl: "",
      baseLikes: 0,
      description: storyRow.lesson
        ? `Пользовательская история, где друзья узнают: ${storyRow.lesson}.`
        : "Пользовательская история про Ежонка и Лисёнка.",
      pages,
      slides: pages.map((page) => page.text),
      useIllustrations: true,
      createdAt: storyRow.created_at || "",
      updatedAt: storyRow.updated_at || "",
      source: "user",
      storage: "supabase"
    };
  }

  async function rest(path, options = {}) {
    const session = await ensureFreshSession();
    if (!session?.access_token) {
      throw new Error("User is not authenticated");
    }

    return request(path, options, session.access_token);
  }

  async function fetchStoryPages(storyId) {
    return rest(
      `/rest/v1/story_pages?select=*&story_id=eq.${encodeURIComponent(storyId)}&order=page_number.asc`,
      { method: "GET" }
    );
  }

  async function fetchUserStories() {
    const storyRows = await rest("/rest/v1/stories?select=*&order=created_at.desc", { method: "GET" });
    const pagesByStoryId = await Promise.all(
      storyRows.map(async (storyRow) => {
        const pageRows = await fetchStoryPages(storyRow.id);
        return [storyRow.id, pageRows];
      })
    );
    const pagesMap = new Map(pagesByStoryId);

    return storyRows.map((storyRow) => getClientStoryFromRows(storyRow, pagesMap.get(storyRow.id) || []));
  }

  async function insertStoryRow(story, userId) {
    const baseRow = {
      user_id: userId,
      title: story.title,
      age_group: story.ageGroup,
      mood: story.mood || "",
      lesson: story.lesson || ""
    };
    const rowWithVisibility = {
      ...baseRow,
      visibility: "private"
    };

    try {
      const rows = await rest("/rest/v1/stories?select=*", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(rowWithVisibility)
      });
      return Array.isArray(rows) ? rows[0] : rows;
    } catch (error) {
      const message = `${error.message || ""} ${JSON.stringify(error.details || {})}`;
      if (!message.includes("visibility")) throw error;

      const rows = await rest("/rest/v1/stories?select=*", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(baseRow)
      });
      return Array.isArray(rows) ? rows[0] : rows;
    }
  }

  async function insertPageRows(storyId, story) {
    const sourcePages = Array.isArray(story.pages) && story.pages.length
      ? story.pages
      : (story.slides || []).map((text, index) => ({ pageNumber: index + 1, text }));
    const pageRows = sourcePages.map((page, index) => ({
      story_id: storyId,
      page_number: Number(page.pageNumber || index + 1),
      text: page.text || "",
      scene_tag: page.sceneTag || "forest_day",
      image_url: page.imageUrl || "",
      image_prompt: page.imagePrompt || ""
    }));

    if (!pageRows.length) return [];

    const rows = await rest("/rest/v1/story_pages?select=*", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(pageRows)
    });

    return Array.isArray(rows) ? rows : [rows];
  }

  async function saveUserStory(story) {
    const user = getCurrentUser();
    if (!user?.id) {
      throw new Error("User is not authenticated");
    }

    const storyRow = await insertStoryRow(story, user.id);

    try {
      const pageRows = await insertPageRows(storyRow.id, story);
      return getClientStoryFromRows(storyRow, pageRows);
    } catch (error) {
      try {
        await deleteUserStory(storyRow.id);
      } catch (cleanupError) {
        console.warn("[supabaseService] Cannot clean up story after page insert failure", cleanupError);
      }

      throw error;
    }
  }

  async function deleteUserStory(storyId) {
    await rest(`/rest/v1/story_pages?story_id=eq.${encodeURIComponent(storyId)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });
    await rest(`/rest/v1/stories?id=eq.${encodeURIComponent(storyId)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });
  }

  window.HFSupabaseService = {
    isEnabled,
    isAuthenticated,
    getAuthState,
    getCurrentUser,
    onAuthStateChange,
    initializeAuth,
    signInWithPassword,
    signUpWithPassword,
    signOut,
    fetchUserStories,
    saveUserStory,
    deleteUserStory
  };
})(window);
