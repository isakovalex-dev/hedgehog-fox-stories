"use strict";

const DEFAULT_ORIGIN = "https://ezhik-i-lisenok.ru";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const IMAGE_BUCKET = "story-illustrations";
const STORAGE_REFERENCE_PREFIX = `storage://${IMAGE_BUCKET}/`;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;
const ILLUSTRATION_FILENAME_PATTERN = /^page-[1-5](?:-\d+|-[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89AaBb][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12})?\.webp$/;

function getAllowedOrigin(origin) {
  if (!origin) return DEFAULT_ORIGIN;
  if (origin === DEFAULT_ORIGIN || LOCAL_ORIGIN_PATTERN.test(origin)) return origin;
  return DEFAULT_ORIGIN;
}

function setCorsHeaders(req, res) {
  res.setHeader("Access-Control-Allow-Origin", getAllowedOrigin(req.headers?.origin || ""));
  res.setHeader("Vary", "Origin");
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

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getPublicError(error) {
  if (error?.statusCode === 401) return { statusCode: 401, error: "unauthorized", message: "Требуется авторизация." };
  if (error?.statusCode >= 400 && error?.statusCode < 500) return { statusCode: error.statusCode, error: "invalid_request", message: "Некорректный запрос." };
  return { statusCode: 500, error: "illustration_unavailable", message: "Иллюстрация временно недоступна." };
}

function logSigningEvent(event, details = {}) {
  console.log("[get-story-illustration-url]", JSON.stringify({ event, ...details }));
}

function getBearerToken(req) {
  const authorization = req.headers?.authorization || req.headers?.Authorization || "";
  const match = String(authorization).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

function encodeStoragePath(objectPath) {
  return String(objectPath || "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function parseJsonResponse(response, fallbackMessage) {
  const rawText = await response.text();
  const payload = rawText ? JSON.parse(rawText) : null;

  if (!response.ok) {
    throw createHttpError(
      response.status >= 500 ? 502 : response.status,
      payload?.message || payload?.error_description || response.statusText || fallbackMessage
    );
  }

  return payload;
}

async function getRequestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  const rawBody = await new Promise((resolve, reject) => {
    let result = "";
    req.on("data", (chunk) => {
      result += chunk;
      if (result.length > 4096) reject(createHttpError(413, "Request body is too large"));
    });
    req.on("end", () => resolve(result));
    req.on("error", reject);
  });

  if (!rawBody) return {};

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    throw createHttpError(400, "Request body must be valid JSON");
  }
}

async function getAuthenticatedUser(accessToken) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw createHttpError(500, "Supabase backend config is missing");
  }

  if (!accessToken) throw createHttpError(401, "Authorization token is required");

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`
    }
  });
  const user = await parseJsonResponse(response, "Could not verify account");

  if (!user?.id) throw createHttpError(401, "Authorization token is invalid");
  return user;
}

function getOwnedObjectPath(imageReference, userId, storyId) {
  const reference = String(imageReference || "");
  const normalizedStoryId = String(storyId || "").trim();

  if (!reference.startsWith(STORAGE_REFERENCE_PREFIX)) {
    throw createHttpError(400, "Illustration reference is invalid");
  }

  if (!/^[a-zA-Z0-9-]{1,80}$/.test(normalizedStoryId)) {
    throw createHttpError(400, "Story id is invalid");
  }

  const objectPath = reference.slice(STORAGE_REFERENCE_PREFIX.length);
  const parts = objectPath.split("/");
  const filename = parts[2] || "";

  if (
    parts.length !== 3 ||
    parts[0] !== userId ||
    parts[1] !== normalizedStoryId ||
    !ILLUSTRATION_FILENAME_PATTERN.test(filename)
  ) {
    throw createHttpError(403, "Illustration is not available for this account");
  }

  return objectPath;
}

async function verifyStoryOwnership(storyId, accessToken) {
  const response = await fetch(
    `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/stories?select=id&id=eq.${encodeURIComponent(storyId)}&limit=1`,
    {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`
      }
    }
  );
  const stories = await parseJsonResponse(response, "Could not verify story access");

  if (!Array.isArray(stories) || !stories[0]?.id) {
    throw createHttpError(404, "Story was not found");
  }
}

async function createSignedUrl(objectPath) {
  if (!SUPABASE_SECRET_KEY) {
    throw createHttpError(500, "Supabase secret key config is missing");
  }

  const response = await fetch(
    `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/sign/${IMAGE_BUCKET}/${encodeStoragePath(objectPath)}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS })
    }
  );
  const payload = await parseJsonResponse(response, "Could not sign illustration URL");
  const signedPath = payload?.signedURL || payload?.signedUrl || "";

  if (!signedPath) throw createHttpError(502, "Signed illustration URL is missing");
  if (/^https?:\/\//i.test(signedPath)) return signedPath;

  return `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1${
    signedPath.startsWith("/") ? signedPath : `/${signedPath}`
  }`;
}

async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end("");
    return;
  }

  if (req.method !== "POST") {
    sendJson(req, res, 405, { error: "Method not allowed", message: "Use POST /api/get-story-illustration-url" });
    return;
  }

  try {
    const accessToken = getBearerToken(req);
    const user = await getAuthenticatedUser(accessToken);
    const body = await getRequestBody(req);
    const objectPath = getOwnedObjectPath(body.imageReference, user.id, body.storyId);
    await verifyStoryOwnership(body.storyId, accessToken);
    const signedUrl = await createSignedUrl(objectPath);

    logSigningEvent("signed_url_created", { storyId: body.storyId, objectPath });
    sendJson(req, res, 200, { signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS });
  } catch (error) {
    logSigningEvent("signed_url_failed", {
      statusCode: error.statusCode || 500
    });
    const publicError = getPublicError(error);
    sendJson(req, res, publicError.statusCode, { error: publicError.error, message: publicError.message });
  }
}

module.exports = handler;
