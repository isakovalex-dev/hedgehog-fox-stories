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

  const migration = fs.readFileSync(
    path.join(__dirname, "..", "supabase", "migrations", "20260810003928_security_remediation.sql"),
    "utf8"
  );
  assert.match(migration, /p_age_group in \('5-6', '7-8', '9-10', '5-7', '8-10'\)/);
  assert.match(migration, /jsonb_array_length\(p_pages\) > 7/);
  assert.match(migration, /story cannot contain more than 7 pages/);

  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /name="pageCount" value="7"/);
});
