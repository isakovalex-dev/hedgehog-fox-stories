"use strict";

const PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED === "true";
const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || "";
const PAYMENT_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ynidvdesfolavhngubqv.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID || "";
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || "";
const YOOKASSA_FAMILY_PRICE_RUB = process.env.YOOKASSA_FAMILY_PRICE_RUB || "";

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

function getSafeLogError(error) {
  return {
    statusCode: Number(error?.statusCode) || 500,
    name: String(error?.name || "Error").slice(0, 80),
    message: String(error?.message || "Unknown error").slice(0, 180)
  };
}

function logPaymentEvent(event, fields = {}) {
  console.log(
    "[payment-webhook]",
    JSON.stringify({
      event,
      ...fields
    })
  );
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

function getYooKassaFamilyPrice() {
  const normalizedPrice = String(YOOKASSA_FAMILY_PRICE_RUB).trim().replace(",", ".");

  if (!/^\d+(\.\d{2})$/.test(normalizedPrice)) {
    throw createHttpError(500, "YOOKASSA_FAMILY_PRICE_RUB must use format 299.00");
  }

  return normalizedPrice;
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

  if (String(payment?.recipient?.account_id || "") !== String(YOOKASSA_SHOP_ID)) {
    throw createHttpError(400, "YooKassa payment belongs to another shop");
  }

  if (payment?.metadata?.plan !== "family" || !payment?.metadata?.userId) {
    throw createHttpError(400, "YooKassa payment metadata is invalid");
  }

  if (
    String(payment?.amount?.currency || "") !== "RUB" ||
    String(payment?.amount?.value || "") !== getYooKassaFamilyPrice()
  ) {
    throw createHttpError(400, "YooKassa payment amount is invalid");
  }

  return payment;
}

async function applyVerifiedYooKassaPayment(payment) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw createHttpError(500, "Supabase service role config is missing");
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/apply_yookassa_payment`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      p_provider_payment_id: payment.id,
      p_user_id: payment.metadata.userId,
      p_plan: payment.metadata.plan,
      p_amount: payment.amount.value,
      p_currency: payment.amount.currency,
      p_paid_at: payment.captured_at || new Date().toISOString()
    })
  });
  const payload = await parseResponse(response);

  return Array.isArray(payload) ? payload[0] : payload;
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
  const result = await applyVerifiedYooKassaPayment(verifiedPayment);

  return {
    received: true,
    subscriptionUpdated: result?.subscription_updated === true,
    alreadyProcessed: result?.already_processed === true,
    meta: {
      provider: "yookassa",
      eventType
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
  const startedAt = Date.now();

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
      logPaymentEvent("webhook_processed", {
        provider: "yookassa",
        eventType: payload?.event || "unknown",
        subscriptionUpdated: result.subscriptionUpdated === true,
        alreadyProcessed: result.alreadyProcessed === true,
        durationMs: Date.now() - startedAt
      });
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
    logPaymentEvent("webhook_failed", {
      provider: PAYMENT_PROVIDER || "unknown",
      error: getSafeLogError(error),
      durationMs: Date.now() - startedAt
    });
    sendJson(res, error.statusCode || 500, {
      error: "Payment webhook failed",
      message: error.message || "Unknown error",
      details: null
    });
  }
}

module.exports = handler;
