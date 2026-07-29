"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.join(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("index keeps application DOM contracts", () => {
  const html = read("index.html");
  const requiredIds = [
    "mainContent",
    "navTopButton",
    "navMenuButton",
    "siteNavMenu",
    "navLoginButton",
    "navStoriesButton",
    "navMemoryButton",
    "navPricingButton",
    "navParentsButton",
    "navGeneratorButton",
    "navLibraryButton",
    "navAboutButton",
    "chooseStoryButton",
    "readFirstButton",
    "openGeneratorButton",
    "openLibraryButton",
    "openAboutButton",
    "stories",
    "storyList",
    "filters",
    "pricing",
    "generator",
    "generatorForm",
    "generationStatus",
    "generationWaitPanel",
    "subscriptionScreen",
    "library",
    "libraryList",
    "reader",
    "slides",
    "readingProgress",
    "memoryGameSection",
    "generationExperience"
  ];

  requiredIds.forEach((id) => {
    assert.match(html, new RegExp(`id=["']${id}["']`), `Missing #${id}`);
  });
});

test("index keeps delegated data contracts", () => {
  const html = read("index.html");
  [
    "data-filter",
    "data-start-checkout",
    "data-auth-action",
    "data-password-toggle",
    "data-open-memory"
  ].forEach((attribute) => assert.match(html, new RegExp(attribute)));
});

test("about page keeps analytics hooks and one h1", () => {
  const html = read("about.html");
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /data-about-read-stories/);
  assert.match(html, /data-about-create-story/);
});

test("about artwork keeps its intrinsic proportions", () => {
  const theme = read("styles/journey-theme.css");
  assert.match(theme, /\.about-page[\s\S]*aspect-ratio:\s*auto\s*!important/);
  assert.match(theme, /\.about-page[\s\S]*height:\s*auto/);
  assert.match(theme, /\.about-page[\s\S]*object-fit:\s*contain/);
});

test("shared pages load the journey theme after legacy CSS", () => {
  ["index.html", "about.html", "privacy.html", "requisites.html", "terms.html", "404.html"].forEach(
    (file) => {
      const html = read(file);
      const legacyIndex = html.indexOf("styles.css");
      const tokensIndex = html.indexOf("styles/journey-tokens.css");
      const themeIndex = html.indexOf("styles/journey-theme.css");

      assert.ok(legacyIndex >= 0, `${file} must load legacy CSS`);
      assert.ok(tokensIndex > legacyIndex, `${file} must load journey tokens after legacy CSS`);
      assert.ok(themeIndex > tokensIndex, `${file} must load journey theme after tokens`);
      assert.match(html, /<body[^>]*class=["'][^"']*journey-theme/);
    }
  );
});

test("homepage loads an isolated faithful book theme", () => {
  const homepage = read("index.html");
  assert.match(homepage, /<body[^>]*class=["'][^"']*\bhome-page\b/);
  assert.match(homepage, /styles\/homepage-book\.css/);

  ["about.html", "privacy.html", "requisites.html", "terms.html", "404.html"].forEach((file) => {
    assert.doesNotMatch(read(file), /styles\/homepage-book\.css/, `${file} must keep the shared theme`);
  });
});

test("static page navigation uses application routes instead of hidden anchors", () => {
  ["about.html", "privacy.html", "requisites.html", "terms.html"].forEach((file) => {
    const html = read(file);
    assert.match(html, /href=["']\/stories["']/);
    assert.match(html, /href=["']\/create["']/);
    assert.match(html, /href=["']\/library["']/);
    assert.doesNotMatch(html, /href=["']index\.html#(?:generator|library)["']/);
  });
});

test("Vercel rewrites every client-side application route", () => {
  const config = read("vercel.json");
  ["/create", "/library", "/stories", "/stories/:path*"].forEach((route) => {
    assert.match(config, new RegExp(`"source"\\s*:\\s*"${route.replace(/[/*:]/g, "\\$&")}"`));
  });
});

test("living book hero preserves the primary action hooks", () => {
  const html = read("index.html");
  assert.match(html, /class=["'][^"']*journey-hero/);
  assert.match(html, /id=["']heroTitle["']/);
  assert.match(html, /id=["']chooseStoryButton["']/);
  assert.match(html, /id=["']openGeneratorButton["']/);
  assert.match(html, /class=["'][^"']*journey-trail/);
});

test("story renderer keeps delegated card actions", () => {
  const source = read("js/app.js");
  [
    "data-story-card",
    "data-read",
    "data-like",
    "data-delete-story",
    "data-illustrate-story"
  ].forEach((attribute) => assert.match(source, new RegExp(attribute)));
});

test("reader completion sends the normalized story shape to journey storage", () => {
  const source = read("js/app.js");
  assert.match(source, /markDiscovered\?\.\(\{\s*id:\s*activeStory\.id,/);
  assert.match(source, /journeyPlace:\s*activeStory\.journeyPlace,/);
});

test("journey service loads after storage and before app", () => {
  const source = read("index.html");
  const storageIndex = source.indexOf("js/storageService.js");
  const journeyIndex = source.indexOf("js/journeyService.js");
  const appIndex = source.indexOf("js/app.js");

  assert.ok(storageIndex >= 0);
  assert.ok(journeyIndex > storageIndex);
  assert.ok(appIndex > journeyIndex);
});

test("homepage exposes the accessible journey map", () => {
  const html = read("index.html");
  ["journeyMap", "journeyPlaces", "journeyKeepsakes"].forEach((id) => {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  });
  assert.match(html, /aria-labelledby=["']journeyTitle["']/);
  assert.match(html, /aria-live=["']polite["']/);
});

test("homepage exposes exactly the two production games", () => {
  const html = read("index.html");
  assert.match(html, /id=["']games["']/);
  assert.match(html, /href=["']\/games\/memory["']/);
  assert.match(html, /href=["']\/games\/endless-flight["']/);
  assert.match(html, />Мемори</);
  assert.match(html, />Бесконечный полёт</);
  assert.doesNotMatch(html, /forest-catcher/i);
});

test("sitemap lists only the two public games", () => {
  const sitemap = read("sitemap.xml");
  const gameUrls = [...sitemap.matchAll(/<loc>[^<]+\/games\/([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(gameUrls, ["memory", "endless-flight"]);
});

test("experimental games stay out of the production build", () => {
  const buildScript = read("scripts/build-static.mjs");
  [
    "assets/forest-catcher",
    "flight.html",
    "forest-catcher.html",
    "js/catchGame.js",
    "js/forestCatcherGame.js"
  ].forEach((item) => assert.match(buildScript, new RegExp(item.replace(/[./]/g, "\\$&"))));
});
