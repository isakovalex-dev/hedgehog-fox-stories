"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const CHECKOUT_PATH = path.join(PROJECT_ROOT, "api", "create-checkout.js");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
}

function createResponse(statusCode = 200, payload = {}) {
  return {
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    statusText: "mock response",
    async text() {
      return JSON.stringify(payload);
    }
  };
}

function createRequest() {
  return {
    method: "POST",
    headers: { authorization: "Bearer caller-token", origin: "https://ezhik-i-lisenok.ru" },
    body: { plan: "family" }
  };
}

function createResponseRecorder() {
  return {
    headers: {},
    statusCode: 0,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body;
    }
  };
}

function loadCheckoutHandler() {
  delete require.cache[require.resolve(CHECKOUT_PATH)];
  return require(CHECKOUT_PATH);
}

test("subscription display reads only the get_current_usage RPC", () => {
  const source = readProjectFile("js/supabaseService.js");

  assert.match(source, /\/rest\/v1\/rpc\/get_current_usage/);
  assert.doesNotMatch(source, /\/rest\/v1\/subscriptions\?/);
  assert.doesNotMatch(source, /\/rest\/v1\/generation_usage\?/);
});

test("browser generation requests include one UUID idempotency header per request", () => {
  const source = readProjectFile("js/app.js");

  assert.match(source, /function createIdempotencyKey\(\)/);
  assert.match(source, /async function requestBackendStory[\s\S]*?"X-Idempotency-Key": idempotencyKey/);
  assert.match(source, /async function requestStoryIllustration[\s\S]*?"X-Idempotency-Key": idempotencyKey/);
});

test("browser does not make local generation usage an authorization decision", () => {
  const source = readProjectFile("js/app.js");

  assert.doesNotMatch(
    source,
    /if \(!subscriptionService\.canGenerateStory\(\)\)\s*\{\s*showSubscriptionScreen\(\);\s*return;/
  );
});

test("sixth checkout request is denied by the durable rate-limit RPC across handler instances", async () => {
  const testSupabaseUrl = "https://supabase.example.test";
  const testSupabaseAnonKey = "anon-test-key";
  const originalEnvironment = {
    PAYMENTS_ENABLED: process.env.PAYMENTS_ENABLED,
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
    PAYMENT_CHECKOUT_URL: process.env.PAYMENT_CHECKOUT_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY
  };
  const originalFetch = global.fetch;
  let durableRequestCount = 0;

  process.env.PAYMENTS_ENABLED = "true";
  process.env.PAYMENT_PROVIDER = "manual";
  process.env.PAYMENT_CHECKOUT_URL = "https://payments.example.test/checkout";
  process.env.SUPABASE_URL = testSupabaseUrl;
  process.env.SUPABASE_ANON_KEY = testSupabaseAnonKey;
  process.env.SUPABASE_SECRET_KEY = "service-role-test-key";
  global.fetch = async (url, options = {}) => {
    if (url.endsWith("/auth/v1/user")) {
      assert.equal(url, `${testSupabaseUrl}/auth/v1/user`);
      assert.equal(options.headers.apikey, testSupabaseAnonKey);
      return createResponse(200, { id: "11111111-1111-4111-8111-111111111111" });
    }
    if (url.includes("/rest/v1/subscriptions?")) return createResponse(200, []);
    if (url.endsWith("/rest/v1/rpc/enforce_api_rate_limit")) {
      durableRequestCount += 1;
      assert.equal(options.headers.apikey, "service-role-test-key");
      assert.deepEqual(JSON.parse(options.body), {
        p_user_id: "11111111-1111-4111-8111-111111111111",
        p_action: "checkout",
        p_limit: 5
      });
      return createResponse(200, {
        allowed: durableRequestCount <= 5,
        code: durableRequestCount <= 5 ? "allowed" : "rate_limited",
        retry_after_seconds: durableRequestCount <= 5 ? null : 120
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const response = createResponseRecorder();
      await loadCheckoutHandler()(createRequest(), response);
      assert.equal(response.headers.Vary, "Origin");
      assert.match(response.headers["Access-Control-Allow-Headers"], /X-Idempotency-Key/);
      assert.equal(response.statusCode, attempt <= 5 ? 200 : 429);
      if (attempt === 6) {
        assert.deepEqual(JSON.parse(response.body), {
          error: "rate_limited",
          message: "Слишком много запросов. Попробуйте позже."
        });
      }
    }
    assert.equal(durableRequestCount, 6);
  } finally {
    global.fetch = originalFetch;
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    delete require.cache[require.resolve(CHECKOUT_PATH)];
  }
});
