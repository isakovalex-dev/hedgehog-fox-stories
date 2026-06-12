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
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ynidvdesfolavhngubqv.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || "sb_publishable_nQg--YaINF8OoBd4wceHkA_yo76Z5hy";
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

async function checkAuthenticatedGenerationLimit(req) {
  const accessToken = getBearerToken(req);
  const user = await getAuthenticatedUser(accessToken);
  const subscription = await ensureSubscriptionRow(user.id, accessToken);
  const status = subscription.status || "free";
  const usage = await ensureGenerationUsageRow(user.id, accessToken, status);
  const generationsUsed = Number(usage.generations_used || 0);
  const generationLimit = Number(usage.generation_limit || getGenerationLimit(status));

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
    userId: user.id,
    userEmail: user.email || "",
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

    return {
      pageNumber,
      text: getMockPageText({ ...input, pageNumber }),
      sceneTag,
      imagePrompt: `Нежная акварельная сцена: Ежонок и Лисёнок, ${input.topic}, ${MOOD_CONFIG[input.mood].label}, страница ${pageNumber}`
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

function validateGeneratedStory(story) {
  const errors = [];

  if (!story.title || story.title.length > 120) {
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

    if (!page.text || page.text.length > 700) {
      errors.push(`Page ${index + 1} text is missing or too long.`);
    }

    if (!ALLOWED_SCENE_TAGS.includes(page.sceneTag)) {
      page.sceneTag = "forest_day";
    }
  });

  return errors;
}

async function handler(req, res) {
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

    const story = buildMockStory(requestValidation.value);
    const generatedStoryErrors = validateGeneratedStory(story);

    if (generatedStoryErrors.length) {
      sendJson(req, res, 500, {
        error: "Generated story failed validation",
        details: generatedStoryErrors
      });
      return;
    }

    sendJson(req, res, 200, {
      story,
      meta: {
        mode: "mock",
        aiProvider: "disabled",
        savedToDatabase: false,
        authChecked: true,
        usageLimitChecked: true,
        userId: generationAccess.userId,
        subscription: generationAccess.subscription,
        usage: generationAccess.usage,
        nextBackendSteps: [
          "call OpenAI-compatible API with a server-side key",
          "save stories and story_pages",
          "increment generation_usage after successful save"
        ]
      }
    });
  } catch (error) {
    sendJson(req, res, error.statusCode || 500, {
      error: "Generation endpoint failed",
      message: error.message || "Unknown error",
      details: error.details || null
    });
  }
}

module.exports = handler;
