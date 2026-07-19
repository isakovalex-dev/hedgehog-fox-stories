"use strict";

process.env.IMAGE_GENERATION_ENABLED = "true";
process.env.OPENAI_IMAGE_API_KEY = "test-key";
process.env.IMAGE_MODEL = "gpt-image-2";
process.env.IMAGE_SIZE = "1536x1024";
process.env.IMAGE_QUALITY = "medium";
process.env.SUPABASE_SECRET_KEY = "test-secret";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const handler = require("../api/generate-story-illustration.js");

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers }
  });
}

async function runRequest(body, onProviderRequest) {
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const requestUrl = String(url);

    if (requestUrl.includes("/auth/v1/user")) return json({ id: "user-1" });
    if (requestUrl.includes("/rest/v1/stories?")) return json([{ id: "story-1", title: "Test", mood: "calm" }]);
    if (requestUrl.includes("/rest/v1/story_pages?")) {
      return json([
        {
          id: "page-1",
          page_number: 1,
          text: "Ежонок нашёл красный воздушный шар у реки.",
          image_prompt: "Hedgehog finds a red balloon by a river.",
          image_url: ""
        }
      ]);
    }
    if (requestUrl.startsWith("https://api.openai.com/v1/images/")) {
      onProviderRequest(requestUrl, options);
      return json(
        { data: [{ b64_json: Buffer.from("image-bytes").toString("base64") }], usage: { output_tokens: 34 } },
        200,
        { "x-request-id": "req-test" }
      );
    }
    if (requestUrl.includes("/storage/v1/object/")) return json({ Key: "ok" });
    if (requestUrl.includes("/rest/v1/story_pages?id=")) return new Response("", { status: 204 });
    throw new Error(`Unexpected URL: ${requestUrl}`);
  };

  let output = "";
  const req = {
    method: "POST",
    headers: { origin: "http://localhost:8031", authorization: "Bearer test" },
    body: { storyId: "story-1", pageNumber: 1, force: true, ...body }
  };
  const res = { statusCode: 0, setHeader() {}, end(value) { output = value; } };

  try {
    await handler(req, res);
    return JSON.parse(output);
  } finally {
    global.fetch = originalFetch;
  }
}

test("style_only sends no image reference and keeps the style passport before page text", async () => {
  const result = await runRequest({}, (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/images/generations");
    assert.equal(typeof options.body, "string");
    const payload = JSON.parse(options.body);
    assert.equal(payload.model, "gpt-image-2");
    assert.equal(payload.quality, "medium");
    assert.ok(payload.prompt.includes("STYLE PASSPORT"));
    assert.ok(payload.prompt.indexOf("STYLE PASSPORT") < payload.prompt.indexOf("EXACT PAGE TEXT IN RUSSIAN"));
  });

  assert.equal(result.illustrated, true);
});

test("with_references sends only explicitly selected unique files", async () => {
  const result = await runRequest(
    { generationMode: "with_references", referenceIds: ["sea-bench", "sea-bench"] },
    (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/images/edits");
      assert.equal(options.body.getAll("image[]").length, 1);
      assert.equal(options.body.getAll("image[]")[0].name, "sea-bench.png");
    }
  );

  assert.equal(result.illustrated, true);
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
