"use strict";

const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const test = require("node:test");

const root = resolve(__dirname, "..");
const paths = {
  aiUsage: resolve(root, "api/_ai-usage.js"),
  generateStory: resolve(root, "api/generate-story.js"),
  generateIllustration: resolve(root, "api/generate-story-illustration.js"),
  illustrationUrl: resolve(root, "api/get-story-illustration-url.js"),
  checkout: resolve(root, "api/create-checkout.js"),
  webhook: resolve(root, "api/payment-webhook.js"),
  previewGuard: resolve(root, "api/_preview-environment.js")
};
const ENVIRONMENT_NAMES = [
  "VERCEL_ENV",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AI_GENERATION_ENABLED",
  "AI_API_BASE_URL",
  "AI_API_KEY",
  "AI_MODEL",
  "IMAGE_GENERATION_ENABLED",
  "OPENAI_IMAGE_API_KEY",
  "IMAGE_MODEL",
  "IMAGE_SIZE",
  "IMAGE_QUALITY",
  "PAYMENTS_ENABLED",
  "PAYMENT_PROVIDER",
  "PAYMENT_CHECKOUT_URL",
  "PAYMENT_WEBHOOK_SECRET",
  "YOOKASSA_SHOP_ID",
  "YOOKASSA_SECRET_KEY"
];

function resetModules() {
  for (const modulePath of Object.values(paths)) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch (error) {
      if (error.code !== "MODULE_NOT_FOUND") throw error;
    }
  }
}

async function withEnvironment(values, callback) {
  const original = Object.fromEntries(ENVIRONMENT_NAMES.map((name) => [name, process.env[name]]));
  const originalFetch = global.fetch;

  try {
    for (const name of ENVIRONMENT_NAMES) delete process.env[name];
    Object.assign(process.env, values);
    resetModules();
    return await callback(() => { global.fetch = originalFetch; });
  } finally {
    global.fetch = originalFetch;
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    resetModules();
  }
}

function createResponseRecorder() {
  return {
    headers: {},
    statusCode: 0,
    setHeader(name, value) { this.headers[name] = value; },
    end(body) { this.body = body; }
  };
}

async function invoke(handlerPath, request) {
  const response = createResponseRecorder();
  await require(handlerPath)(request, response);
  return { statusCode: response.statusCode, body: JSON.parse(response.body) };
}

const previewStagingWithDriftedFlags = {
  VERCEL_ENV: "preview",
  SUPABASE_URL: "https://opcnhhujyckmccvvpihc.supabase.co",
  SUPABASE_ANON_KEY: "fake-preview-anon-key",
  SUPABASE_SECRET_KEY: "fake-preview-service-key",
  AI_GENERATION_ENABLED: "true",
  AI_API_BASE_URL: "https://ai.example.test/v1",
  AI_API_KEY: "fake-ai-key",
  AI_MODEL: "fake-ai-model",
  IMAGE_GENERATION_ENABLED: "true",
  OPENAI_IMAGE_API_KEY: "fake-image-key",
  IMAGE_MODEL: "fake-image-model",
  IMAGE_SIZE: "1024x1024",
  IMAGE_QUALITY: "medium",
  PAYMENTS_ENABLED: "true",
  PAYMENT_PROVIDER: "yookassa",
  PAYMENT_WEBHOOK_SECRET: "fake-webhook-secret",
  YOOKASSA_SHOP_ID: "fake-shop-id",
  YOOKASSA_SECRET_KEY: "fake-yookassa-key"
};

test("Preview rejects the production Supabase URL before AI authentication fetches", async () => {
  await withEnvironment({
    ...previewStagingWithDriftedFlags,
    SUPABASE_URL: "https://ynidvdesfolavhngubqv.supabase.co"
  }, async () => {
    let fetchCalls = 0;
    global.fetch = async () => {
      fetchCalls += 1;
      throw new Error("Preview must not contact Supabase");
    };

    const { authenticateRequest } = require(paths.aiUsage);
    await assert.rejects(
      () => authenticateRequest({ headers: { authorization: "Bearer caller-token" } }),
      (error) => error?.code === "preview_supabase_url_invalid"
    );
    assert.equal(fetchCalls, 0);
  });
});

test("Preview paid handlers short-circuit drifted true flags before downstream fetches", async () => {
  await withEnvironment(previewStagingWithDriftedFlags, async () => {
    let fetchCalls = 0;
    global.fetch = async () => {
      fetchCalls += 1;
      throw new Error("Preview paid routes must not fetch");
    };

    const story = await invoke(paths.generateStory, {
      method: "POST",
      headers: { authorization: "Bearer caller-token", "x-idempotency-key": "c0c1c2c3-c4c5-4c6c-8c8c-c9cacbcccdce" },
      body: { topic: "лес", lesson: "дружба", ageGroup: "5-6", mood: "bedtime", pageCount: 1 }
    });
    const illustration = await invoke(paths.generateIllustration, {
      method: "POST",
      headers: { authorization: "Bearer caller-token", "x-idempotency-key": "c0c1c2c3-c4c5-4c6c-8c8c-c9cacbcccdce" },
      body: { storyId: "story-1", pageNumber: 1 }
    });
    const checkout = await invoke(paths.checkout, {
      method: "POST",
      headers: { authorization: "Bearer caller-token" },
      body: { plan: "family" }
    });
    const webhook = await invoke(paths.webhook, {
      method: "POST",
      headers: { "x-payment-webhook-secret": "fake-webhook-secret" },
      body: { event: "payment.succeeded", object: { id: "fake-payment-id", status: "succeeded", paid: true } }
    });

    assert.equal(story.statusCode, 501);
    assert.equal(illustration.statusCode, 501);
    assert.equal(checkout.statusCode, 501);
    assert.equal(webhook.statusCode, 501);
    assert.equal(fetchCalls, 0);
  });
});

test("Preview server handlers reject the production Supabase URL before any downstream fetch", async () => {
  await withEnvironment({
    ...previewStagingWithDriftedFlags,
    SUPABASE_URL: "https://ynidvdesfolavhngubqv.supabase.co"
  }, async () => {
    let fetchCalls = 0;
    global.fetch = async () => {
      fetchCalls += 1;
      throw new Error("Preview must not contact Supabase or a provider");
    };

    const requests = [
      [paths.generateStory, {
        method: "POST",
        headers: { authorization: "Bearer caller-token", "x-idempotency-key": "c0c1c2c3-c4c5-4c6c-8c8c-c9cacbcccdce" },
        body: { topic: "лес", lesson: "дружба", ageGroup: "5-6", mood: "bedtime", pageCount: 1 }
      }],
      [paths.generateIllustration, {
        method: "POST",
        headers: { authorization: "Bearer caller-token", "x-idempotency-key": "c0c1c2c3-c4c5-4c6c-8c8c-c9cacbcccdce" },
        body: { storyId: "story-1", pageNumber: 1 }
      }],
      [paths.checkout, {
        method: "POST",
        headers: { authorization: "Bearer caller-token" },
        body: { plan: "family" }
      }],
      [paths.webhook, {
        method: "POST",
        headers: { "x-payment-webhook-secret": "fake-webhook-secret" },
        body: { event: "payment.succeeded", object: { id: "fake-payment-id", status: "succeeded", paid: true } }
      }]
    ];

    for (const [handlerPath, request] of requests) {
      const result = await invoke(handlerPath, request);
      assert.equal(result.statusCode, 500);
    }
    assert.equal(fetchCalls, 0);
  });
});

test("Preview illustration signing rejects the production Supabase URL before Auth or Storage fetches", async () => {
  await withEnvironment({
    ...previewStagingWithDriftedFlags,
    SUPABASE_URL: "https://ynidvdesfolavhngubqv.supabase.co"
  }, async () => {
    let fetchCalls = 0;
    global.fetch = async () => {
      fetchCalls += 1;
      throw new Error("Preview must not contact Supabase");
    };

    const result = await invoke(paths.illustrationUrl, {
      method: "POST",
      headers: { authorization: "Bearer caller-token" },
      body: {
        imageReference: "storage://story-illustrations/user/story-1/page-1.webp",
        storyId: "story-1"
      }
    });

    assert.equal(result.statusCode, 500);
    assert.equal(fetchCalls, 0);
  });
});
