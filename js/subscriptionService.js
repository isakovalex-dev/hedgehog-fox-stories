(function (window) {
  "use strict";

  const SUBSCRIPTION_KEY = "hedgehogFoxSubscription";
  const GENERATION_USAGE_KEY = "hedgehogFoxGenerationUsage";
  const VALID_STATUSES = ["free", "trial", "active", "expired"];
  const supabaseService = window.HFSupabaseService;

  let storageMode = "local";
  let lastError = "";
  let remoteSubscription = null;
  let remoteUsage = null;

  function trackEvent(eventName, params = {}) {
    try {
      window.HFAnalyticsService?.trackEvent?.(eventName, {
        ...params,
        subscriptionStorageMode: storageMode
      });
    } catch (error) {
      console.warn("[subscriptionService] Analytics event failed", error);
    }
  }

  function normalizeStatus(status) {
    return VALID_STATUSES.includes(status) ? status : "free";
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

  function getDefaultPeriod() {
    const now = new Date();
    return {
      periodStart: now.toISOString(),
      periodEnd: addDays(now, 30).toISOString()
    };
  }

  function isPeriodActive(periodEnd) {
    return Boolean(periodEnd && new Date(periodEnd).getTime() > Date.now());
  }

  function getCurrentPeriodKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function getLocalSubscriptionState() {
    const state = window.HFStorageService.getJSON(SUBSCRIPTION_KEY, { status: "free" });
    const rawStatus = typeof state === "string" ? state : state.status;
    const status = normalizeStatus(rawStatus);

    return {
      status,
      provider: typeof state === "object" && state !== null ? state.provider || "local" : "local",
      currentPeriodStart:
        typeof state === "object" && state !== null ? state.currentPeriodStart || null : null,
      currentPeriodEnd:
        typeof state === "object" && state !== null ? state.currentPeriodEnd || null : null,
      updatedAt: typeof state === "object" && state !== null ? state.updatedAt || null : null,
      storage: "local"
    };
  }

  function setLocalSubscriptionState(status) {
    const nextStatus = normalizeStatus(status);
    const currentState = getLocalSubscriptionState();
    const now = new Date();
    const nextState = {
      status: nextStatus,
      provider: "local-mock",
      currentPeriodStart: currentState.currentPeriodStart || now.toISOString(),
      currentPeriodEnd: currentState.currentPeriodEnd || addDays(now, 30).toISOString(),
      updatedAt: now.toISOString(),
      storage: "local"
    };

    window.HFStorageService.setJSON(SUBSCRIPTION_KEY, nextState);
    return nextState;
  }

  function getLocalGenerationUsage() {
    const subscription = getLocalSubscriptionState();
    const usage = window.HFStorageService.getJSON(GENERATION_USAGE_KEY, {});
    const expectedLimit = getGenerationLimit(subscription.status);
    const legacyPeriodKey = getCurrentPeriodKey();

    if (usage.periodStart && isPeriodActive(usage.periodEnd)) {
      return {
        periodStart: usage.periodStart,
        periodEnd: usage.periodEnd,
        periodKey: usage.periodKey || legacyPeriodKey,
        generationsUsed: Number.isFinite(usage.generationsUsed) ? usage.generationsUsed : 0,
        generationLimit: expectedLimit,
        storage: "local"
      };
    }

    if (usage.periodKey === legacyPeriodKey && Number.isFinite(usage.generationsUsed)) {
      const period = getDefaultPeriod();
      return {
        ...period,
        periodKey: legacyPeriodKey,
        generationsUsed: usage.generationsUsed,
        generationLimit: expectedLimit,
        storage: "local"
      };
    }

    return {
      ...getDefaultPeriod(),
      periodKey: legacyPeriodKey,
      generationsUsed: 0,
      generationLimit: expectedLimit,
      storage: "local"
    };
  }

  function setLocalGenerationUsage(usage) {
    const nextUsage = {
      ...usage,
      storage: "local",
      updatedAt: new Date().toISOString()
    };

    window.HFStorageService.setJSON(GENERATION_USAGE_KEY, nextUsage);
    return nextUsage;
  }

  function canUseSupabaseSubscription() {
    return Boolean(supabaseService?.isEnabled?.() && supabaseService?.isAuthenticated?.());
  }

  function getSubscriptionState() {
    if (storageMode === "supabase" && remoteSubscription) {
      return {
        ...remoteSubscription,
        storage: "supabase"
      };
    }

    return getLocalSubscriptionState();
  }

  function getGenerationUsage() {
    if (storageMode === "supabase" && remoteUsage) {
      return {
        ...remoteUsage,
        storage: "supabase"
      };
    }

    return getLocalGenerationUsage();
  }

  function getStorageState() {
    return {
      mode: storageMode,
      isRemote: storageMode === "supabase",
      isFallback: storageMode === "local_fallback",
      lastError
    };
  }

  async function initializeSubscription() {
    if (!canUseSupabaseSubscription()) {
      storageMode = "local";
      lastError = "";
      remoteSubscription = null;
      remoteUsage = null;
      trackEvent("subscription_loaded", {
        status: getSubscriptionState().status,
        usage: getGenerationUsage()
      });
      return {
        subscription: getSubscriptionState(),
        usage: getGenerationUsage(),
        storage: getStorageState()
      };
    }

    try {
      const bundle = await supabaseService.fetchSubscriptionBundle();
      remoteSubscription = bundle.subscription;
      remoteUsage = bundle.usage;
      storageMode = "supabase";
      lastError = "";
      trackEvent("subscription_loaded", {
        status: remoteSubscription.status,
        usage: remoteUsage
      });
    } catch (error) {
      console.warn("[subscriptionService] Supabase subscription unavailable, using localStorage", error);
      storageMode = "local_fallback";
      lastError = error.message || "Supabase недоступен";
      remoteSubscription = null;
      remoteUsage = null;
      trackEvent("subscription_error", { action: "initializeSubscription", error: lastError });
    }

    return {
      subscription: getSubscriptionState(),
      usage: getGenerationUsage(),
      storage: getStorageState()
    };
  }

  function canGenerateStory() {
    const usage = getGenerationUsage();
    const canGenerate = storageMode === "supabase"
      ? usage.storyRemaining > 0
      : usage.generationsUsed < usage.generationLimit;

    trackEvent("generation_limit_checked", {
      canGenerate,
      generationsUsed: usage.generationsUsed,
      generationLimit: usage.generationLimit
    });

    if (!canGenerate) {
      trackEvent("generation_limit_reached", {
        generationsUsed: usage.generationsUsed,
        generationLimit: usage.generationLimit
      });
    }

    return canGenerate;
  }

  function canGenerateImage() {
    const usage = getGenerationUsage();
    return storageMode === "supabase" && usage.imageRemaining > 0;
  }

  async function incrementLocalGenerationUsage() {
    const usage = getGenerationUsage();
    const nextGenerationsUsed = usage.generationsUsed + 1;

    const nextUsage = setLocalGenerationUsage({
      ...usage,
      generationsUsed: nextGenerationsUsed
    });

    trackEvent("generation_usage_incremented", {
      generationsUsed: nextUsage.generationsUsed,
      generationLimit: nextUsage.generationLimit
    });

    return nextUsage;
  }

  window.HFSubscriptionService = {
    getSubscriptionState,
    getGenerationUsage,
    canGenerateStory,
    canGenerateImage,
    incrementLocalGenerationUsage,
    initializeSubscription,
    getStorageState
  };
})(window);
