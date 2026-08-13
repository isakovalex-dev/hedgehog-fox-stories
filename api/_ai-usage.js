"use strict";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PUBLIC_ERRORS = {
  authentication_required: { statusCode: 401, publicMessage: "Требуется авторизация." },
  invalid_request: { statusCode: 400, publicMessage: "Некорректный запрос." },
  quota_exhausted: { statusCode: 403, publicMessage: "Лимит генерации исчерпан." },
  entitlement_inactive: { statusCode: 403, publicMessage: "Генерация недоступна для текущего тарифа." },
  job_in_progress: { statusCode: 409, publicMessage: "Генерация уже выполняется." },
  idempotency_replayed: { statusCode: 409, publicMessage: "Этот запрос уже обработан." },
  rate_limited: { statusCode: 429, publicMessage: "Слишком много запросов. Попробуйте позже." },
  provider_unavailable: { statusCode: 502, publicMessage: "Сервис генерации временно недоступен." },
  internal_error: { statusCode: 500, publicMessage: "Внутренняя ошибка сервера." }
};

function createError(code) {
  const error = new Error(code);
  error.code = code;
  error.statusCode = PUBLIC_ERRORS[code]?.statusCode || 500;
  return error;
}

function getSupabaseUrl() {
  const value = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  if (!value) throw createError("internal_error");
  return value;
}

function getAnonKey() {
  const value = String(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!value) throw createError("internal_error");
  return value;
}

function getServiceKey() {
  const value = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!value) {
    const error = createError("internal_error");
    error.code = "server_configuration_error";
    throw error;
  }
  return value;
}

function getBearerToken(req) {
  const authorization = req?.headers?.authorization || req?.headers?.Authorization || "";
  const match = String(authorization).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function readIdempotencyKey(req) {
  const value = String(req.headers?.["x-idempotency-key"] || "").trim();
  if (!UUID_PATTERN.test(value)) {
    const error = new Error("invalid_idempotency_key");
    error.statusCode = 400;
    error.code = "invalid_idempotency_key";
    throw error;
  }
  return value;
}

async function readResponse(response, failureCode) {
  let payload = null;
  try {
    const text = await response.text();
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw createError(failureCode);
  }

  if (!response.ok) {
    const error = createError(response.status === 429 ? "rate_limited" : failureCode);
    const retryAfter = Number(response.headers?.get?.("retry-after"));
    if (Number.isInteger(retryAfter) && retryAfter > 0) error.retryAfterSeconds = retryAfter;
    throw error;
  }

  return payload;
}

async function authenticateRequest(req) {
  const accessToken = getBearerToken(req);
  if (!accessToken) throw createError("authentication_required");

  let response;
  try {
    response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: getAnonKey(),
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });
  } catch {
    throw createError("authentication_required");
  }

  const user = await readResponse(response, "authentication_required");
  if (!UUID_PATTERN.test(String(user?.id || ""))) throw createError("authentication_required");
  return user;
}

async function callServiceRpc(functionName, body) {
  let response;
  try {
    const serviceKey = getServiceKey();
    response = await fetch(`${getSupabaseUrl()}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    if (error?.code === "server_configuration_error") throw error;
    throw createError("internal_error");
  }
  return readResponse(response, "internal_error");
}

function assertUuid(value) {
  if (!UUID_PATTERN.test(String(value || ""))) throw createError("invalid_request");
  return String(value);
}

function assertNullableString(value) {
  if (value !== null && typeof value !== "string") throw createError("invalid_request");
  return value;
}

function assertReservationAllowed(result) {
  if (!result || typeof result !== "object") throw createError("internal_error");
  if (result.allowed === true && String(result.code) === "reserved" && result.reservation?.id) return result;
  if (result.allowed === false && PUBLIC_ERRORS[result.code]) {
    const error = createError(result.code);
    const retryAfterSeconds = Number(result.retry_after_seconds);
    if (result.code === "rate_limited" && Number.isInteger(retryAfterSeconds) && retryAfterSeconds > 0) {
      error.retryAfterSeconds = retryAfterSeconds;
    }
    throw error;
  }
  throw createError("internal_error");
}

async function reserveAiUsage(input) {
  const userId = assertUuid(input?.userId);
  const resourceKind = input?.resourceKind;
  if (resourceKind !== "story" && resourceKind !== "image") throw createError("invalid_request");
  const idempotencyKey = assertUuid(input?.idempotencyKey);
  const result = await callServiceRpc("reserve_ai_usage", {
    p_user_id: userId,
    p_resource_kind: resourceKind,
    p_idempotency_key: idempotencyKey
  });
  return assertReservationAllowed(result);
}

async function completeAiUsage(reservationId) {
  const result = await callServiceRpc("complete_ai_usage", {
    p_reservation_id: assertUuid(reservationId)
  });
  if (!result || typeof result !== "object" || result.completed !== true) {
    throw createError("internal_error");
  }
  return result;
}

async function finalizeImageUsage(input) {
  const result = await callServiceRpc("finalize_image_generation", {
    p_reservation_id: assertUuid(input?.reservationId),
    p_page_id: assertUuid(input?.pageId),
    p_expected_image_url: assertNullableString(input?.expectedImageUrl),
    p_new_image_url: String(input?.newImageUrl)
  });
  if (!result || typeof result !== "object") throw createError("internal_error");
  return result;
}

async function releaseAiUsage(reservationId) {
  return callServiceRpc("release_ai_usage", { p_reservation_id: assertUuid(reservationId) });
}

async function finalizeStoryReservation(input) {
  const result = await callServiceRpc("create_story_from_reservation", {
    p_reservation_id: assertUuid(input?.reservationId),
    p_title: String(input?.title || ""),
    p_age_group: String(input?.ageGroup || ""),
    p_mood: String(input?.mood || ""),
    p_lesson: String(input?.lesson || ""),
    p_visibility: String(input?.visibility || "private"),
    p_pages: Array.isArray(input?.pages) ? input.pages : null
  });
  if (!result || typeof result !== "object" || !result.story || !Array.isArray(result.pages)) {
    throw createError("internal_error");
  }
  return result;
}

async function getCurrentUsage(req) {
  const accessToken = getBearerToken(req);
  await authenticateRequest(req);
  let response;
  try {
    response = await fetch(`${getSupabaseUrl()}/rest/v1/rpc/get_current_usage`, {
      method: "POST",
      headers: {
        apikey: getAnonKey(),
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: "{}"
    });
  } catch {
    throw createError("internal_error");
  }
  return readResponse(response, "internal_error");
}

function toPublicError(error) {
  const code = error?.code === "invalid_idempotency_key"
    ? "invalid_request"
    : Object.prototype.hasOwnProperty.call(PUBLIC_ERRORS, error?.code)
      ? error.code
    : "internal_error";
  const mapped = PUBLIC_ERRORS[code];
  const publicError = {
    statusCode: code === "invalid_request" && error?.statusCode === 413 ? 413 : mapped.statusCode,
    code,
    publicMessage: mapped.publicMessage
  };
  if (code === "rate_limited") {
    publicError.retryAfterSeconds = Number.isInteger(error?.retryAfterSeconds) && error.retryAfterSeconds > 0
      ? error.retryAfterSeconds
      : 1;
  }
  return publicError;
}

module.exports = {
  authenticateRequest,
  readIdempotencyKey,
  reserveAiUsage,
  completeAiUsage,
  finalizeImageUsage,
  releaseAiUsage,
  finalizeStoryReservation,
  getCurrentUsage,
  toPublicError
};
