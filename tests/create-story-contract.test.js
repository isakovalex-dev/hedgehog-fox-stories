const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const handler = require("../api/generate-story.js");

test("generation contract accepts new ages and seven pages without rewriting legacy ages", () => {
  const api = handler.__testables;
  assert.deepEqual(
    ["5-6", "7-8", "9-10"].map(api.normalizeAgeGroup),
    ["5-6", "7-8", "9-10"]
  );
  assert.equal(api.normalizePageCount(7), 7);
  assert.equal(api.normalizePageCount(99), 7);

  global.window = { HFStorageService: { getJSON: () => [], setJSON() {}, removeItem() {} } };
  delete require.cache[require.resolve("../js/storyService.js")];
  require("../js/storyService.js");
  const stories = window.HFStoryService;
  assert.equal(stories.normalizeAgeGroup("5-7"), "5-7");
  assert.equal(stories.normalizeAgeGroup("8-10"), "8-10");
  assert.equal(stories.getAgeGroupLabel("9-10"), "9–10 лет");

  const rpc = fs.readFileSync(path.join(__dirname, "..", "docs", "supabase-rpc-generated-story.sql"), "utf8");
  assert.match(rpc, /p_age_group in \('5-6', '7-8', '9-10', '5-7', '8-10'\)/);
});
