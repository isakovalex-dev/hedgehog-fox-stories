(function (window) {
  "use strict";

  const SUBSCRIPTION_KEY = "hedgehogFoxSubscription";
  const GENERATION_USAGE_KEY = "hedgehogFoxGenerationUsage";
  const VALID_STATUSES = ["free", "trial", "active", "expired"];

  function getCurrentPeriodKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function getGenerationLimit(status) {
    if (status === "active") return 20;
    if (status === "trial") return 3;
    if (status === "expired") return 0;
    return 1;
  }

  function getSubscriptionState() {
    const state = window.HFStorageService.getJSON(SUBSCRIPTION_KEY, { status: "free" });
    const rawStatus = typeof state === "string" ? state : state.status;
    const status = VALID_STATUSES.includes(rawStatus) ? rawStatus : "free";

    return {
      status,
      updatedAt: typeof state === "object" && state !== null ? state.updatedAt || null : null
    };
  }

  function setSubscriptionState(status) {
    const nextStatus = VALID_STATUSES.includes(status) ? status : "free";
    const nextState = {
      status: nextStatus,
      updatedAt: new Date().toISOString()
    };

    window.HFStorageService.setJSON(SUBSCRIPTION_KEY, nextState);
    return nextState;
  }

  function getGenerationUsage() {
    const subscription = getSubscriptionState();
    const periodKey = getCurrentPeriodKey();
    const usage = window.HFStorageService.getJSON(GENERATION_USAGE_KEY, {});

    if (usage.periodKey !== periodKey) {
      return {
        periodKey,
        generationsUsed: 0,
        generationLimit: getGenerationLimit(subscription.status)
      };
    }

    return {
      periodKey,
      generationsUsed: Number.isFinite(usage.generationsUsed) ? usage.generationsUsed : 0,
      generationLimit: getGenerationLimit(subscription.status)
    };
  }

  function canGenerateStory() {
    const usage = getGenerationUsage();
    return usage.generationsUsed < usage.generationLimit;
  }

  function incrementGenerationUsage() {
    const usage = getGenerationUsage();
    const nextUsage = {
      ...usage,
      generationsUsed: usage.generationsUsed + 1
    };

    window.HFStorageService.setJSON(GENERATION_USAGE_KEY, nextUsage);
    return nextUsage;
  }

  function activateMockSubscription() {
    return setSubscriptionState("active");
  }

  window.HFSubscriptionService = {
    getSubscriptionState,
    setSubscriptionState,
    getGenerationUsage,
    canGenerateStory,
    incrementGenerationUsage,
    activateMockSubscription
  };
})(window);
