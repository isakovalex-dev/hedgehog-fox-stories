"use strict";

const {
  authenticateRequest,
  readIdempotencyKey,
  reserveAiUsage,
  releaseAiUsage,
  finalizeStoryReservation,
  toPublicError
} = require("./_ai-usage.js");

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
const AI_GENERATION_ENABLED = process.env.AI_GENERATION_ENABLED === "true";
const AI_API_BASE_URL = process.env.AI_API_BASE_URL || "";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "";
const LOCAL_ORIGINS = new Set([
  "http://localhost:8000",
  "http://localhost:8001",
  "http://localhost:8002",
  "http://localhost:8003",
  "http://localhost:8004",
  "http://127.0.0.1:8000"
]);

function getAllowedOrigin(origin) {
  if (!origin) return DEFAULT_ORIGIN;
  if (origin === DEFAULT_ORIGIN || LOCAL_ORIGINS.has(origin)) return origin;
  return DEFAULT_ORIGIN;
}

function createHttpError(statusCode, message, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
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

function getSavedStoryFromRpcPayload(payload) {
  const story = payload?.story || {};
  const pages = Array.isArray(payload?.pages) ? payload.pages : [];

  return getSavedStoryFromRows(story, pages);
}

function setCorsHeaders(req, res) {
  const allowedOrigin = getAllowedOrigin(req.headers?.origin || "");

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function sendJson(req, res, statusCode, payload) {
  setCorsHeaders(req, res);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function buildGenerationSuccessMeta(generationResult, persistenceResult) {
  return {
    mode: generationResult.mode,
    aiProvider: generationResult.aiProvider,
    persistenceMode: "reservation-finalizer",
    savedToDatabase: true,
    authChecked: true,
    usageReserved: true,
    usageIncremented: true,
    subscription: persistenceResult.subscription || null,
    usage: persistenceResult.usage
  };
}

function sendGenerationSuccess(req, res, generationResult, persistenceResult, durationMs) {
  const story = generationResult.story;
  const meta = buildGenerationSuccessMeta(generationResult, persistenceResult);

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
  const publicError = toPublicError(error);
  logGenerationEvent("generation_failed", {
    error: { code: publicError.code, statusCode: publicError.statusCode },
    durationMs
  });
  const payload = { error: publicError.code, message: publicError.publicMessage };
  if (publicError.retryAfterSeconds) payload.retryAfterSeconds = publicError.retryAfterSeconds;
  sendJson(req, res, publicError.statusCode, payload);
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

const SUPPORTED_AGE_GROUPS = new Set(["5-6", "7-8", "9-10", "5-7", "8-10"]);

function normalizePageCount(value) {
  const pageCount = Number(value || 5);
  if (!Number.isInteger(pageCount)) return 5;
  return Math.min(7, Math.max(1, pageCount));
}

function normalizeAgeGroup(value) {
  return SUPPORTED_AGE_GROUPS.has(value) ? value : "5-6";
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
  const ageGroup = normalizeAgeGroup(body.ageGroup);
  const mood = getMood(body.mood);
  const pageCount = normalizePageCount(body.pageCount);

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
  const ageGroup = normalizeAgeGroup(input.ageGroup);
  const pageCount = normalizePageCount(input.pageCount);
  const scenes = MOOD_CONFIG[input.mood].scenes;
  const pages = Array.from({ length: pageCount }, (_, index) => {
    const pageNumber = index + 1;
    const sceneTag = scenes[index % scenes.length] || "forest_day";
    const text = getMockPageText({ ...input, pageNumber, pageCount });

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
    ageGroup,
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

  if (normalizeAgeGroup(story.ageGroup) !== story.ageGroup) {
    errors.push("Generated story ageGroup is invalid.");
  }

  if (!Array.isArray(story.pages) || story.pages.length < 1 || story.pages.length > 7) {
    errors.push("Generated story must contain 1-7 pages.");
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
  const ageGroup = normalizeAgeGroup(rawStory.ageGroup || input.ageGroup);
  const mood = cleanText(rawStory.mood, MOOD_CONFIG[input.mood].label, 80);
  const lesson = cleanText(rawStory.lesson, input.lesson, MAX_STORY_LESSON_LENGTH);
  const rawPages = Array.isArray(rawStory.pages) ? rawStory.pages : [];

  if (!title) {
    throw createHttpError(502, "AI response title is missing");
  }

  if (rawPages.length < 1 || rawPages.length > 7) {
    throw createHttpError(502, "AI response must contain 1-7 pages");
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
      ageGroup: "5-6, 7-8, 9-10, 5-7 или 8-10",
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
      ageGroup: normalizeAgeGroup(input.ageGroup),
      mood: MOOD_CONFIG[input.mood].label,
      lesson: input.lesson,
      pageCount: normalizePageCount(input.pageCount),
      maxPages: 7,
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
    const providerError = new Error("provider_unavailable");
    providerError.code = "provider_unavailable";
    providerError.statusCode = 502;
    throw providerError;
  }
}

async function handler(req, res) {
  const startedAt = Date.now();
  let reservationId = null;
  let storyFinalized = false;
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

    if (requestValidation.errors.length) {
      const error = new Error("invalid_request");
      error.code = "invalid_request";
      throw error;
    }

    const user = await authenticateRequest(req);
    const idempotencyKey = readIdempotencyKey(req);
    const reservation = await reserveAiUsage({
      userId: user.id,
      resourceKind: "story",
      idempotencyKey
    });
    if (!reservation.allowed) {
      const error = new Error("internal_error");
      error.code = "internal_error";
      throw error;
    }
    reservationId = reservation.reservation.id;

    const generationResult = await generateStoryContent(requestValidation.value);
    const story = generationResult.story;
    const generatedStoryErrors = validateGeneratedStory(story);

    if (generatedStoryErrors.length) {
      const error = new Error("internal_error");
      error.code = "internal_error";
      throw error;
    }

    const finalized = await finalizeStoryReservation({ reservationId, story });
    storyFinalized = true;
    const persistenceResult = {
      story: getSavedStoryFromRpcPayload(finalized),
      subscription: finalized.subscription,
      usage: finalized.usage
    };

    sendGenerationSuccess(
      req,
      res,
      generationResult,
      persistenceResult,
      Date.now() - startedAt
    );
  } catch (error) {
    if (reservationId && !storyFinalized) {
      try {
        await releaseAiUsage(reservationId);
      } catch (releaseError) {
        const publicReleaseError = toPublicError(releaseError);
        logGenerationEvent("story_reservation_release_failed", {
          code: publicReleaseError.code,
          statusCode: publicReleaseError.statusCode
        });
      }
    }
    sendGenerationFailure(req, res, error, Date.now() - startedAt);
  }
}

handler.__testables = { normalizeAgeGroup, normalizePageCount };

module.exports = handler;
