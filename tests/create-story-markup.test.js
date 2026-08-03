const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("create page exposes semantic controls, overlay, and optimized artwork", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  ["createHero", "generatorForm", "ageGroupOptions", "pageCountOptions", "generationOverlay", "generationProgress", "generationTasksPanel", "generationOpenStoryButton"].forEach((id) => {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  });
  ["5-6", "7-8", "9-10"].forEach((value) => assert.match(html, new RegExp(`name=["']ageGroup["'][^>]*value=["']${value}["']`)));
  ["3", "5", "7"].forEach((value) => assert.match(html, new RegExp(`name=["']pageCount["'][^>]*value=["']${value}["']`)));
  ["create-page-background.png", "create-hero.png", "create-hedgehog.png", "create-fox-lantern.png", "generation-hero.png"].forEach((file) => {
    assert.equal(fs.existsSync(path.join(__dirname, "..", "assets", "create", file)), true);
  });
});
