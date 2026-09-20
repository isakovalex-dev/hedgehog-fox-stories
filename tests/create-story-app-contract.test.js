const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("app delegates generation lifecycle to the create-story flow", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(source, /HFCreateStoryFlow\.create/);
  assert.match(source, /generationFlow\.start\(\{ ageGroup: getFormValue\(formData, "ageGroup", "5-6"\), trigger: submitButton \}\)/);
  assert.match(source, /generationFlow\.setReady\(\{ storyId: savedStory\.id \}\)/);
  assert.match(source, /onOpenStory: \(storyId\) => openStory\(storyId\)/);
  assert.match(source, /storyMoodHelp/);
  assert.match(source, /pageCountHelp/);
  assert.match(source, /navGeneratorButton\?\.classList\.toggle\("active", route\.name === "create"\)/);
  assert.match(source, /navGeneratorButton\?\.setAttribute\("aria-current", "page"\)/);
  assert.doesNotMatch(source, /generationTaskTimerId/);
  assert.doesNotMatch(source, /generationMessageTimerId/);
});

test("featured home cards use the catalog duration and age", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  const resolver = source.match(/function resolveHomeFeaturedStory\(featuredStory\) \{[\s\S]*?\n  \}/)?.[0] || "";

  assert.match(resolver, /title: catalogStory\.title/);
  assert.match(resolver, /duration: catalogStory\.time/);
  assert.match(resolver, /age: catalogStory\.age/);
});
