"use strict";

const PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED === "true";
const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || "";
const PAYMENT_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ynidvdesfolavhngubqv.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID || "";
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || "";

const FAMILY_GENERATION_LIMIT = 20;

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function createHttpError(statusCode, message, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

async function parseResponse(response) {
  const rawText = await response.text();
  const data = rawText ? JSON.parse(rawText) : null;

  if (!response.ok) {
    const message =
      data?.description ||
      data?.message ||
      data?.error_description ||
      data?.hint ||
      response.statusText ||
      "Request failed";
    throw createHttpError(response.status, message, data);
  }

  return data;
}

function readStreamBody(req) {
  return new Promise((resolve, reject) => {
    let rawBody = "";

    req.on("data", (chunk) => {
      rawBody += chunk;
      if (rawBody.length > 64 * 1024) {
        reject(createHttpError(413, "Webhook body is too large"));
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
    throw createHttpError(400, "Webhook body must be valid JSON");
  }
}

function verifyWebhook(req) {
  if (!PAYMENTS_ENABLED) {
    throw createHttpError(501, "Payments are disabled");
  }

  if (!PAYMENT_PROVIDER) {
    throw createHttpError(500, "Payment provider is not configured");
  }

  if (!PAYMENT_WEBHOOK_SECRET) {
    throw createHttpError(500, "Payment webhook secret is not configured");
  }

  const receivedSecret =
    req.headers?.["x-payment-webhook-secret"] ||
    req.headers?.["X-Payment-Webhook-Secret"] ||
    "";

  if (receivedSecret !== PAYMENT_WEBHOOK_SECRET) {
    throw createHttpError(401, "Payment webhook signature is invalid");
  }
}

function getYooKassaAuthHeader() {
  if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) {
    throw createHttpError(500, "YooKassa credentials are not configured");
  }

  return `Basic ${Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString("base64")}`;
}

async function getVerifiedYooKassaPayment(paymentId) {
  if (!paymentId) {
    throw createHttpError(400, "YooKassa payment id is missing");
  }

  const response = await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    headers: {
      Authorization: getYooKassaAuthHeader(),
      "Content-Type": "application/json"
    }
  });
  const payment = await parseResponse(response);

  if (payment?.status !== "succeeded" || payment?.paid !== true) {
    throw createHttpError(409, "YooKassa payment is not succeeded", {
      paymentId,
      status: payment?.status || "unknown",
      paid: payment?.paid || false
    });
  }

  return payment;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

async function activateFamilySubscription(payment) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw createHttpError(500, "Supabase service role config is missing");
  }

  const userId = payment?.metadata?.userId || "";
  const plan = payment?.metadata?.plan || "";

  if (!userId) {
    throw createHttpError(400, "Payment metadata userId is missing");
  }

  if (plan !== "family") {
    throw createHttpError(400, "Payment metadata plan is not supported", { plan });
  }

  const now = new Date();
  const subscriptionRow = {
    user_id: userId,
    status: "active",
    provider: "yookassa",
    provider_subscription_id: payment.id,
    generation_limit: FAMILY_GENERATION_LIMIT,
    current_period_start: now.toISOString(),
    current_period_end: addDays(now, 30).toISOString(),
    updated_at: now.toISOString()
  };

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/subscriptions?select=*`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(subscriptionRow)
  });
  const rows = await parseResponse(response);

  return Array.isArray(rows) ? rows[0] : rows;
}

async function handleYooKassaWebhook(payload) {
  const eventType = payload?.event || "";
  const paymentObject = payload?.object || {};

  if (eventType !== "payment.succeeded") {
    return {
      received: true,
      ignored: true,
      meta: {
        provider: "yookassa",
        eventType,
        reason: "Only payment.succeeded activates subscriptions"
      }
    };
  }

  if (paymentObject.status !== "succeeded" || paymentObject.paid !== true) {
    throw createHttpError(409, "Webhook payment object is not succeeded", {
      status: paymentObject.status || "unknown",
      paid: paymentObject.paid || false
    });
  }

  const verifiedPayment = await getVerifiedYooKassaPayment(paymentObject.id);
  const subscription = await activateFamilySubscription(verifiedPayment);

  return {
    received: true,
    subscriptionUpdated: true,
    meta: {
      provider: "yookassa",
      eventType,
      paymentId: verifiedPayment.id,
      paymentStatus: verifiedPayment.status,
      userId: verifiedPayment.metadata?.userId || null,
      plan: verifiedPayment.metadata?.plan || null,
      subscriptionId: subscription?.id || null,
      generationLimit: subscription?.generation_limit || FAMILY_GENERATION_LIMIT
    }
  };
}

async function handleManualWebhook(req, payload) {
  verifyWebhook(req);

  return {
    received: true,
    meta: {
      provider: PAYMENT_PROVIDER,
      eventType: payload?.event || payload?.type || "unknown",
      nextBackendSteps: [
        "map manual provider event to subscription status",
        "update subscriptions row after signature verification"
      ]
    }
  };
}

async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, {
      error: "Method not allowed",
      message: "Use POST /api/payment-webhook"
    });
    return;
  }

  try {
    if (!PAYMENTS_ENABLED) {
      throw createHttpError(501, "Payments are disabled");
    }

    if (!PAYMENT_PROVIDER) {
      throw createHttpError(500, "Payment provider is not configured");
    }

    const payload = await getRequestBody(req);

    if (PAYMENT_PROVIDER === "yookassa") {
      const result = await handleYooKassaWebhook(payload);
      sendJson(res, 200, result);
      return;
    }

    if (PAYMENT_PROVIDER === "manual") {
      const result = await handleManualWebhook(req, payload);
      sendJson(res, 202, result);
      return;
    }

    throw createHttpError(501, `Payment provider is not implemented: ${PAYMENT_PROVIDER}`);
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: "Payment webhook failed",
      message: error.message || "Unknown error",
      details: error.details || null
    });
  }
}

module.exports = handler;
