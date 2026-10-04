"use strict";

process.env.SUPABASE_URL = "https://supabase.example.test";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SECRET_KEY = "test-service-key";

const assert = require("node:assert/strict");
const test = require("node:test");
const handler = require("../api/get-story-illustration-url.js");

const USER_ID = "a0a1a2a3-a4a5-4a6a-8a8a-a9aaabacadae";
const STORY_ID = "story-1";
const STORAGE_PREFIX = "storage://story-illustrations/";

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

async function runRequest(imageReference, storyId = STORY_ID) {
  const originalFetch = global.fetch;
  const requests = [];
  const headers = {};
  let output = "";

  global.fetch = async (url, options = {}) => {
    const request = { url: String(url), options };
    requests.push(request);

    if (request.url === "https://supabase.example.test/auth/v1/user") {
      return json({ id: USER_ID });
    }
    if (request.url.includes("/rest/v1/stories?")) {
      return json([{ id: storyId }]);
    }
    if (request.url.includes("/storage/v1/object/sign/story-illustrations/")) {
      return json({ signedURL: "/object/sign/story-illustrations/signed-reference" });
    }

    throw new Error(`Unexpected request: ${request.url}`);
  };

  const req = {
    method: "POST",
    headers: { authorization: "Bearer caller-token" },
    body: { imageReference, storyId }
  };
  const res = {
    statusCode: 0,
    setHeader(name, value) { headers[String(name).toLowerCase()] = value; },
    end(value) { output = value; }
  };

  try {
    await handler(req, res);
    return {
      statusCode: res.statusCode,
      body: JSON.parse(output),
      headers,
      storageSignRequests: requests.filter((request) => request.url.includes("/storage/v1/object/sign/story-illustrations/"))
    };
  } finally {
    global.fetch = originalFetch;
  }
}

function ownedReference(filename) {
  return `${STORAGE_PREFIX}${USER_ID}/${STORY_ID}/${filename}`;
}

test("signs a UUIDv4 illustration reference generated for its owner", async () => {
  const result = await runRequest(ownedReference("page-1-123e4567-e89b-42d3-a456-426614174000.webp"));

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.signedUrl, "https://supabase.example.test/storage/v1/object/sign/story-illustrations/signed-reference");
  assert.equal(result.storageSignRequests.length, 1);
});

test("signs uppercase UUIDv4 and legacy illustration filenames", async () => {
  const filenames = [
    "page-1-123E4567-E89B-42D3-A456-426614174000.webp",
    "page-1.webp",
    "page-1-42.webp"
  ];

  for (const filename of filenames) {
    const result = await runRequest(ownedReference(filename));

    assert.equal(result.statusCode, 200, filename);
    assert.equal(result.storageSignRequests.length, 1, filename);
  }
});

test("denies malformed or unowned illustration references before signing", async () => {
  const cases = [
    {
      name: "malformed UUID-like filename",
      imageReference: ownedReference("page-1-123e4567-e89b-52d3-a456-426614174000.webp"),
      storyId: STORY_ID
    },
    {
      name: "wrong user",
      imageReference: `${STORAGE_PREFIX}another-user/${STORY_ID}/page-1.webp`,
      storyId: STORY_ID
    },
    {
      name: "wrong story",
      imageReference: ownedReference("page-1.webp").replace(`/${STORY_ID}/`, "/other-story/"),
      storyId: STORY_ID
    },
    {
      name: "wrong bucket path",
      imageReference: ownedReference("page-1.webp").replace("story-illustrations", "other-bucket"),
      storyId: STORY_ID
    },
    {
      name: "wrong page number",
      imageReference: ownedReference("page-6.webp"),
      storyId: STORY_ID
    },
    {
      name: "non-webp filename",
      imageReference: ownedReference("page-1.png"),
      storyId: STORY_ID
    },
    {
      name: "uppercase extension",
      imageReference: ownedReference("page-1.WEBP"),
      storyId: STORY_ID
    }
  ];

  for (const scenario of cases) {
    const result = await runRequest(scenario.imageReference, scenario.storyId);

    assert.ok(result.statusCode >= 400 && result.statusCode < 500, scenario.name);
    assert.deepEqual(result.body, {
      error: "invalid_request",
      message: "Некорректный запрос."
    }, scenario.name);
    assert.equal(result.storageSignRequests.length, 0, scenario.name);
  }
});
