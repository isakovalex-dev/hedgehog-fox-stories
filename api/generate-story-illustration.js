"use strict";

const DEFAULT_ORIGIN = "https://ezhik-i-lisenok.ru";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ynidvdesfolavhngubqv.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_nQg--YaINF8OoBd4wceHkA_yo76Z5hy";
const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const IMAGE_GENERATION_ENABLED = process.env.IMAGE_GENERATION_ENABLED === "true";
const OPENAI_IMAGE_API_KEY = process.env.OPENAI_IMAGE_API_KEY || "";
const IMAGE_MODEL = process.env.IMAGE_MODEL || "gpt-image-1";
const IMAGE_SIZE = process.env.IMAGE_SIZE || "1536x1024";
const IMAGE_QUALITY = process.env.IMAGE_QUALITY || "low";
const IMAGE_BUCKET = "story-illustrations";
const STORAGE_REFERENCE_PREFIX = "storage://" + IMAGE_BUCKET + "/";
const MAX_STORY_ID_LENGTH = 80;
const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;

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

function logIllustrationEvent(event, fields = {}) {
  console.log("[generate-story-illustration]", JSON.stringify({ event, ...fields }));
}

function getAllowedOrigin(origin) {
  if (!origin) return DEFAULT_ORIGIN;
  if (origin === DEFAULT_ORIGIN || LOCAL_ORIGIN_PATTERN.test(origin)) return origin;
  return DEFAULT_ORIGIN;
}

function setCorsHeaders(req, res) {
  res.setHeader("Access-Control-Allow-Origin", getAllowedOrigin(req.headers?.origin || ""));
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

function getBearerToken(req) {
  const authorization = req.headers?.authorization || req.headers?.Authorization || "";
  const match = String(authorization).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

function readStreamBody(req) {
  return new Promise((resolve, reject) => {
    let rawBody = "";

    req.on("data", (chunk) => {
      rawBody += chunk;
      if (rawBody.length > 8 * 1024) {
        reject(createHttpError(413, "Illustration request body is too large"));
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
    throw createHttpError(400, "Illustration request body must be valid JSON");
  }
}

async function parseJsonResponse(response, fallbackMessage) {
  const rawText = await response.text();
  const data = rawText ? JSON.parse(rawText) : null;

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      data?.error_description ||
      data?.hint ||
      response.statusText ||
      fallbackMessage;
    throw createHttpError(response.status >= 500 ? 502 : response.status, message, data);
  }

  return data;
}

async function supabaseRequest(path, options = {}, accessToken) {
  const response = await fetch(SUPABASE_URL.replace(/\/$/, "") + path, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  return parseJsonResponse(response, "Supabase request failed");
}

async function getAuthenticatedUser(req) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    throw createHttpError(401, "Authorization token is required");
  }

  const user = await supabaseRequest("/auth/v1/user", { method: "GET" }, accessToken);
  if (!user?.id) {
    throw createHttpError(401, "Authorization token is invalid");
  }

  return { user, accessToken };
}

function validateStoryId(storyId) {
  const normalized = String(storyId || "").trim();

  if (!/^[a-zA-Z0-9-]{1,80}$/.test(normalized) || normalized.length > MAX_STORY_ID_LENGTH) {
    throw createHttpError(400, "Story id is invalid");
  }

  return normalized;
}

function cleanPromptText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function buildIllustrationPrompt(story, page) {
  const sceneDescription = cleanPromptText(page?.image_prompt, 360);
  const pageText = cleanPromptText(page?.text, 1400);
  const mood = cleanPromptText(story?.mood, 80);
  const lesson = cleanPromptText(story?.lesson, 180);

  return [
    "Original watercolor illustration for a calm Russian children's storybook.",
    "Two recurring heroes: a small brown hedgehog with soft rounded spines and a kind amber fox with a white chest and a fluffy tail.",
    "Gentle hand-painted watercolor and pencil texture on warm cream paper, soft natural light, muted sage green, sky blue and honey colors.",
    "Illustrate only the concrete event of this exact page. Keep the heroes visually consistent across pages.",
    "Composition: landscape book illustration with the two friends clearly visible when the text places them in the scene, safe nature setting, no text, no letters, no logos, no frames.",
    mood ? "Mood: " + mood + "." : "",
    lesson ? "Story lesson: " + lesson + "." : "",
    pageText ? "Page text in Russian: " + pageText + "." : "",
    sceneDescription ? "Art direction for this page: " + sceneDescription + "." : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function isImageGenerationReady() {
  return Boolean(
    IMAGE_GENERATION_ENABLED &&
      OPENAI_IMAGE_API_KEY &&
      SUPABASE_SECRET_KEY &&
      SUPABASE_URL &&
      SUPABASE_ANON_KEY
  );
}

function validatePageNumber(pageNumber) {
  const normalized = Number(pageNumber || 1);

  if (!Number.isInteger(normalized) || normalized < 1 || normalized > 5) {
    throw createHttpError(400, "Page number must be between 1 and 5");
  }

  return normalized;
}

async function fetchStoryAndPage(storyId, pageNumber, accessToken) {
  const storyRows = await supabaseRequest(
    "/rest/v1/stories?select=id,title,mood,lesson&id=eq." + encodeURIComponent(storyId) + "&limit=1",
    { method: "GET" },
    accessToken
  );
  const story = Array.isArray(storyRows) ? storyRows[0] : null;

  if (!story?.id) {
    throw createHttpError(404, "Story was not found");
  }

  const pageRows = await supabaseRequest(
    "/rest/v1/story_pages?select=id,page_number,text,scene_tag,image_url,image_prompt&story_id=eq." +
      encodeURIComponent(storyId) +
      "&page_number=eq." +
      encodeURIComponent(pageNumber) +
      "&limit=1",
    { method: "GET" },
    accessToken
  );
  const page = Array.isArray(pageRows) ? pageRows[0] : null;

  if (!page?.id) {
    throw createHttpError(409, "Story does not have the requested page");
  }

  return { story, page };
}

async function createImage(prompt) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + OPENAI_IMAGE_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      size: IMAGE_SIZE,
      quality: IMAGE_QUALITY,
      output_format: "webp",
      moderation: "auto"
    })
  });
  const payload = await parseJsonResponse(response, "Image generation request failed");
  const imageBase64 = payload?.data?.[0]?.b64_json;

  if (!imageBase64) {
    throw createHttpError(502, "Image provider response is missing image data");
  }

  return Buffer.from(imageBase64, "base64");
}

function getObjectPath(userId, storyId, pageNumber) {
  return userId + "/" + storyId + "/page-" + pageNumber + ".webp";
}

function getStorageReference(objectPath) {
  return STORAGE_REFERENCE_PREFIX + objectPath;
}

function hasCurrentPageIllustration(imageUrl, pageNumber) {
  const expectedSuffix = "/page-" + pageNumber + ".webp";
  return String(imageUrl || "").startsWith(STORAGE_REFERENCE_PREFIX) &&
    String(imageUrl || "").endsWith(expectedSuffix);
}

async function uploadImage(objectPath, imageBytes) {
  const encodedPath = objectPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const response = await fetch(
    SUPABASE_URL.replace(/\/$/, "") + "/storage/v1/object/" + IMAGE_BUCKET + "/" + encodedPath,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: "Bearer " + SUPABASE_SECRET_KEY,
        "Content-Type": "image/webp",
        "x-upsert": "false"
      },
      body: imageBytes
    }
  );

  await parseJsonResponse(response, "Illustration upload failed");
}

async function saveImageReference(pageId, storageReference) {
  const response = await fetch(
    SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/story_pages?id=eq." + encodeURIComponent(pageId),
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: "Bearer " + SUPABASE_SECRET_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ image_url: storageReference })
    }
  );

  await parseJsonResponse(response, "Could not save illustration reference");
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
      message: "Use POST /api/generate-story-illustration"
    });
    return;
  }

  try {
    const body = await getRequestBody(req);
    const storyId = validateStoryId(body.storyId);
    const pageNumber = validatePageNumber(body.pageNumber);
    const { user, accessToken } = await getAuthenticatedUser(req);
    const { story, page } = await fetchStoryAndPage(storyId, pageNumber, accessToken);

    if (hasCurrentPageIllustration(page.image_url, pageNumber)) {
      sendJson(req, res, 200, { illustrated: true, alreadyExists: true, pageNumber });
      return;
    }

    if (!isImageGenerationReady()) {
      sendJson(req, res, 200, { illustrated: false, reason: "not_configured", pageNumber });
      return;
    }

    const prompt = buildIllustrationPrompt(story, page);
    const imageBytes = await createImage(prompt);
    const objectPath = getObjectPath(user.id, story.id, pageNumber);
    const storageReference = getStorageReference(objectPath);

    await uploadImage(objectPath, imageBytes);
    await saveImageReference(page.id, storageReference);

    logIllustrationEvent("illustration_succeeded", {
      model: IMAGE_MODEL,
      size: IMAGE_SIZE,
      quality: IMAGE_QUALITY,
      pageNumber,
      durationMs: Date.now() - startedAt
    });
    sendJson(req, res, 200, { illustrated: true, alreadyExists: false, pageNumber });
  } catch (error) {
    logIllustrationEvent("illustration_failed", {
      error: getSafeLogError(error),
      durationMs: Date.now() - startedAt
    });
    sendJson(req, res, error.statusCode || 500, {
      error: "Illustration endpoint failed",
      message: error.message || "Unknown error"
    });
  }
}

module.exports = handler;
