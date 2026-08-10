"use strict";

process.env.AI_GENERATION_ENABLED = "true";
process.env.AI_API_BASE_URL = "https://ai.example.test/v1";
process.env.AI_API_KEY = "test-provider-key";
process.env.AI_MODEL = "test-model";
process.env.SUPABASE_URL = "https://supabase.example.test";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SECRET_KEY = "test-service-key";

const assert = require("node:assert/strict");
const test = require("node:test");
const handler = require("../api/generate-story.js");

const USER_ID = "a0a1a2a3-a4a5-4a6a-8a8a-a9aaabacadae";
const RESERVATION_ID = "b0b1b2b3-b4b5-4b6b-8b8b-b9babbbcbdbE".toLowerCase();
const IDEMPOTENCY_KEY = "c0c1c2c3-c4c5-4c6c-8c8c-c9cacbcccdce";
const PROVIDER_URL = "https://ai.example.test/v1/chat/completions";

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers }
  });
}

function providerResponse() {
  return json({
    choices: [{
      message: {
        content: JSON.stringify({
          title: "Добрая прогулка",
          ageGroup: "5-6",
          mood: "перед сном",
          lesson: "друзья помогают друг другу",
          pages: [{
            pageNumber: 1,
            text: "Ежонок и Лисёнок вместе нашли тёплую тропинку у дома.",
            sceneTag: "cozy_house",
            imagePrompt: "Ежонок и Лисёнок идут по тёплой тропинке возле уютного дома вечером."
          }]
        })
      }
    }]
  });
}

async function runRequest(fetchHandler) {
  const originalFetch = global.fetch;
  const headers = {};
  let output = "";
  global.fetch = fetchHandler;
  const req = {
    method: "POST",
    headers: {
      origin: "http://localhost:8000",
      authorization: "Bearer caller-token",
      "x-idempotency-key": IDEMPOTENCY_KEY
    },
    body: { topic: "прогулка", lesson: "друзья помогают друг другу", ageGroup: "5-6", mood: "bedtime", pageCount: 1 }
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

function authenticatedUser(url) {
  return String(url) === "https://supabase.example.test/auth/v1/user";
}

function reservation(url) {
  return String(url) === "https://supabase.example.test/rest/v1/rpc/reserve_ai_usage";
}

function finalizer(url) {
  return String(url) === "https://supabase.example.test/rest/v1/rpc/create_story_from_reservation";
}

function release(url) {
  return String(url) === "https://supabase.example.test/rest/v1/rpc/release_ai_usage";
}

test("quota rejection returns 403 before the text provider is called", async () => {
  let providerCalls = 0;
  const result = await runRequest(async (url) => {
    if (String(url) === PROVIDER_URL) providerCalls += 1;
    if (authenticatedUser(url)) return json({ id: USER_ID });
    if (reservation(url)) return json({ allowed: false, code: "quota_exhausted" });
    throw new Error(`Unexpected URL: ${url}`);
  });

  assert.equal(result.statusCode, 403);
  assert.deepEqual(result.body, { error: "quota_exhausted", message: "Лимит генерации исчерпан." });
  assert.equal(providerCalls, 0);
  assert.equal(result.headers.vary, "Origin");
  assert.match(result.headers["access-control-allow-headers"], /X-Idempotency-Key/i);
});

test("one accepted request calls the provider once then creates the story from its reservation", async () => {
  let providerCalls = 0;
  const rpcCalls = [];
  const result = await runRequest(async (url, options = {}) => {
    if (String(url) === PROVIDER_URL) {
      providerCalls += 1;
      return providerResponse();
    }
    if (authenticatedUser(url)) return json({ id: USER_ID });
    if (String(url).includes("/rest/v1/rpc/")) {
      rpcCalls.push(String(url).split("/").pop());
      if (reservation(url)) return json({ allowed: true, code: "reserved", reservation: { id: RESERVATION_ID } });
      if (finalizer(url)) {
        const payload = JSON.parse(options.body);
        assert.equal(payload.p_reservation_id, RESERVATION_ID);
        return json({
          story: { id: "story-1", title: "Добрая прогулка", age_group: "5-6", mood: "перед сном", lesson: "друзья помогают друг другу" },
          pages: [{ page_number: 1, text: "Ежонок и Лисёнок вместе нашли тёплую тропинку у дома.", scene_tag: "cozy_house", image_url: "", image_prompt: "Ежонок и Лисёнок идут по тёплой тропинке возле уютного дома вечером." }],
          subscription: { status: "free" },
          usage: { generations_used: 1, generation_limit: 3 }
        });
      }
    }
    throw new Error(`Unexpected URL: ${url}`);
  });

  assert.equal(result.statusCode, 200);
  assert.equal(providerCalls, 1);
  assert.deepEqual(rpcCalls, ["reserve_ai_usage", "create_story_from_reservation"]);
  assert.equal(result.body.meta.authChecked, true);
  assert.equal(result.body.meta.usageReserved, true);
  assert.equal(result.body.meta.usageIncremented, true);
  assert.equal(result.body.meta.aiProvider, "openai-compatible");
  assert.deepEqual(result.body.meta.subscription, { status: "free" });
  assert.deepEqual(result.body.meta.usage, { generations_used: 1, generation_limit: 3 });
});

test("provider failure releases the reserved story credit", async () => {
  let providerCalls = 0;
  let releasedReservationId = null;
  const result = await runRequest(async (url, options = {}) => {
    if (String(url) === PROVIDER_URL) {
      providerCalls += 1;
      return json({ error: { message: "provider secret diagnostic" } }, 503);
    }
    if (authenticatedUser(url)) return json({ id: USER_ID });
    if (reservation(url)) return json({ allowed: true, code: "reserved", reservation: { id: RESERVATION_ID } });
    if (release(url)) {
      releasedReservationId = JSON.parse(options.body).p_reservation_id;
      return json({ released: true });
    }
    throw new Error(`Unexpected URL: ${url}`);
  });

  assert.equal(providerCalls, 1);
  assert.equal(releasedReservationId, RESERVATION_ID);
  assert.equal(result.statusCode, 502);
  assert.deepEqual(result.body, { error: "provider_unavailable", message: "Сервис генерации временно недоступен." });
  assert.doesNotMatch(JSON.stringify(result.body), /provider secret diagnostic/);
});

test("the same idempotency key does not call the provider twice", async () => {
  let providerCalls = 0;
  const result = await runRequest(async (url) => {
    if (String(url) === PROVIDER_URL) providerCalls += 1;
    if (authenticatedUser(url)) return json({ id: USER_ID });
    if (reservation(url)) return json({ allowed: false, code: "idempotency_replayed" });
    throw new Error(`Unexpected URL: ${url}`);
  });

  assert.equal(result.statusCode, 409);
  assert.deepEqual(result.body, { error: "idempotency_replayed", message: "Этот запрос уже обработан." });
  assert.equal(providerCalls, 0);
});
