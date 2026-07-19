(function (window) {
  "use strict";

  const SESSION_KEY = "hedgehogFoxSupabaseSession";
  const STORAGE_REFERENCE_PREFIX = "storage://";
  const SIGNED_IMAGE_URL_TTL_SECONDS = 60 * 60;
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

  function getAuthParamsFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);

    hashParams.forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });

    return params;
  }

  function clearAuthParamsFromUrl() {
    if (!window.history?.replaceState) return;

    window.history.replaceState({}, document.title, window.location.pathname);
  }

  function hasPasswordRecoveryIntent() {
    const params = getAuthParamsFromUrl();
    const type = params.get("type");
    return (
      type === "recovery" ||
      params.get("auth_action") === "password_reset" ||
      Boolean(params.get("error") || params.get("error_code")) ||
      Boolean(params.get("access_token") && !type)
    );
  }

  function getAuthErrorFromUrl() {
    const params = getAuthParamsFromUrl();
    const error = params.get("error");
    const errorCode = params.get("error_code");
    const errorDescription = params.get("error_description");

    if (!error && !errorCode && !errorDescription) return null;

    return {
      error,
      errorCode,
      errorDescription
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

  async function requestPasswordRecovery(email) {
    const redirectTo = `${window.location.origin}${window.location.pathname}?auth_action=password_reset`;

    await request(
      `/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
      {
        method: "POST",
        body: JSON.stringify({ email })
      },
      config.SUPABASE_ANON_KEY
    );
  }

  async function getPasswordRecoverySessionFromUrl() {
    const params = getAuthParamsFromUrl();
    const type = params.get("type");
    const accessToken = params.get("access_token");

    if (!accessToken) return null;
    if (type && type !== "recovery") return null;

    const session = normalizeAuthSession({
      access_token: accessToken,
      refresh_token: params.get("refresh_token") || "",
      expires_in: Number(params.get("expires_in") || 3600),
      expires_at: Number(params.get("expires_at") || 0) || undefined
    });

    if (!session) return null;

    const nextSession = { ...session, user: null };

    saveStoredSession(nextSession);
    setAuthState({
      status: "password_recovery",
      session: nextSession,
      user: null,
      lastError: null
    });

    return nextSession;
  }

  async function updatePassword(accessToken, password) {
    await request(
      "/auth/v1/user",
      {
        method: "PUT",
        body: JSON.stringify({ password })
      },
      accessToken
    );
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

  function addDays(date, days) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
  }

  function getGenerationLimit(status) {
    if (status === "active") return 20;
    if (status === "trial") return 3;
    if (status === "expired") return 0;
    return 1;
  }

  function getSubscriptionFromRow(row) {
    return {
      id: row.id,
      userId: row.user_id,
      status: row.status || "free",
      provider: row.provider || "mock",
      providerSubscriptionId: row.provider_subscription_id || null,
      currentPeriodStart: row.current_period_start || null,
      currentPeriodEnd: row.current_period_end || null,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
      storage: "supabase"
    };
  }

  function getGenerationUsageFromRow(row) {
    return {
      id: row.id,
      userId: row.user_id,
      periodStart: row.period_start || null,
      periodEnd: row.period_end || null,
      generationsUsed: Number.isFinite(row.generations_used) ? row.generations_used : 0,
      generationLimit: Number.isFinite(row.generation_limit) ? row.generation_limit : 1,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
      storage: "supabase"
    };
  }

  async function fetchCurrentSubscriptionRow(userId) {
    const rows = await rest(
      `/rest/v1/subscriptions?select=*&user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc&limit=1`,
      { method: "GET" }
    );

    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async function fetchCurrentGenerationUsageRow(userId) {
    const now = new Date().toISOString();
    const rows = await rest(
      `/rest/v1/generation_usage?select=*&user_id=eq.${encodeURIComponent(userId)}&period_end=gte.${encodeURIComponent(now)}&order=period_start.desc&limit=1`,
      { method: "GET" }
    );

    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async function fetchSubscriptionBundle() {
    const user = getCurrentUser();
    if (!user?.id) throw new Error("User is not authenticated");

    const [subscriptionRow, usageRow] = await Promise.all([
      fetchCurrentSubscriptionRow(user.id),
      fetchCurrentGenerationUsageRow(user.id)
    ]);
    const now = new Date().toISOString();
    const defaultSubscription = {
      id: null,
      userId: user.id,
      status: "free",
      provider: "pending-server-setup",
      providerSubscriptionId: null,
      currentPeriodStart: now,
      currentPeriodEnd: null,
      createdAt: null,
      updatedAt: null,
      storage: "supabase"
    };
    const defaultUsage = {
      id: null,
      userId: user.id,
      periodStart: now,
      periodEnd: null,
      generationsUsed: 0,
      generationLimit: 1,
      createdAt: null,
      updatedAt: null,
      storage: "supabase"
    };

    return {
      subscription: subscriptionRow ? getSubscriptionFromRow(subscriptionRow) : defaultSubscription,
      usage: usageRow ? getGenerationUsageFromRow(usageRow) : defaultUsage
    };
  }

  async function getClientStoryFromRows(storyRow, pageRows) {
    const sortedPages = [...pageRows].sort((a, b) => Number(a.page_number) - Number(b.page_number));
    const pages = await Promise.all(
      sortedPages.map(async (pageRow, index) => {
        const imageReference = pageRow.image_url || "";
        const imageUrl = await resolveStoryImageUrl(imageReference, storyRow.id);

        return {
          pageNumber: Number(pageRow.page_number || index + 1),
          text: pageRow.text || "",
          sceneTag: pageRow.scene_tag || "forest_day",
          imageReference,
          imageUrl,
          illustrationUnavailable: Boolean(imageReference) && !imageUrl,
          imagePrompt: pageRow.image_prompt || ""
        };
      })
    );
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

  function parseStorageReference(value) {
    const source = String(value || "");
    if (!source.startsWith(STORAGE_REFERENCE_PREFIX)) return null;

    const reference = source.slice(STORAGE_REFERENCE_PREFIX.length);
    const separatorIndex = reference.indexOf("/");
    if (separatorIndex <= 0 || separatorIndex === reference.length - 1) return null;

    return {
      bucket: reference.slice(0, separatorIndex),
      objectPath: reference.slice(separatorIndex + 1)
    };
  }

  function encodeStoragePath(objectPath) {
    return String(objectPath || "")
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
  }

  async function resolveStoryImageUrl(imageUrl, storyId = "") {
    const reference = parseStorageReference(imageUrl);
    if (!reference) return imageUrl || "";

    // The backend signer is preferred because the bucket remains private. Do not
    // let a transient backend failure prevent the authenticated Storage fallback.
    try {
      if (config.ILLUSTRATION_SIGNING_API_URL && storyId) {
        try {
          const session = await ensureFreshSession();
          const response = await window.fetch(config.ILLUSTRATION_SIGNING_API_URL, {
            method: "POST",
            headers: getAuthHeaders(session?.access_token || ""),
            body: JSON.stringify({ imageReference: imageUrl, storyId })
          });
          const payload = await parseResponse(response);
          if (payload?.signedUrl) return payload.signedUrl;
        } catch (signingError) {
          console.warn("[supabaseService] Backend illustration signing failed; trying Storage fallback", signingError);
        }
      }

      const payload = await rest(
        `/storage/v1/object/sign/${encodeURIComponent(reference.bucket)}/${encodeStoragePath(reference.objectPath)}`,
        {
          method: "POST",
          body: JSON.stringify({ expiresIn: SIGNED_IMAGE_URL_TTL_SECONDS })
        }
      );
      const signedPath = payload?.signedURL || payload?.signedUrl || "";

      if (!signedPath) return "";
      if (/^https?:\/\//i.test(signedPath)) return signedPath;

      return `${getBaseUrl()}/storage/v1${signedPath.startsWith("/") ? signedPath : `/${signedPath}`}`;
    } catch (error) {
      console.warn("[supabaseService] Cannot sign story illustration", error);
      return "";
    }
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

    return Promise.all(
      storyRows.map((storyRow) => getClientStoryFromRows(storyRow, pagesMap.get(storyRow.id) || []))
    );
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

  async function fetchLikedStoryIds() {
    const rows = await rest("/rest/v1/story_likes?select=story_id&order=created_at.desc", {
      method: "GET"
    });

    return Array.isArray(rows) ? rows.map((row) => row.story_id).filter(Boolean) : [];
  }

  async function likeStory(storyId) {
    const user = getCurrentUser();
    if (!user?.id) {
      throw new Error("User is not authenticated");
    }

    await rest("/rest/v1/story_likes", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        story_id: storyId,
        user_id: user.id
      })
    });
  }

  async function unlikeStory(storyId) {
    await rest(`/rest/v1/story_likes?story_id=eq.${encodeURIComponent(storyId)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });
  }

  window.HFSupabaseService = {
    isEnabled,
    isAuthenticated,
    getAuthState,
    getCurrentUser,
    ensureFreshSession,
    onAuthStateChange,
    initializeAuth,
    signInWithPassword,
    signUpWithPassword,
    requestPasswordRecovery,
    getPasswordRecoverySessionFromUrl,
    hasPasswordRecoveryIntent,
    getAuthErrorFromUrl,
    updatePassword,
    clearAuthParamsFromUrl,
    signOut,
    fetchUserStories,
    saveUserStory,
    deleteUserStory,
    fetchLikedStoryIds,
    likeStory,
    unlikeStory,
    fetchSubscriptionBundle
  };
})(window);
