"use strict";

const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");
const test = require("node:test");

const root = resolve(__dirname, "..");
const signingPath = resolve(root, "api/get-story-illustration-url.js");
const apiFiles = [
  "api/generate-story-illustration.js",
  "api/get-story-illustration-url.js",
  "api/create-checkout.js",
  "api/payment-webhook.js"
];

function createResponseRecorder() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(body) { this.body = body; }
  };
}

test("Supabase endpoint sources do not retain a production fallback", async () => {
  for (const file of apiFiles) {
    const source = await readFile(resolve(root, file), "utf8");
    assert.doesNotMatch(source, /https:\/\/ynidvdesfolavhngubqv\.supabase\.co/);
    assert.doesNotMatch(source, /sb_publishable_nQg--YaINF8OoBd4wceHkA_yo76Z5hy/);
  }
});

test("illustration signing fails safely before Auth when public config is absent", async () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalAnonKey = process.env.SUPABASE_ANON_KEY;
  const originalFetch = global.fetch;
  let fetchCalls = 0;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  delete require.cache[require.resolve(signingPath)];
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch must not be called");
  };

  try {
    const handler = require(signingPath);
    const response = createResponseRecorder();
    await handler({ method: "POST", headers: { authorization: "Bearer test" }, body: {} }, response);
    assert.equal(fetchCalls, 0);
    assert.equal(response.statusCode, 500);
    assert.deepEqual(JSON.parse(response.body), {
      error: "illustration_unavailable",
      message: "Иллюстрация временно недоступна."
    });
  } finally {
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalAnonKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = originalAnonKey;
    global.fetch = originalFetch;
    delete require.cache[require.resolve(signingPath)];
  }
});
