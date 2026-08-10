"use strict";

process.env.IMAGE_GENERATION_ENABLED = "true";
process.env.OPENAI_IMAGE_API_KEY = "test-key";
process.env.IMAGE_MODEL = "gpt-image-2";
process.env.IMAGE_SIZE = "1536x1024";
process.env.IMAGE_QUALITY = "medium";
process.env.SUPABASE_URL = "https://supabase.example.test";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SECRET_KEY = "test-service-key";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const test = require("node:test");
const handler = require("../api/generate-story-illustration.js");

const USER_ID = "a0a1a2a3-a4a5-4a6a-8a8a-a9aaabacadae";
const RESERVATION_ID = "b0b1b2b3-b4b5-4b6b-8b8b-b9babbbcbdbE".toLowerCase();
const IDEMPOTENCY_KEY = "c0c1c2c3-c4c5-4c6c-8c8c-c9cacbcccdce";
const PROVIDER_URL = "https://api.openai.com/v1/images/generations";

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers }
  });
}

function getPage(imageUrl = "") {
  return {
    id: "page-1",
    page_number: 1,
    text: "Ежонок нашёл красный воздушный шар у реки.",
    image_prompt: "Hedgehog finds a red balloon by a river.",
    image_url: imageUrl
  };
}

async function runRequest(fetchHandler, body = {}, pageImageUrl = "") {
  const originalFetch = global.fetch;
  const headers = {};
  let output = "";
  global.fetch = fetchHandler;
  const req = {
    method: "POST",
    headers: {
      origin: "http://localhost:8031",
      authorization: "Bearer caller-token",
      "x-idempotency-key": IDEMPOTENCY_KEY
    },
    body: typeof body === "string" ? body : { storyId: "story-1", pageNumber: 1, ...body }
  };
  const res = {
    statusCode: 0,
    setHeader(name, value) { headers[String(name).toLowerCase()] = value; },
    end(value) { output = value; }
  };

  try {
    await handler(req, res);
    return { statusCode: res.statusCode, body: JSON.parse(output), headers };
  } finally {
    global.fetch = originalFetch;
  }
}

function auth(url) {
  return String(url) === "https://supabase.example.test/auth/v1/user";
}

function story(url) {
  return String(url).includes("/rest/v1/stories?");
}

function page(url) {
  return String(url).includes("/rest/v1/story_pages?");
}

function reserve(url) {
  return String(url) === "https://supabase.example.test/rest/v1/rpc/reserve_ai_usage";
}

function complete(url) {
  return String(url) === "https://supabase.example.test/rest/v1/rpc/complete_ai_usage";
}

function release(url) {
  return String(url) === "https://supabase.example.test/rest/v1/rpc/release_ai_usage";
}

function providerResponse() {
  return json(
    { data: [{ b64_json: Buffer.from("image-bytes").toString("base64") }], usage: { output_tokens: 34 } },
    200,
    { "x-request-id": "req-test" }
  );
}

function standardResponses(url, options, pageImageUrl = "") {
  if (auth(url)) return json({ id: USER_ID });
  if (story(url)) return json([{ id: "story-1", title: "Test", mood: "calm" }]);
  if (page(url)) return json([getPage(pageImageUrl)]);
  if (String(url).includes("/storage/v1/object/")) return json({ Key: "ok" });
  if (String(url).includes("/rest/v1/story_pages?id=")) return new Response("", { status: 204 });
  throw new Error(`Unexpected URL: ${url}`);
}

test("style_only sends no image reference and keeps the style passport before page text", async () => {
  const result = await runRequest(async (url, options = {}) => {
    if (String(url) === PROVIDER_URL) {
      const payload = JSON.parse(options.body);
      assert.equal(payload.model, "gpt-image-2");
      assert.equal(payload.quality, "medium");
      assert.ok(payload.prompt.includes("STYLE PASSPORT"));
      assert.ok(payload.prompt.indexOf("STYLE PASSPORT") < payload.prompt.indexOf("EXACT PAGE TEXT IN RUSSIAN"));
      return providerResponse();
    }
    if (reserve(url)) return json({ allowed: true, code: "reserved", reservation: { id: RESERVATION_ID } });
    if (complete(url)) return json({ completed: true, usage: { resource_kind: "image", used_count: 1 } });
    return standardResponses(url, options);
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.illustrated, true);
  assert.deepEqual(result.body.usage, { resource_kind: "image", used_count: 1 });
  assert.equal(result.headers.vary, "Origin");
});

test("with_references sends only explicitly selected unique files", async () => {
  const result = await runRequest(async (url, options = {}) => {
    if (String(url) === "https://api.openai.com/v1/images/edits") {
      assert.equal(options.body.getAll("image[]").length, 1);
      assert.equal(options.body.getAll("image[]")[0].name, "sea-bench.png");
      return providerResponse();
    }
    if (reserve(url)) return json({ allowed: true, code: "reserved", reservation: { id: RESERVATION_ID } });
    if (complete(url)) return json({ completed: true, usage: { resource_kind: "image", used_count: 1 } });
    return standardResponses(url, options);
  }, { generationMode: "with_references", referenceIds: ["sea-bench", "sea-bench"] });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.illustrated, true);
  assert.equal(result.headers.vary, "Origin");
});

test("image quota rejection never calls the OpenAI image endpoint", async () => {
  let providerCalls = 0;
  let storageCalls = 0;
  const result = await runRequest(async (url, options = {}) => {
    if (String(url).startsWith("https://api.openai.com/v1/images/")) providerCalls += 1;
    if (String(url).includes("/storage/v1/object/")) storageCalls += 1;
    if (reserve(url)) return json({ allowed: false, code: "quota_exhausted" });
    return standardResponses(url, options);
  });

  assert.equal(result.statusCode, 403);
  assert.deepEqual(result.body, { error: "quota_exhausted", message: "Лимит генерации исчерпан." });
  assert.equal(providerCalls, 0);
  assert.equal(storageCalls, 0);
  assert.equal(result.headers.vary, "Origin");
  assert.match(result.headers["access-control-allow-headers"], /X-Idempotency-Key/i);
});

test("local image validation failures return a redacted invalid_request response", async () => {
  const cases = [
    { name: "invalid JSON", body: "{not-json", privateDetail: "valid JSON" },
    { name: "invalid story id", body: { storyId: "story/invalid" }, privateDetail: "Story id" },
    { name: "invalid page number", body: { pageNumber: 6 }, privateDetail: "between 1 and 5" },
    { name: "invalid generation mode", body: { generationMode: "unsupported" }, privateDetail: "generation mode" }
  ];

  for (const scenario of cases) {
    const result = await runRequest(async (url, options = {}) => {
      if (scenario.name === "invalid generation mode") return standardResponses(url, options);
      throw new Error(`Unexpected request for ${scenario.name}: ${url}`);
    }, scenario.body);

    assert.equal(result.statusCode, 400, scenario.name);
    assert.deepEqual(result.body, {
      error: "invalid_request",
      message: "Некорректный запрос."
    }, scenario.name);
    assert.doesNotMatch(JSON.stringify(result.body), new RegExp(scenario.privateDetail, "i"), scenario.name);
  }
});

test("an oversized streamed illustration body returns a redacted 413 before downstream requests", async () => {
  const originalFetch = global.fetch;
  let downstreamCalls = 0;
  const headers = {};
  let output = "";
  global.fetch = async () => {
    downstreamCalls += 1;
    throw new Error("The streamed body must be rejected before downstream requests");
  };
  const req = Readable.from([JSON.stringify({ padding: "x".repeat(8 * 1024) })]);
  req.method = "POST";
  req.headers = {
    origin: "http://localhost:8031",
    authorization: "Bearer caller-token",
    "x-idempotency-key": IDEMPOTENCY_KEY
  };
  const res = {
    statusCode: 0,
    setHeader(name, value) { headers[String(name).toLowerCase()] = value; },
    end(value) { output = value; }
  };

  try {
    await handler(req, res);
  } finally {
    global.fetch = originalFetch;
  }

  const result = { statusCode: res.statusCode, body: JSON.parse(output), headers };
  assert.equal(result.statusCode, 413);
  assert.deepEqual(result.body, {
    error: "invalid_request",
    message: "Некорректный запрос."
  });
  assert.doesNotMatch(JSON.stringify(result.body), /body is too large/i);
  assert.equal(downstreamCalls, 0);
  assert.equal(result.headers.vary, "Origin");
});

test("a stored current image returns without a reservation or credit", async () => {
  let providerCalls = 0;
  let reservationCalls = 0;
  const result = await runRequest(
    async (url, options = {}) => {
      if (String(url).startsWith("https://api.openai.com/v1/images/")) providerCalls += 1;
      if (reserve(url)) reservationCalls += 1;
      return standardResponses(url, options, "storage://story-illustrations/" + USER_ID + "/story-1/page-1.webp");
    },
    {},
    "storage://story-illustrations/" + USER_ID + "/story-1/page-1.webp"
  );

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, { illustrated: true, alreadyExists: true, pageNumber: 1 });
  assert.equal(reservationCalls, 0);
  assert.equal(providerCalls, 0);
  assert.equal(result.headers.vary, "Origin");
});

test("force true reserves and completes one image credit", async () => {
  const rpcCalls = [];
  const writeSteps = [];
  let providerCalls = 0;
  const result = await runRequest(
    async (url, options = {}) => {
      if (String(url) === PROVIDER_URL) {
        providerCalls += 1;
        return providerResponse();
      }
      if (reserve(url)) {
        rpcCalls.push("reserve_ai_usage");
        assert.deepEqual(JSON.parse(options.body), {
          p_user_id: USER_ID,
          p_resource_kind: "image",
          p_idempotency_key: IDEMPOTENCY_KEY
        });
        return json({ allowed: true, code: "reserved", reservation: { id: RESERVATION_ID } });
      }
      if (String(url) === "https://supabase.example.test/rest/v1/rpc/complete_ai_usage") {
        rpcCalls.push("complete_ai_usage");
        writeSteps.push("complete");
        assert.deepEqual(JSON.parse(options.body), { p_reservation_id: RESERVATION_ID });
        return json({ completed: true, usage: { resource_kind: "image", used_count: 1 } });
      }
      if (String(url).includes("/storage/v1/object/")) {
        writeSteps.push("upload");
        return json({ Key: "ok" });
      }
      if (String(url).includes("/rest/v1/story_pages?id=")) {
        writeSteps.push("link");
        return new Response(null, { status: 204 });
      }
      return standardResponses(url, options, "storage://story-illustrations/" + USER_ID + "/story-1/page-1.webp");
    },
    { force: true },
    "storage://story-illustrations/" + USER_ID + "/story-1/page-1.webp"
  );

  assert.equal(result.statusCode, 200);
  assert.equal(providerCalls, 1);
  assert.deepEqual(rpcCalls, ["reserve_ai_usage", "complete_ai_usage"]);
  assert.deepEqual(writeSteps, ["upload", "link", "complete"]);
  assert.deepEqual(result.body, {
    illustrated: true,
    alreadyExists: false,
    regenerated: true,
    pageNumber: 1,
    usage: { resource_kind: "image", used_count: 1 }
  });
  assert.equal(result.headers.vary, "Origin");
});

test("provider or Storage failure releases a pending image reservation", async () => {
  for (const failureTarget of ["provider", "storage"]) {
    let releasedReservationId = null;
    let providerCalls = 0;
    const result = await runRequest(async (url, options = {}) => {
      if (String(url) === PROVIDER_URL) {
        providerCalls += 1;
        if (failureTarget === "provider") return json({ error: { message: "provider token secret" } }, 503);
        return providerResponse();
      }
      if (reserve(url)) return json({ allowed: true, code: "reserved", reservation: { id: RESERVATION_ID } });
      if (release(url)) {
        releasedReservationId = JSON.parse(options.body).p_reservation_id;
        return json({ released: true });
      }
      if (failureTarget === "storage" && String(url).includes("/storage/v1/object/")) {
        return json({ message: "storage provider secret" }, 500);
      }
      return standardResponses(url, options);
    });

    assert.equal(providerCalls, failureTarget === "provider" ? 2 : 1);
    assert.equal(releasedReservationId, RESERVATION_ID);
    if (failureTarget === "provider") {
      assert.equal(result.statusCode, 502);
      assert.deepEqual(result.body, { error: "provider_unavailable", message: "Сервис генерации временно недоступен." });
    } else {
      assert.equal(result.statusCode, 500);
      assert.deepEqual(result.body, { error: "internal_error", message: "Внутренняя ошибка сервера." });
    }
    assert.doesNotMatch(JSON.stringify(result.body), /secret/);
    assert.equal(result.headers.vary, "Origin");
  }
});

test("a failed page link releases the pending image reservation exactly once", async () => {
  let releaseCalls = 0;
  let releasedReservationId = null;
  const result = await runRequest(async (url, options = {}) => {
    if (String(url) === PROVIDER_URL) return providerResponse();
    if (reserve(url)) return json({ allowed: true, code: "reserved", reservation: { id: RESERVATION_ID } });
    if (release(url)) {
      releaseCalls += 1;
      releasedReservationId = JSON.parse(options.body).p_reservation_id;
      return json({ released: true });
    }
    if (String(url).includes("/rest/v1/story_pages?id=")) {
      return json({ message: "page link secret" }, 500);
    }
    return standardResponses(url, options);
  });

  assert.equal(releaseCalls, 1);
  assert.equal(releasedReservationId, RESERVATION_ID);
  assert.equal(result.statusCode, 500);
  assert.deepEqual(result.body, { error: "internal_error", message: "Внутренняя ошибка сервера." });
  assert.doesNotMatch(JSON.stringify(result.body), /secret|link/i);
});

test("a failed image completion releases the pending reservation exactly once", async () => {
  let releaseCalls = 0;
  let releasedReservationId = null;
  const result = await runRequest(async (url, options = {}) => {
    if (String(url) === PROVIDER_URL) return providerResponse();
    if (reserve(url)) return json({ allowed: true, code: "reserved", reservation: { id: RESERVATION_ID } });
    if (complete(url)) return json({ message: "completion secret" }, 500);
    if (release(url)) {
      releaseCalls += 1;
      releasedReservationId = JSON.parse(options.body).p_reservation_id;
      return json({ released: true });
    }
    return standardResponses(url, options);
  });

  assert.equal(releaseCalls, 1);
  assert.equal(releasedReservationId, RESERVATION_ID);
  assert.equal(result.statusCode, 500);
  assert.deepEqual(result.body, { error: "internal_error", message: "Внутренняя ошибка сервера." });
  assert.doesNotMatch(JSON.stringify(result.body), /secret|completion/i);
});

test("an idempotency replay does not make a second image-provider request", async () => {
  let providerCalls = 0;
  const result = await runRequest(async (url, options = {}) => {
    if (String(url).startsWith("https://api.openai.com/v1/images/")) providerCalls += 1;
    if (reserve(url)) return json({ allowed: false, code: "idempotency_replayed" });
    return standardResponses(url, options);
  });

  assert.equal(result.statusCode, 409);
  assert.deepEqual(result.body, { error: "idempotency_replayed", message: "Этот запрос уже обработан." });
  assert.equal(providerCalls, 0);
  assert.equal(result.headers.vary, "Origin");
});

test("style profile contains source hashes and code has no model or quality fallback", () => {
  const profilePath = path.join(__dirname, "..", "assets", "illustration-style-profile.json");
  const profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));
  const endpointSource = fs.readFileSync(path.join(__dirname, "..", "api", "generate-story-illustration.js"), "utf8");

  assert.equal(Object.keys(profile.source_hashes).length, 14);
  assert.match(endpointSource, /const IMAGE_MODEL = process\.env\.IMAGE_MODEL \|\| "";/);
  assert.match(endpointSource, /const IMAGE_QUALITY = process\.env\.IMAGE_QUALITY \|\| "";/);
  assert.doesNotMatch(endpointSource, /process\.env\.IMAGE_MODEL \|\| "gpt-image/);
});
