"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const BUNDLED_STYLE_PROFILE = require("../assets/illustration-style-profile.json");
const {
  authenticateRequest,
  readIdempotencyKey,
  reserveAiUsage,
  completeAiUsage,
  releaseAiUsage,
  toPublicError
} = require("./_ai-usage.js");

const DEFAULT_ORIGIN = "https://ezhik-i-lisenok.ru";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ynidvdesfolavhngubqv.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_nQg--YaINF8OoBd4wceHkA_yo76Z5hy";
const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const IMAGE_GENERATION_ENABLED = process.env.IMAGE_GENERATION_ENABLED === "true";
const OPENAI_IMAGE_API_KEY = process.env.OPENAI_IMAGE_API_KEY || "";
const IMAGE_MODEL = process.env.IMAGE_MODEL || "";
const IMAGE_SIZE = process.env.IMAGE_SIZE || "";
const IMAGE_QUALITY = process.env.IMAGE_QUALITY || "";
const IMAGE_BUCKET = "story-illustrations";
const STORAGE_REFERENCE_PREFIX = "storage://" + IMAGE_BUCKET + "/";
const MAX_STORY_ID_LENGTH = 80;
const MAX_EXPLICIT_REFERENCES = 2;
const MAX_REFERENCE_BYTES = 5 * 1024 * 1024;
const GENERATION_MODES = new Set(["style_only", "with_references", "iteration"]);
const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;
function createHttpError(statusCode, message, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function createInvalidRequestError(message, statusCode = 400) {
  const error = createHttpError(statusCode, message);
  error.code = "invalid_request";
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
        reject(createInvalidRequestError("Illustration request body is too large", 413));
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
    throw createInvalidRequestError("Illustration request body must be valid JSON");
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

function validateStoryId(storyId) {
  const normalized = String(storyId || "").trim();

  if (!/^[a-zA-Z0-9-]{1,80}$/.test(normalized) || normalized.length > MAX_STORY_ID_LENGTH) {
    throw createInvalidRequestError("Story id is invalid");
  }

  return normalized;
}

function cleanPromptText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function buildIllustrationPrompt(story, page, styleProfile, userInstructions, generationMode) {
  const sceneDescription = cleanPromptText(page?.image_prompt, 360);
  const pageText = cleanPromptText(page?.text, 1400);
  const mood = cleanPromptText(story?.mood, 80);
  const additionalInstructions = cleanPromptText(userInstructions, 360);
  const stylePassport = [
    styleProfile.visual_language,
    "Palette: " + styleProfile.color_palette.join(", ") + ".",
    "Lighting: " + styleProfile.lighting,
    "Composition: " + styleProfile.composition,
    "Perspective: " + styleProfile.camera_and_perspective,
    "Shapes and proportions: " + styleProfile.shapes_and_proportions,
    "Materials and textures: " + styleProfile.materials_and_textures,
    "Line and edge style: " + styleProfile.line_and_edge_style,
    "Character rules: " + styleProfile.character_rules,
    "Background rules: " + styleProfile.background_rules,
    "Typography rules: " + styleProfile.typography_rules
  ].join(" ");

  return [
    styleProfile.prompt_template,
    "STYLE PASSPORT (version " + styleProfile.version + "): " + stylePassport,
    "REQUIRED VISUAL RULES: " + styleProfile.required_elements.join("; ") + ".",
    generationMode === "iteration"
      ? "The supplied image is the existing illustration being revised. Preserve only the elements that remain compatible with the exact page event and apply the requested change."
      : "Create a completely new composition for this page. The Russian page text is the source of truth; depict only its concrete action, place, characters and important objects.",
    pageText ? "EXACT PAGE TEXT IN RUSSIAN: " + pageText : "",
    sceneDescription ? "CONCISE VISUAL BRIEF FOR THIS SAME PAGE: " + sceneDescription : "",
    mood ? "Mood: " + mood + "." : "",
    "NEGATIVE CONSTRAINTS: " + styleProfile.negative_prompt,
    additionalInstructions ? "ADDITIONAL REQUEST FOR THIS ONE IMAGE: " + additionalInstructions : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function getMissingImageGenerationConfig() {
  const missing = [];

  if (!IMAGE_GENERATION_ENABLED) missing.push("IMAGE_GENERATION_ENABLED");
  if (!OPENAI_IMAGE_API_KEY) missing.push("OPENAI_IMAGE_API_KEY");
  if (!IMAGE_MODEL) missing.push("IMAGE_MODEL");
  if (!IMAGE_SIZE) missing.push("IMAGE_SIZE");
  if (!IMAGE_QUALITY) missing.push("IMAGE_QUALITY");
  if (!SUPABASE_SECRET_KEY) missing.push("SUPABASE_SECRET_KEY");
  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_ANON_KEY) missing.push("SUPABASE_ANON_KEY");

  return missing;
}

function validatePageNumber(pageNumber) {
  const normalized = Number(pageNumber || 1);

  if (!Number.isInteger(normalized) || normalized < 1 || normalized > 5) {
    throw createInvalidRequestError("Page number must be between 1 and 5");
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

function loadStyleProfile() {
  try {
    const profile = BUNDLED_STYLE_PROFILE;
    const requiredFields = [
      "id",
      "version",
      "prompt_template",
      "visual_language",
      "color_palette",
      "required_elements",
      "negative_prompt",
      "reference_roles",
      "source_hashes"
    ];

    if (requiredFields.some((field) => !profile?.[field])) {
      throw new Error("missing required field");
    }

    return profile;
  } catch (error) {
    throw createHttpError(502, "Illustration style profile is invalid");
  }
}

async function readBundledFile(relativePath, fallbackMessage) {
  const candidates = [
    path.join(process.cwd(), relativePath),
    path.join(__dirname, "..", relativePath)
  ];

  for (const candidatePath of candidates) {
    try {
      return await fs.readFile(candidatePath);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw createHttpError(502, fallbackMessage);
      }
    }
  }

  throw createHttpError(502, fallbackMessage);
}

function getImageContentType(filename) {
  const extension = path.extname(String(filename || "")).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/png";
}

function getGenerationOptions(body, styleProfile) {
  const mode = String(body?.generationMode || "style_only").trim();
  const userInstructions = cleanPromptText(body?.userInstructions, 360);
  const referenceIds = Array.isArray(body?.referenceIds)
    ? [...new Set(body.referenceIds.map((value) => String(value || "").trim()).filter(Boolean))]
    : [];

  if (!GENERATION_MODES.has(mode)) {
    throw createInvalidRequestError("Illustration generation mode is invalid");
  }

  if (referenceIds.length > MAX_EXPLICIT_REFERENCES) {
    throw createInvalidRequestError(`Choose at most ${MAX_EXPLICIT_REFERENCES} illustration references`);
  }

  if (mode === "style_only" && referenceIds.length) {
    throw createInvalidRequestError("style_only generation does not accept image references");
  }

  if (mode === "with_references" && !referenceIds.length) {
    throw createInvalidRequestError("Choose at least one illustration reference");
  }

  if (mode === "iteration" && !userInstructions) {
    throw createInvalidRequestError("Describe the illustration change for iteration mode");
  }

  const referencesById = new Map(
    (Array.isArray(styleProfile.reference_roles) ? styleProfile.reference_roles : []).map((reference) => [reference.id, reference])
  );
  const selectedReferences = referenceIds.map((referenceId) => referencesById.get(referenceId));

  if (selectedReferences.some((reference) => !reference)) {
    throw createInvalidRequestError("An illustration reference is not available");
  }

  return { mode, userInstructions, selectedReferences };
}

async function readExplicitReference(reference) {
  const bytes = await readBundledFile(reference.path, "Could not read the selected illustration reference");

  if (!bytes.byteLength || bytes.byteLength > MAX_REFERENCE_BYTES) {
    throw createHttpError(502, "Selected illustration reference has an invalid size");
  }

  return {
    blob: new Blob([bytes], { type: getImageContentType(reference.path) }),
    filename: path.basename(reference.path),
    id: reference.id,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex")
  };
}

function getOwnedObjectPath(imageReference, userId, storyId) {
  const reference = String(imageReference || "");
  const objectPath = reference.startsWith(STORAGE_REFERENCE_PREFIX)
    ? reference.slice(STORAGE_REFERENCE_PREFIX.length)
    : "";
  const parts = objectPath.split("/");

  if (
    parts.length !== 3 ||
    parts[0] !== userId ||
    parts[1] !== storyId ||
    !/^page-[1-5](?:-\d+)?\.webp$/.test(parts[2] || "")
  ) {
    throw createHttpError(409, "There is no saved illustration available for iteration");
  }

  return objectPath;
}

async function readIterationImage(page, userId, storyId) {
  const objectPath = getOwnedObjectPath(page.image_url, userId, storyId);
  const encodedPath = objectPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const response = await fetch(
    SUPABASE_URL.replace(/\/$/, "") + "/storage/v1/object/authenticated/" + IMAGE_BUCKET + "/" + encodedPath,
    {
      method: "GET",
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: "Bearer " + SUPABASE_SECRET_KEY
      }
    }
  );

  if (!response.ok) {
    throw createHttpError(502, "Could not load the current illustration for iteration");
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > MAX_REFERENCE_BYTES) {
    throw createHttpError(502, "Current illustration has an invalid size");
  }

  return {
    blob: new Blob([bytes], { type: "image/webp" }),
    filename: "current-page.webp",
    id: "current-page",
    sha256: crypto.createHash("sha256").update(bytes).digest("hex")
  };
}

function shouldRetryImageError(error) {
  return error?.statusCode === 429 || error?.statusCode === 502 || error?.name === "TypeError";
}

async function requestImageProvider(url, options, fallbackMessage) {
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, options);
      const payload = await parseJsonResponse(response, fallbackMessage);
      return { payload, requestId: response.headers.get("x-request-id") || null };
    } catch (error) {
      lastError = error;
      if (attempt < 2 && shouldRetryImageError(error)) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      throw error;
    }
  }

  throw lastError || createHttpError(502, fallbackMessage);
}

async function createImage(prompt, generationOptions, page, userId, storyId) {
  let providerResponse;
  let referenceInputs = [];

  if (generationOptions.mode === "style_only") {
    providerResponse = await requestImageProvider(
      "https://api.openai.com/v1/images/generations",
      {
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
      },
      "Image generation request failed"
    );
  } else {
    if (generationOptions.mode === "with_references") {
      referenceInputs = await Promise.all(generationOptions.selectedReferences.map(readExplicitReference));
    } else {
      referenceInputs = [await readIterationImage(page, userId, storyId)];
    }

    const formData = new FormData();
    formData.append("model", IMAGE_MODEL);
    referenceInputs.forEach((reference) => formData.append("image[]", reference.blob, reference.filename));
    formData.append("prompt", prompt);
    formData.append("size", IMAGE_SIZE);
    formData.append("quality", IMAGE_QUALITY);
    formData.append("output_format", "webp");
    formData.append("moderation", "auto");

    providerResponse = await requestImageProvider(
      "https://api.openai.com/v1/images/edits",
      { method: "POST", headers: { Authorization: "Bearer " + OPENAI_IMAGE_API_KEY }, body: formData },
      "Image editing request failed"
    );
  }

  const imageBase64 = providerResponse.payload?.data?.[0]?.b64_json;
  if (!imageBase64) throw createHttpError(502, "Image provider response is missing image data");

  return {
    imageBytes: Buffer.from(imageBase64, "base64"),
    requestId: providerResponse.requestId,
    usage: providerResponse.payload?.usage || null,
    referenceIds: referenceInputs.map((reference) => reference.id),
    referenceHashes: referenceInputs.map((reference) => reference.sha256)
  };
}

function getObjectPath(userId, storyId, pageNumber, force) {
  const versionSuffix = force ? "-" + Date.now() : "";
  return userId + "/" + storyId + "/page-" + pageNumber + versionSuffix + ".webp";
}

function getStorageReference(objectPath) {
  return STORAGE_REFERENCE_PREFIX + objectPath;
}

function hasCurrentPageIllustration(imageUrl, pageNumber) {
  const expectedPathPart = "/page-" + pageNumber;
  const value = String(imageUrl || "");
  return (
    value.startsWith(STORAGE_REFERENCE_PREFIX) &&
    value.includes(expectedPathPart) &&
    value.endsWith(".webp")
  );
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
  let reservationId = null;
  let reservationCompleted = false;
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
    const force = body.force === true;
    const accessToken = getBearerToken(req);
    const user = await authenticateRequest(req);
    const { story, page } = await fetchStoryAndPage(storyId, pageNumber, accessToken);
    const styleProfile = await loadStyleProfile();
    const generationOptions = getGenerationOptions(body, styleProfile);

    if (
      !force &&
      generationOptions.mode !== "iteration" &&
      hasCurrentPageIllustration(page.image_url, pageNumber)
    ) {
      sendJson(req, res, 200, { illustrated: true, alreadyExists: true, pageNumber });
      return;
    }

    const missingConfiguration = getMissingImageGenerationConfig();
    if (missingConfiguration.length) {
      logIllustrationEvent("illustration_not_configured", {
        pageNumber,
        missingConfiguration
      });
      sendJson(req, res, 200, {
        illustrated: false,
        reason: "not_configured",
        missingConfiguration,
        pageNumber
      });
      return;
    }

    const idempotencyKey = readIdempotencyKey(req);
    const reservation = await reserveAiUsage({
      userId: user.id,
      resourceKind: "image",
      idempotencyKey
    });
    reservationId = reservation.reservation.id;

    const prompt = buildIllustrationPrompt(
      story,
      page,
      styleProfile,
      generationOptions.userInstructions,
      generationOptions.mode
    );
    let imageResult;
    try {
      imageResult = await createImage(prompt, generationOptions, page, user.id, story.id);
    } catch (error) {
      if (!error.code && error.statusCode === 502) error.code = "provider_unavailable";
      throw error;
    }
    const objectPath = getObjectPath(
      user.id,
      story.id,
      pageNumber,
      force || generationOptions.mode === "iteration"
    );
    const storageReference = getStorageReference(objectPath);

    await uploadImage(objectPath, imageResult.imageBytes);
    await saveImageReference(page.id, storageReference);
    const completion = await completeAiUsage(reservationId);
    reservationCompleted = true;

    logIllustrationEvent("illustration_succeeded", {
      model: IMAGE_MODEL,
      generationMode: generationOptions.mode,
      styleProfileId: styleProfile.id,
      styleProfileVersion: styleProfile.version,
      styleProfileSourceCount: Object.keys(styleProfile.source_hashes || {}).length,
      referenceCount: imageResult.referenceIds.length,
      referenceIds: imageResult.referenceIds,
      referenceHashes: imageResult.referenceHashes,
      size: IMAGE_SIZE,
      quality: IMAGE_QUALITY,
      pageNumber,
      force,
      objectPath,
      promptSha256: crypto.createHash("sha256").update(prompt).digest("hex"),
      pageTextLength: cleanPromptText(page.text, 1400).length,
      visualBriefLength: cleanPromptText(page.image_prompt, 360).length,
      providerRequestId: imageResult.requestId,
      usage: imageResult.usage,
      estimatedCostUsd: null,
      durationMs: Date.now() - startedAt
    });
    sendJson(req, res, 200, {
      illustrated: true,
      alreadyExists: false,
      regenerated: force,
      pageNumber,
      usage: completion?.usage || null
    });
  } catch (error) {
    if (reservationId && !reservationCompleted) {
      try {
        await releaseAiUsage(reservationId);
      } catch (releaseError) {
        logIllustrationEvent("illustration_reservation_release_failed", {
          error: getSafeLogError(releaseError),
          reservationId
        });
      }
    }
    const publicError = toPublicError(error);
    logIllustrationEvent("illustration_failed", {
      error: { code: publicError.code, statusCode: publicError.statusCode },
      durationMs: Date.now() - startedAt
    });
    const payload = { error: publicError.code, message: publicError.publicMessage };
    if (publicError.retryAfterSeconds) payload.retryAfterSeconds = publicError.retryAfterSeconds;
    sendJson(req, res, publicError.statusCode, payload);
  }
}

module.exports = handler;
