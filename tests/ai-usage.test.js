const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const MODULE_PATH = path.join(__dirname, "..", "api", "_ai-usage.js");
const SERVICE_KEY = "test-service-role-key";
const ANON_KEY = "test-publishable-key";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const IDEMPOTENCY_KEY = "22222222-2222-4222-8222-222222222222";

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    text: async () => JSON.stringify(payload)
  };
}

function loadAiUsage() {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = ANON_KEY;
  process.env.SUPABASE_SECRET_KEY = SERVICE_KEY;
  delete require.cache[require.resolve(MODULE_PATH)];
  return require(MODULE_PATH);
}

test.afterEach(() => {
  delete global.fetch;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete require.cache[require.resolve(MODULE_PATH)];
});

test("reserve uses the server-only key and does not call a provider", async () => {
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith("/auth/v1/user")) return jsonResponse({ id: USER_ID });
    if (url.endsWith("/rest/v1/rpc/reserve_ai_usage")) {
      return jsonResponse({ allowed: true, code: "reserved", reservation: { id: "reservation-1" } });
    }
    throw new Error(`unexpected network request: ${url}`);
  };
  const aiUsage = loadAiUsage();
  const user = await aiUsage.authenticateRequest({ headers: { authorization: "Bearer caller-jwt" } });
  const reservation = await aiUsage.reserveAiUsage({
    userId: user.id,
    resourceKind: "story",
    idempotencyKey: IDEMPOTENCY_KEY
  });

  assert.equal(reservation.reservation.id, "reservation-1");
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.headers.apikey, ANON_KEY);
  assert.equal(requests[0].options.headers.Authorization, "Bearer caller-jwt");
  assert.equal(requests[1].options.headers.apikey, SERVICE_KEY);
  assert.equal(requests[1].options.headers.Authorization, `Bearer ${SERVICE_KEY}`);
  assert.equal(requests.some((request) => !request.url.includes("example.supabase.co")), false);
});

test("image finalization calls the atomic service RPC with its complete contract", async () => {
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return jsonResponse({ completed: true, usage: { resource_kind: "image", used_count: 1 } });
  };
  const aiUsage = loadAiUsage();
  const result = await aiUsage.finalizeImageUsage({
    reservationId: IDEMPOTENCY_KEY,
    pageId: USER_ID,
    expectedImageUrl: null,
    newImageUrl: "storage://story-illustrations/test.webp"
  });

  assert.deepEqual(result, { completed: true, usage: { resource_kind: "image", used_count: 1 } });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://example.supabase.co/rest/v1/rpc/finalize_image_generation");
  assert.equal(requests[0].options.headers.apikey, SERVICE_KEY);
  assert.equal(requests[0].options.headers.Authorization, `Bearer ${SERVICE_KEY}`);
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    p_reservation_id: IDEMPOTENCY_KEY,
    p_page_id: USER_ID,
    p_expected_image_url: "null",
    p_new_image_url: "storage://story-illustrations/test.webp"
  });
});

test("a quota result becomes a static 403 public error", async () => {
  global.fetch = async (url) => {
    if (url.endsWith("/rest/v1/rpc/reserve_ai_usage")) {
      return jsonResponse({ allowed: false, code: "quota_exhausted" });
    }
    throw new Error(`unexpected network request: ${url}`);
  };
  const aiUsage = loadAiUsage();

  await assert.rejects(
    aiUsage.reserveAiUsage({
      userId: USER_ID,
      resourceKind: "story",
      idempotencyKey: IDEMPOTENCY_KEY
    }),
    (error) => {
      const publicError = aiUsage.toPublicError(error);
      assert.equal(publicError.statusCode, 403);
      assert.equal(publicError.publicMessage, "Лимит генерации исчерпан.");
      return true;
    }
  );
});

test("an upstream body is never copied into the public error", () => {
  const aiUsage = loadAiUsage();
  const providerToken = "sk-provider-secret-token";
  const error = new Error(`provider rejected token ${providerToken}`);
  error.code = "provider_unavailable";
  error.details = { token: providerToken };

  const publicError = aiUsage.toPublicError(error);
  assert.equal(publicError.statusCode, 502);
  assert.equal(publicError.publicMessage.includes(providerToken), false);
  assert.equal(JSON.stringify(publicError).includes(providerToken), false);
});

test("service RPCs fail closed without a service key and do not fetch", async () => {
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    throw new Error("fetch must not be called");
  };
  const aiUsage = loadAiUsage();
  delete process.env.SUPABASE_SECRET_KEY;

  const calls = [
    () => aiUsage.reserveAiUsage({ userId: USER_ID, resourceKind: "story", idempotencyKey: IDEMPOTENCY_KEY }),
    () => aiUsage.completeAiUsage(IDEMPOTENCY_KEY),
    () => aiUsage.releaseAiUsage(IDEMPOTENCY_KEY),
    () => aiUsage.finalizeImageUsage({ reservationId: IDEMPOTENCY_KEY, pageId: USER_ID, expectedImageUrl: "", newImageUrl: "" }),
    () => aiUsage.finalizeStoryReservation({ reservationId: IDEMPOTENCY_KEY })
  ];

  for (const call of calls) {
    await assert.rejects(call(), (error) => {
      assert.equal(error.code, "server_configuration_error");
      assert.equal(error.statusCode, 500);
      return true;
    });
  }
  assert.equal(fetchCalled, false);
});

test("readIdempotencyKey accepts UUID v1-v5 and rejects missing or malformed keys", () => {
  const aiUsage = loadAiUsage();
  const validKeys = [
    "11111111-1111-1111-8111-111111111111",
    "22222222-2222-2111-8111-111111111111",
    "33333333-3333-3111-8111-111111111111",
    "44444444-4444-4111-8111-111111111111",
    "55555555-5555-5111-8111-111111111111"
  ];

  for (const key of validKeys) {
    assert.equal(aiUsage.readIdempotencyKey({ headers: { "x-idempotency-key": key } }), key);
  }
  for (const key of [undefined, "not-a-uuid", "11111111-1111-6111-8111-111111111111"]) {
    assert.throws(
      () => aiUsage.readIdempotencyKey({ headers: { "x-idempotency-key": key } }),
      { code: "invalid_idempotency_key", statusCode: 400 }
    );
  }
});

test("rate-limited reservations preserve the RPC retry time in the public error", async () => {
  global.fetch = async (url) => {
    if (url.endsWith("/rest/v1/rpc/reserve_ai_usage")) {
      return jsonResponse({ allowed: false, code: "rate_limited", retry_after_seconds: 73 });
    }
    throw new Error(`unexpected network request: ${url}`);
  };
  const aiUsage = loadAiUsage();

  await assert.rejects(
    aiUsage.reserveAiUsage({ userId: USER_ID, resourceKind: "image", idempotencyKey: IDEMPOTENCY_KEY }),
    (error) => {
      const publicError = aiUsage.toPublicError(error);
      assert.equal(publicError.code, "rate_limited");
      assert.equal(publicError.retryAfterSeconds, 73);
      return true;
    }
  );
});

test("invalid idempotency helper errors are exposed as stable invalid_request errors", () => {
  const aiUsage = loadAiUsage();
  assert.deepEqual(aiUsage.toPublicError({ code: "invalid_idempotency_key" }), {
    statusCode: 400,
    code: "invalid_request",
    publicMessage: "Некорректный запрос."
  });
});

test("getCurrentUsage uses only caller JWT and anon credentials", async () => {
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith("/auth/v1/user")) return jsonResponse({ id: USER_ID });
    if (url.endsWith("/rest/v1/rpc/get_current_usage")) return jsonResponse({ used: 1, limit: 3 });
    throw new Error(`unexpected network request: ${url}`);
  };
  const aiUsage = loadAiUsage();

  const usage = await aiUsage.getCurrentUsage({ headers: { authorization: "Bearer caller-jwt" } });
  assert.deepEqual(usage, { used: 1, limit: 3 });
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.options.headers.apikey, ANON_KEY);
    assert.equal(request.options.headers.Authorization, "Bearer caller-jwt");
    assert.equal(JSON.stringify(request.options.headers).includes(SERVICE_KEY), false);
  }
});

test("non-2xx auth and RPC bodies are redacted from public errors", async () => {
  const secret = "sql-detail-provider-token";
  global.fetch = async () => jsonResponse({ message: secret, details: secret }, 500);
  const aiUsage = loadAiUsage();

  for (const operation of [
    () => aiUsage.authenticateRequest({ headers: { authorization: "Bearer caller-jwt" } }),
    () => aiUsage.reserveAiUsage({ userId: USER_ID, resourceKind: "story", idempotencyKey: IDEMPOTENCY_KEY })
  ]) {
    await assert.rejects(operation(), (error) => {
      assert.equal(JSON.stringify(aiUsage.toPublicError(error)).includes(secret), false);
      return true;
    });
  }
});

test("expired finalization is never returned as a created story", async () => {
  global.fetch = async (url) => {
    if (url.endsWith("/rest/v1/rpc/create_story_from_reservation")) {
      return jsonResponse({ created: false, code: "reservation_expired" });
    }
    throw new Error(`unexpected network request: ${url}`);
  };
  const aiUsage = loadAiUsage();

  await assert.rejects(
    aiUsage.finalizeStoryReservation({ reservationId: IDEMPOTENCY_KEY }),
    (error) => {
      assert.deepEqual(aiUsage.toPublicError(error), {
        statusCode: 500,
        code: "internal_error",
        publicMessage: "Внутренняя ошибка сервера."
      });
      return true;
    }
  );
});

test("an HTTP-successful image completion must explicitly report completed true", async () => {
  global.fetch = async (url) => {
    if (url.endsWith("/rest/v1/rpc/complete_ai_usage")) {
      return jsonResponse({ completed: false, code: "reservation_expired" });
    }
    throw new Error(`unexpected network request: ${url}`);
  };
  const aiUsage = loadAiUsage();

  await assert.rejects(
    aiUsage.completeAiUsage(IDEMPOTENCY_KEY),
    (error) => {
      assert.deepEqual(aiUsage.toPublicError(error), {
        statusCode: 500,
        code: "internal_error",
        publicMessage: "Внутренняя ошибка сервера."
      });
      return true;
    }
  );
});
