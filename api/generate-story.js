"use strict";

const ALLOWED_SCENE_TAGS = [
  "sea_bench",
  "forest_day",
  "forest_night",
  "cozy_house",
  "starry_sky",
  "rainy_forest",
  "sunny_meadow",
  "river_bank",
  "autumn_path",
  "winter_forest",
  "warm_kitchen",
  "small_bridge",
  "hill_clouds",
  "mushroom_glade",
  "campfire_evening"
];

const MOOD_CONFIG = {
  bedtime: {
    label: "перед сном",
    scenes: ["cozy_house", "starry_sky", "forest_night", "warm_kitchen", "hill_clouds"]
  },
  adventure: {
    label: "приключение",
    scenes: ["forest_day", "small_bridge", "river_bank", "mushroom_glade", "hill_clouds"]
  },
  friendship: {
    label: "про дружбу",
    scenes: ["sunny_meadow", "sea_bench", "forest_day", "warm_kitchen", "starry_sky"]
  },
  bravery: {
    label: "про смелость",
    scenes: ["autumn_path", "rainy_forest", "small_bridge", "forest_night", "campfire_evening"]
  }
};

const DEFAULT_ORIGIN = "https://ezhik-i-lisenok.ru";
const MAX_STORY_TITLE_LENGTH = 120;
const MAX_STORY_LESSON_LENGTH = 160;
const MAX_PAGE_TEXT_LENGTH = 700;
const MAX_IMAGE_PROMPT_LENGTH = 240;
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ynidvdesfolavhngubqv.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || "sb_publishable_nQg--YaINF8OoBd4wceHkA_yo76Z5hy";
const AI_GENERATION_ENABLED = process.env.AI_GENERATION_ENABLED === "true";
const AI_API_BASE_URL = process.env.AI_API_BASE_URL || "";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "";
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 6;
const generationRequestTimes = new Map();
const LOCAL_ORIGINS = new Set([
  "http://localhost:8000",
  "http://localhost:8001",
  "http://localhost:8002",
  "http://localhost:8003",
  "http://localhost:8004",
  "http://127.0.0.1:8000"
]);

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

function getAllowedOrigin(origin) {
  if (!origin) return DEFAULT_ORIGIN;
  if (origin === DEFAULT_ORIGIN || LOCAL_ORIGINS.has(origin)) return origin;
  return DEFAULT_ORIGIN;
}

function getBearerToken(req) {
  const authorization = req.headers?.authorization || req.headers?.Authorization || "";
  const match = String(authorization).match(/^Bearer\s+(.+)$/i);

  return match ? match[1] : "";
}

function createHttpError(statusCode, message, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function getSafeLogError(error) {
  return {
    statusCode: Number(error?.statusCode) || 500,
    name: String(error?.name || "Error").slice(0, 80),
    message: String(error?.message || "Unknown error").slice(0, 180)
  };
}

function getSafeClientErrorDetails(error) {
  const details = error?.details;

  if (Array.isArray(details)) {
    return details.slice(0, 5).map((item) => String(item).slice(0, 200));
  }

  if (!details || typeof details !== "object") return null;

  const safeDetails = {};
  if (typeof details.status === "string") safeDetails.status = details.status.slice(0, 40);
  if (Number.isFinite(Number(details.generationsUsed))) {
    safeDetails.generationsUsed = Number(details.generationsUsed);
  }
  if (Number.isFinite(Number(details.generationLimit))) {
    safeDetails.generationLimit = Number(details.generationLimit);
  }

  return Object.keys(safeDetails).length ? safeDetails : null;
}

function logGenerationEvent(event, fields = {}) {
  console.log(
    "[generate-story]",
    JSON.stringify({
      event,
      ...fields
    })
  );
}

async function parseSupabaseResponse(response) {
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
    throw createHttpError(response.status, message, data);
  }

  return data;
}

async function supabaseRequest(path, options = {}, accessToken) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw createHttpError(500, "Supabase backend config is missing");
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  return parseSupabaseResponse(response);
}

async function getAuthenticatedUser(accessToken) {
  if (!accessToken) {
    throw createHttpError(401, "Authorization token is required");
  }

  const user = await supabaseRequest("/auth/v1/user", { method: "GET" }, accessToken);

  if (!user?.id) {
    throw createHttpError(401, "Authorization token is invalid");
  }

  return user;
}

function getSubscriptionRowPayload(userId, status = "free") {
  const now = new Date();

  return {
    user_id: userId,
    status,
    provider: "mock",
    provider_subscription_id: null,
    current_period_start: now.toISOString(),
    current_period_end: addDays(now, 30).toISOString(),
    updated_at: now.toISOString()
  };
}

function getGenerationUsageRowPayload(userId, status = "free") {
  const now = new Date();

  return {
    user_id: userId,
    period_start: now.toISOString(),
    period_end: addDays(now, 30).toISOString(),
    generations_used: 0,
    generation_limit: getGenerationLimit(status),
    updated_at: now.toISOString()
  };
}

async function fetchCurrentSubscriptionRow(userId, accessToken) {
  const rows = await supabaseRequest(
    `/rest/v1/subscriptions?select=*&user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc&limit=1`,
    { method: "GET" },
    accessToken
  );

  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function createSubscriptionRow(userId, accessToken, status = "free") {
  const rows = await supabaseRequest(
    "/rest/v1/subscriptions?select=*",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(getSubscriptionRowPayload(userId, status))
    },
    accessToken
  );

  return Array.isArray(rows) ? rows[0] : rows;
}

async function ensureSubscriptionRow(userId, accessToken) {
  const existingRow = await fetchCurrentSubscriptionRow(userId, accessToken);
  return existingRow || createSubscriptionRow(userId, accessToken, "free");
}

async function fetchCurrentGenerationUsageRow(userId, accessToken) {
  const now = new Date().toISOString();
  const rows = await supabaseRequest(
    `/rest/v1/generation_usage?select=*&user_id=eq.${encodeURIComponent(userId)}&period_end=gte.${encodeURIComponent(now)}&order=period_start.desc&limit=1`,
    { method: "GET" },
    accessToken
  );

  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function createGenerationUsageRow(userId, accessToken, status = "free") {
  const rows = await supabaseRequest(
    "/rest/v1/generation_usage?select=*",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(getGenerationUsageRowPayload(userId, status))
    },
    accessToken
  );

  return Array.isArray(rows) ? rows[0] : rows;
}

async function updateGenerationUsageLimit(usageId, accessToken, generationLimit) {
  const rows = await supabaseRequest(
    `/rest/v1/generation_usage?id=eq.${encodeURIComponent(usageId)}&select=*`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        generation_limit: generationLimit,
        updated_at: new Date().toISOString()
      })
    },
    accessToken
  );

  return Array.isArray(rows) ? rows[0] : rows;
}

async function updateGenerationUsageCount(usageId, accessToken, generationsUsed) {
  const rows = await supabaseRequest(
    `/rest/v1/generation_usage?id=eq.${encodeURIComponent(usageId)}&select=*`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        generations_used: generationsUsed,
        updated_at: new Date().toISOString()
      })
    },
    accessToken
  );

  return Array.isArray(rows) ? rows[0] : rows;
}

async function ensureGenerationUsageRow(userId, accessToken, status) {
  const existingRow = await fetchCurrentGenerationUsageRow(userId, accessToken);
  const expectedLimit = getGenerationLimit(status);

  if (!existingRow) {
    return createGenerationUsageRow(userId, accessToken, status);
  }

  if (Number(existingRow.generation_limit) !== expectedLimit) {
    return updateGenerationUsageLimit(existingRow.id, accessToken, expectedLimit);
  }

  return existingRow;
}

function enforceGenerationRateLimit(userId) {
  const now = Date.now();
  const requestTimes = (generationRequestTimes.get(userId) || []).filter(
    (time) => now - time < RATE_LIMIT_WINDOW_MS
  );

  if (requestTimes.length >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - requestTimes[0])) / 1000));
    throw createHttpError(429, `Слишком много попыток. Повторите через ${retryAfterSeconds} сек.`, {
      retryAfterSeconds
    });
  }

  requestTimes.push(now);
  generationRequestTimes.set(userId, requestTimes);
}

async function checkAuthenticatedGenerationLimit(req) {
  const accessToken = getBearerToken(req);
  const user = await getAuthenticatedUser(accessToken);
  const rows = await supabaseRequest(
    "/rest/v1/rpc/get_generation_access",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({})
    },
    accessToken
  );
  const payload = Array.isArray(rows) ? rows[0] : rows;
  const subscription = payload?.subscription;
  const usage = payload?.usage;
  const status = subscription?.status || "free";
  const generationsUsed = Number(usage?.generations_used || 0);
  const generationLimit = Number(usage?.generation_limit || getGenerationLimit(status));

  if (!subscription?.id || !usage?.id) {
    throw createHttpError(500, "Generation access is not configured correctly");
  }

  if (status === "expired" || generationLimit <= 0) {
    throw createHttpError(403, "Генерация недоступна для текущего тарифа.", {
      status,
      generationsUsed,
      generationLimit
    });
  }

  if (generationsUsed >= generationLimit) {
    throw createHttpError(403, "Лимит генерации исчерпан.", {
      status,
      generationsUsed,
      generationLimit
    });
  }

  return {
    accessToken,
    userId: user.id,
    subscription: {
      id: subscription.id,
      status,
      currentPeriodStart: subscription.current_period_start || null,
      currentPeriodEnd: subscription.current_period_end || null
    },
    usage: {
      id: usage.id,
      generationsUsed,
      generationLimit,
      periodStart: usage.period_start || null,
      periodEnd: usage.period_end || null
    }
  };
}

async function incrementAuthenticatedGenerationUsage(generationAccess) {
  const nextGenerationsUsed = generationAccess.usage.generationsUsed + 1;
  const usageRow = await updateGenerationUsageCount(
    generationAccess.usage.id,
    generationAccess.accessToken,
    nextGenerationsUsed
  );

  return {
    id: usageRow.id,
    generationsUsed: Number(usageRow.generations_used || nextGenerationsUsed),
    generationLimit: Number(usageRow.generation_limit || generationAccess.usage.generationLimit),
    periodStart: usageRow.period_start || generationAccess.usage.periodStart || null,
    periodEnd: usageRow.period_end || generationAccess.usage.periodEnd || null
  };
}

function getStoryRowPayload(story, userId) {
  return {
    user_id: userId,
    title: story.title,
    age_group: story.ageGroup,
    mood: story.mood || "",
    lesson: story.lesson || "",
    visibility: "private"
  };
}

async function insertStoryRow(story, generationAccess) {
  const payload = getStoryRowPayload(story, generationAccess.userId);

  try {
    const rows = await supabaseRequest(
      "/rest/v1/stories?select=*",
      {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload)
      },
      generationAccess.accessToken
    );

    return Array.isArray(rows) ? rows[0] : rows;
  } catch (error) {
    const message = `${error.message || ""} ${JSON.stringify(error.details || {})}`;
    if (!message.includes("visibility")) throw error;

    const { visibility, ...payloadWithoutVisibility } = payload;
    const rows = await supabaseRequest(
      "/rest/v1/stories?select=*",
      {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payloadWithoutVisibility)
      },
      generationAccess.accessToken
    );

    return Array.isArray(rows) ? rows[0] : rows;
  }
}

async function insertPageRows(storyId, story, generationAccess) {
  const pageRows = story.pages.map((page, index) => ({
    story_id: storyId,
    page_number: Number(page.pageNumber || index + 1),
    text: page.text || "",
    scene_tag: page.sceneTag || "forest_day",
    image_url: page.imageUrl || "",
    image_prompt: page.imagePrompt || ""
  }));

  const rows = await supabaseRequest(
    "/rest/v1/story_pages?select=*",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(pageRows)
    },
    generationAccess.accessToken
  );

  return Array.isArray(rows) ? rows : [rows];
}

async function deleteStoryRows(storyId, generationAccess) {
  await supabaseRequest(
    `/rest/v1/story_pages?story_id=eq.${encodeURIComponent(storyId)}`,
    {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    },
    generationAccess.accessToken
  );
  await supabaseRequest(
    `/rest/v1/stories?id=eq.${encodeURIComponent(storyId)}`,
    {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    },
    generationAccess.accessToken
  );
}

function getSavedStoryFromRows(storyRow, pageRows) {
  const sortedPages = [...pageRows].sort((a, b) => Number(a.page_number) - Number(b.page_number));

  return {
    id: storyRow.id,
    title: storyRow.title || "Новая история",
    ageGroup: storyRow.age_group || "5-7",
    mood: storyRow.mood || "",
    lesson: storyRow.lesson || "",
    pages: sortedPages.map((pageRow, index) => ({
      pageNumber: Number(pageRow.page_number || index + 1),
      text: pageRow.text || "",
      sceneTag: pageRow.scene_tag || "forest_day",
      imageUrl: pageRow.image_url || "",
      imagePrompt: pageRow.image_prompt || ""
    })),
    createdAt: storyRow.created_at || "",
    updatedAt: storyRow.updated_at || ""
  };
}

function getStoryPagesRpcPayload(story) {
  return story.pages.map((page, index) => ({
    page_number: Number(page.pageNumber || index + 1),
    text: page.text || "",
    scene_tag: page.sceneTag || "forest_day",
    image_url: page.imageUrl || "",
    image_prompt: page.imagePrompt || ""
  }));
}

function getSavedStoryFromRpcPayload(payload) {
  const story = payload?.story || {};
  const pages = Array.isArray(payload?.pages) ? payload.pages : [];

  return getSavedStoryFromRows(story, pages);
}

function getGenerationUsageFromRpcPayload(payload, generationAccess) {
  const usage = payload?.usage || {};
  const generationsUsed = Number(
    usage.generations_used ?? generationAccess.usage.generationsUsed + 1
  );
  const generationLimit = Number(
    usage.generation_limit ?? generationAccess.usage.generationLimit
  );

  return {
    id: usage.id || generationAccess.usage.id,
    generationsUsed,
    generationLimit,
    periodStart: usage.period_start || generationAccess.usage.periodStart || null,
    periodEnd: usage.period_end || generationAccess.usage.periodEnd || null
  };
}

function canFallbackFromRpcError(error) {
  const source = `${error.message || ""} ${JSON.stringify(error.details || {})}`.toLowerCase();

  return (
    error.statusCode === 404 ||
    source.includes("could not find the function") ||
    source.includes("schema cache")
  );
}

async function saveGeneratedStoryWithUsageRpc(story, generationAccess) {
  const rows = await supabaseRequest(
    "/rest/v1/rpc/create_generated_story_with_usage",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        p_usage_id: generationAccess.usage.id,
        p_title: story.title,
        p_age_group: story.ageGroup,
        p_mood: story.mood || "",
        p_lesson: story.lesson || "",
        p_visibility: "private",
        p_pages: getStoryPagesRpcPayload(story)
      })
    },
    generationAccess.accessToken
  );

  const payload = Array.isArray(rows) ? rows[0] : rows;

  return {
    story: getSavedStoryFromRpcPayload(payload),
    usage: getGenerationUsageFromRpcPayload(payload, generationAccess),
    storageMode: "rpc"
  };
}

async function saveGeneratedStory(story, generationAccess) {
  const storyRow = await insertStoryRow(story, generationAccess);

  try {
    const pageRows = await insertPageRows(storyRow.id, story, generationAccess);
    return getSavedStoryFromRows(storyRow, pageRows);
  } catch (error) {
    try {
      await deleteStoryRows(storyRow.id, generationAccess);
    } catch (cleanupError) {
      logGenerationEvent("story_cleanup_failed", {
        error: getSafeLogError(cleanupError)
      });
    }

    throw error;
  }
}

async function saveGeneratedStoryAndIncrementUsage(story, generationAccess) {
  return saveGeneratedStoryWithUsageRpc(story, generationAccess);
}


function setCorsHeaders(req, res) {
  const allowedOrigin = getAllowedOrigin(req.headers?.origin || "");

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function sendJson(req, res, statusCode, payload) {
  setCorsHeaders(req, res);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function buildGenerationSuccessMeta(generationResult, persistenceResult, subscription) {
  return {
    mode: generationResult.mode,
    aiProvider: generationResult.aiProvider,
    aiFallbackReason: generationResult.aiFallbackReason || null,
    persistenceMode: persistenceResult.storageMode,
    savedToDatabase: true,
    authChecked: true,
    usageLimitChecked: true,
    usageIncremented: true,
    subscription,
    usage: persistenceResult.usage
  };
}

function sendGenerationSuccess(req, res, generationResult, persistenceResult, subscription, durationMs) {
  const story = generationResult.story;
  const meta = buildGenerationSuccessMeta(generationResult, persistenceResult, subscription);

  logGenerationEvent("generation_succeeded", {
    mode: meta.mode,
    aiProvider: meta.aiProvider,
    persistenceMode: meta.persistenceMode,
    pageCount: story.pages.length,
    generationUsage: meta.usage.generationsUsed,
    generationLimit: meta.usage.generationLimit,
    durationMs
  });
  sendJson(req, res, 200, { story: persistenceResult.story, meta });
}

function sendGenerationFailure(req, res, error, durationMs) {
  logGenerationEvent("generation_failed", {
    error: getSafeLogError(error),
    durationMs
  });
  sendJson(req, res, error.statusCode || 500, {
    error: "Generation endpoint failed",
    message: error.message || "Unknown error",
    details: getSafeClientErrorDetails(error)
  });
}

function readStreamBody(req) {
  return new Promise((resolve, reject) => {
    let rawBody = "";

    req.on("data", (chunk) => {
      rawBody += chunk;
      if (rawBody.length > 32 * 1024) {
        reject(new Error("Request body is too large"));
      }
    });

    req.on("end", () => resolve(rawBody));
    req.on("error", reject);
  });
}

async function getRequestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  const rawBody = typeof req.body === "string" ? req.body : await readStreamBody(req);
  if (!rawBody) return {};

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    const parseError = new Error("Request body must be valid JSON");
    parseError.statusCode = 400;
    throw parseError;
  }
}

function cleanText(value, fallback, maxLength) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return (text || fallback).slice(0, maxLength);
}

function getPageCount(value) {
  const pageCount = Number(value || 3);
  if (!Number.isInteger(pageCount)) return 3;
  return Math.min(5, Math.max(1, pageCount));
}

function getAgeGroup(value) {
  return value === "8-10" ? "8-10" : "5-7";
}

function getMood(value) {
  return MOOD_CONFIG[value] ? value : "bedtime";
}

function containsUnsafeContent(value) {
  const source = String(value || "").toLowerCase();
  const blockedWords = [
    "убить",
    "кров",
    "оруж",
    "насили",
    "страшный ужас",
    "adult",
    "blood",
    "weapon",
    "violence"
  ];

  return blockedWords.some((word) => source.includes(word));
}

function assertSafeGeneratedText(value, fieldName) {
  if (containsUnsafeContent(value)) {
    throw createHttpError(502, `Generated story contains unsafe content in ${fieldName}`);
  }
}

function validateGenerationRequest(body) {
  const errors = [];
  const topic = cleanText(body.topic, "маленькое приключение", 80);
  const lesson = cleanText(body.lesson, "доброта становится сильнее, когда ей делятся", 120);
  const ageGroup = getAgeGroup(body.ageGroup);
  const mood = getMood(body.mood);
  const pageCount = getPageCount(body.pageCount);

  if (containsUnsafeContent(`${topic} ${lesson}`)) {
    errors.push("Тема или урок истории не подходят для детской сказки.");
  }

  return {
    errors,
    value: {
      topic,
      lesson,
      ageGroup,
      mood,
      pageCount
    }
  };
}

function capitalize(value) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function getMockPageText({ topic, mood, lesson, pageNumber, pageCount }) {
  const isLastPage = pageNumber === pageCount;
  const moodLabel = MOOD_CONFIG[mood].label;

  if (pageNumber === 1) {
    return `Ежонок и Лисёнок нашли маленькую подсказку про ${topic}. Она лежала тихо-тихо и звала друзей в добрую историю ${moodLabel}.`;
  }

  if (isLastPage) {
    return `Когда путь закончился, Ежонок улыбнулся, а Лисёнок мягко махнул хвостом. Друзья поняли главное: ${lesson}.`;
  }

  if (mood === "bravery") {
    return `На странице ${pageNumber} Ежонку стало немного тревожно, но Лисёнок шёл рядом. Они сделали один маленький смелый шаг, и ${topic} стала понятнее.`;
  }

  if (mood === "friendship") {
    return `На странице ${pageNumber} друзья помогали друг другу: Ежонок замечал детали, а Лисёнок искал дорогу. Так ${topic} становилась теплее.`;
  }

  if (mood === "adventure") {
    return `На странице ${pageNumber} тропинка повернула за травы и камушки. Ежонок задавал вопросы, Лисёнок проверял путь, и ${topic} открывала новый добрый секрет.`;
  }

  return `На странице ${pageNumber} вечер становился мягче. Ежонок слушал тишину, Лисёнок берёг тёплый свет, и ${topic} укладывалась в спокойную сказку.`;
}

function buildMockStory(input) {
  const scenes = MOOD_CONFIG[input.mood].scenes;
  const pages = Array.from({ length: input.pageCount }, (_, index) => {
    const pageNumber = index + 1;
    const sceneTag = scenes[index % scenes.length] || "forest_day";
    const text = getMockPageText({ ...input, pageNumber });

    return {
      pageNumber,
      text,
      sceneTag,
      imagePrompt: buildPageImagePrompt(text, sceneTag)
    };
  });

  return {
    id: `backend-mock-${Date.now()}`,
    title: `Ежонок, Лисёнок и ${capitalize(input.topic)}`,
    ageGroup: input.ageGroup,
    mood: MOOD_CONFIG[input.mood].label,
    lesson: input.lesson,
    pages
  };
}

function buildPageImagePrompt(pageText, sceneTag) {
  const concreteEvent = cleanText(pageText, "", MAX_IMAGE_PROMPT_LENGTH - 52);
  const sceneHint = ALLOWED_SCENE_TAGS.includes(sceneTag) ? ` Сцена: ${sceneTag}.` : "";

  return cleanText(
    `Точный кадр этой страницы: ${concreteEvent}.${sceneHint} Покажи только описанное действие, героев и важные детали.`,
    "",
    MAX_IMAGE_PROMPT_LENGTH
  );
}

function validateGeneratedStory(story) {
  const errors = [];

  if (!story.title || story.title.length > MAX_STORY_TITLE_LENGTH) {
    errors.push("Generated story title is missing or too long.");
  }

  if (!["5-7", "8-10"].includes(story.ageGroup)) {
    errors.push("Generated story ageGroup is invalid.");
  }

  if (!Array.isArray(story.pages) || story.pages.length < 1 || story.pages.length > 5) {
    errors.push("Generated story must contain 1-5 pages.");
  }

  (story.pages || []).forEach((page, index) => {
    if (page.pageNumber !== index + 1) {
      errors.push(`Page ${index + 1} has invalid pageNumber.`);
    }

    if (!page.text || page.text.length > MAX_PAGE_TEXT_LENGTH) {
      errors.push(`Page ${index + 1} text is missing or too long.`);
    }

    if (!ALLOWED_SCENE_TAGS.includes(page.sceneTag)) {
      page.sceneTag = "forest_day";
    }
  });

  return errors;
}

function normalizeGeneratedStory(rawStory, input) {
  if (!rawStory || typeof rawStory !== "object") {
    throw createHttpError(502, "AI response story is missing");
  }

  const title = cleanText(rawStory.title, "", MAX_STORY_TITLE_LENGTH);
  const ageGroup = getAgeGroup(rawStory.ageGroup || input.ageGroup);
  const mood = cleanText(rawStory.mood, MOOD_CONFIG[input.mood].label, 80);
  const lesson = cleanText(rawStory.lesson, input.lesson, MAX_STORY_LESSON_LENGTH);
  const rawPages = Array.isArray(rawStory.pages) ? rawStory.pages : [];

  if (!title) {
    throw createHttpError(502, "AI response title is missing");
  }

  if (rawPages.length < 1 || rawPages.length > 5) {
    throw createHttpError(502, "AI response must contain 1-5 pages");
  }

  assertSafeGeneratedText(`${title} ${mood} ${lesson}`, "story metadata");

  const pages = rawPages.map((rawPage, index) => {
    const pageNumber = index + 1;
    const text = cleanText(rawPage?.text, "", MAX_PAGE_TEXT_LENGTH);
    const sceneTag = ALLOWED_SCENE_TAGS.includes(rawPage?.sceneTag) ? rawPage.sceneTag : "forest_day";
    const imagePrompt = cleanText(
      rawPage?.imagePrompt,
      buildPageImagePrompt(text, sceneTag),
      MAX_IMAGE_PROMPT_LENGTH
    );

    if (!text) {
      throw createHttpError(502, `AI response page ${pageNumber} text is missing`);
    }

    assertSafeGeneratedText(text, `page ${pageNumber}`);

    return {
      pageNumber,
      text,
      sceneTag,
      imagePrompt
    };
  });

  return {
    id: `backend-ai-${Date.now()}`,
    title,
    ageGroup,
    mood,
    lesson,
    pages
  };
}

function isAiGenerationReady() {
  return Boolean(AI_GENERATION_ENABLED && AI_API_BASE_URL && AI_API_KEY && AI_MODEL);
}

function getAiEndpointUrl() {
  return `${AI_API_BASE_URL.replace(/\/$/, "")}/chat/completions`;
}

function getAiSystemPrompt() {
  return [
    "Ты пишешь короткие, спокойные, безопасные детские истории на русском языке.",
    "Главные герои всегда Ежонок и Лисёнок.",
    "Возраст читателей: 5-10 лет.",
    "Тон: добрый, тёплый, без страшных, взрослых, опасных и манипулятивных тем.",
    "Верни только JSON без markdown и без пояснений.",
    "Каждая страница должна быть короткой.",
    "Для каждой страницы обязательно верни imagePrompt на русском языке длиной 80-240 символов.",
    "imagePrompt - это точное визуальное ТЗ только для текста этой страницы: кто в кадре, где находится, что именно происходит и какая деталь важна.",
    "Не пиши общие фразы вроде 'добрая акварельная сцена', не добавляй события или предметы, которых нет в text.",
    `sceneTag выбирай только из списка: ${ALLOWED_SCENE_TAGS.join(", ")}.`
  ].join(" ");
}

function getAiUserPrompt(input) {
  return JSON.stringify({
    task: "generate_child_story",
    outputFormat: {
      title: "Название истории",
      ageGroup: "5-7 или 8-10",
      mood: "настроение на русском",
      lesson: "короткий урок истории",
      pages: [
        {
          pageNumber: 1,
          text: "Текст страницы",
          sceneTag: "forest_day",
          imagePrompt: "Точный кадр этой страницы: герои, место, действие и важная деталь строго из text"
        }
      ]
    },
    constraints: {
      topic: input.topic,
      ageGroup: input.ageGroup,
      mood: MOOD_CONFIG[input.mood].label,
      lesson: input.lesson,
      pageCount: input.pageCount,
      maxPages: 5,
      heroes: ["Ежонок", "Лисёнок"],
      allowedSceneTags: ALLOWED_SCENE_TAGS
    }
  });
}

function extractJsonObject(text) {
  const source = String(text || "").trim();

  if (source.startsWith("{") && source.endsWith("}")) {
    return source;
  }

  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return source.slice(start, end + 1);
  }

  throw createHttpError(502, "AI response did not contain JSON");
}

async function parseAiResponse(response) {
  const rawText = await response.text();
  const data = rawText ? JSON.parse(rawText) : null;

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      response.statusText ||
      "AI provider request failed";
    throw createHttpError(response.status >= 500 ? 502 : 500, message, data);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw createHttpError(502, "AI response content is empty", data);
  }

  try {
    return JSON.parse(extractJsonObject(content));
  } catch (error) {
    if (error.statusCode) throw error;
    throw createHttpError(502, "AI response JSON is invalid", { content });
  }
}

async function generateAiStory(input) {
  if (!isAiGenerationReady()) {
    throw createHttpError(500, "AI generation is not configured");
  }

  const response = await fetch(getAiEndpointUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: getAiSystemPrompt()
        },
        {
          role: "user",
          content: getAiUserPrompt(input)
        }
      ],
      response_format: { type: "json_object" }
    })
  });

  const rawStory = await parseAiResponse(response);
  return normalizeGeneratedStory(rawStory, input);
}

async function generateStoryContent(input) {
  if (!isAiGenerationReady()) {
    return {
      story: buildMockStory(input),
      mode: "mock",
      aiProvider: "disabled"
    };
  }

  try {
    return {
      story: await generateAiStory(input),
      mode: "ai",
      aiProvider: "openai-compatible"
    };
  } catch (error) {
    logGenerationEvent("ai_mock_fallback", {
      error: getSafeLogError(error)
    });
    return {
      story: buildMockStory(input),
      mode: "mock-fallback",
      aiProvider: "openai-compatible",
      aiFallbackReason: error.message || "AI generation failed"
    };
  }
}

async function handler(req, res) {
  const startedAt = Date.now();
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end("");
    return;
  }

  if (req.method !== "POST") {
    sendJson(req, res, 405, {
      error: "Method not allowed",
      message: "Use POST /api/generate-story"
    });
    return;
  }

  try {
    const body = await getRequestBody(req);
    const requestValidation = validateGenerationRequest(body);
    const generationAccess = await checkAuthenticatedGenerationLimit(req);

    if (requestValidation.errors.length) {
      sendJson(req, res, 400, {
        error: "Invalid generation request",
        details: requestValidation.errors
      });
      return;
    }

    enforceGenerationRateLimit(generationAccess.userId);

    const generationResult = await generateStoryContent(requestValidation.value);
    const story = generationResult.story;
    const generatedStoryErrors = validateGeneratedStory(story);

    if (generatedStoryErrors.length) {
      sendJson(req, res, 500, {
        error: "Generated story failed validation",
        details: generatedStoryErrors
      });
      return;
    }

    const persistenceResult = await saveGeneratedStoryAndIncrementUsage(story, generationAccess);

    sendGenerationSuccess(
      req,
      res,
      generationResult,
      persistenceResult,
      generationAccess.subscription,
      Date.now() - startedAt
    );
  } catch (error) {
    sendGenerationFailure(req, res, error, Date.now() - startedAt);
  }
}

module.exports = handler;
