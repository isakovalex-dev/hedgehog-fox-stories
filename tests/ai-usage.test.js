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
