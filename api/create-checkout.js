"use strict";

const { randomUUID } = require("crypto");

const DEFAULT_ORIGIN = "https://ezhik-i-lisenok.ru";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ynidvdesfolavhngubqv.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || "sb_publishable_nQg--YaINF8OoBd4wceHkA_yo76Z5hy";
const PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED === "true";
const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || "";
const PAYMENT_CHECKOUT_URL = process.env.PAYMENT_CHECKOUT_URL || "";
const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID || "";
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || "";
const YOOKASSA_RETURN_URL = process.env.YOOKASSA_RETURN_URL || DEFAULT_ORIGIN;
const YOOKASSA_FAMILY_PRICE_RUB = process.env.YOOKASSA_FAMILY_PRICE_RUB || "";
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

async function parseResponse(response) {
  const rawText = await response.text();
  const data = rawText ? JSON.parse(rawText) : null;

  if (!response.ok) {
    const message =
      data?.msg ||
      data?.message ||
      data?.error_description ||
      data?.hint ||
      response.statusText ||
      "Request failed";
    throw createHttpError(response.status, message, data);
  }

  return data;
}

async function getAuthenticatedUser(accessToken) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw createHttpError(500, "Supabase backend config is missing");
  }

  if (!accessToken) {
    throw createHttpError(401, "Authorization token is required");
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });
  const user = await parseResponse(response);

  if (!user?.id) {
    throw createHttpError(401, "Authorization token is invalid");
  }

  return user;
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

async function createYooKassaPayment(user) {
  const paymentBody = {
    amount: {
      value: getYooKassaFamilyPrice(),
      currency: "RUB"
    },
    capture: true,
    confirmation: {
      type: "redirect",
      return_url: YOOKASSA_RETURN_URL
    },
    description: "Семейный тариф Ежонок и Лисёнок",
    metadata: {
      userId: user.id,
      userEmail: user.email || "",
      plan: "family",
      subscriptionStatus: "active"
    }
  };

  const response = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      Authorization: getYooKassaAuthHeader(),
      "Content-Type": "application/json",
      "Idempotence-Key": randomUUID()
    },
    body: JSON.stringify(paymentBody)
  });
  const payment = await parseResponse(response);
  const checkoutUrl = payment?.confirmation?.confirmation_url || "";

  if (!checkoutUrl) {
    throw createHttpError(502, "YooKassa did not return confirmation URL", payment);
  }

  return {
    checkoutUrl,
    provider: "yookassa",
    plan: "family",
    providerPaymentId: payment.id,
    status: payment.status,
    amount: payment.amount,
    userId: user.id
  };
}

async function getCheckoutPayload(user) {
  if (!PAYMENTS_ENABLED) {
    throw createHttpError(501, "Payments are disabled");
  }

  if (!PAYMENT_PROVIDER) {
    throw createHttpError(500, "Payment provider is not configured");
  }

  if (PAYMENT_PROVIDER === "manual") {
    if (!PAYMENT_CHECKOUT_URL) {
      throw createHttpError(500, "Manual checkout URL is not configured");
    }

    return {
      checkoutUrl: PAYMENT_CHECKOUT_URL,
      provider: "manual",
      plan: "family",
      userId: user.id
    };
  }

  if (PAYMENT_PROVIDER === "yookassa") {
    return createYooKassaPayment(user);
  }

  throw createHttpError(501, `Payment provider is not implemented: ${PAYMENT_PROVIDER}`);
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
      message: "Use POST /api/create-checkout"
    });
    return;
  }

  try {
    const user = await getAuthenticatedUser(getBearerToken(req));
    const checkout = await getCheckoutPayload(user);

    sendJson(req, res, 200, {
      checkout,
      meta: {
        paymentsEnabled: PAYMENTS_ENABLED,
        provider: checkout.provider,
        authChecked: true
      }
    });
  } catch (error) {
    sendJson(req, res, error.statusCode || 500, {
      error: "Checkout creation failed",
      message: error.message || "Unknown error",
      details: error.details || null
    });
  }
}

module.exports = handler;
