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

test("faithful homepage watercolor assets exist", () => {
  const requiredAssets = [
    "assets/journey/hero-coast-480.webp",
    "assets/journey/hero-coast-768.webp",
    "assets/journey/hero-coast-1200.webp",
    "assets/journey/hero-coast-1800.webp",
    "assets/journey/hero-coast-480.avif",
    "assets/journey/hero-coast-768.avif",
    "assets/journey/hero-coast-1200.avif",
    "assets/journey/hero-coast-1800.avif",
    "assets/journey/landmarks/forest.webp",
    "assets/journey/landmarks/forest.avif",
    "assets/journey/landmarks/mountains.webp",
    "assets/journey/landmarks/mountains.avif",
    "assets/journey/landmarks/boat.webp",
    "assets/journey/landmarks/boat.avif",
    "assets/journey/landmarks/lighthouse.webp",
    "assets/journey/landmarks/lighthouse.avif",
    "assets/journey/landmarks/village.webp",
    "assets/journey/landmarks/village.avif",
    "assets/journey/landmarks/heroes.webp",
    "assets/journey/landmarks/heroes.avif",
    "assets/journey/paper-grain.svg",
    "assets/journey/compass.svg",
    "assets/journey/paw-print.svg"
  ];

  requiredAssets.forEach((relativePath) => {
    assert.ok(fs.existsSync(path.join(projectRoot, relativePath)), `Missing ${relativePath}`);
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

test("faithful homepage hero keeps actions and watercolor structure", () => {
  const html = read("index.html");
  assert.match(html, /class=["'][^"']*book-brand-mark/);
  assert.match(html, /class=["'][^"']*book-hero-picture/);
  assert.match(html, /hero-coast-1800\.avif/);
  assert.match(html, /class=["'][^"']*book-route--hero/);
  ["chooseStoryButton", "openGeneratorButton"].forEach((id) => {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  });
});

test("faithful homepage hero keeps desktop and mobile geometry safeguards", () => {
  const css = read("styles/homepage-book.css");
  assert.match(
    css,
    /grid-template-columns:\s*minmax\(540px,\s*1fr\)\s+minmax\(500px,\s*1fr\)/
  );
  assert.match(css, /font-size:\s*clamp\(4\.25rem,\s*5\.5vw,\s*5\.5rem\)/);

  const mobile = css.slice(css.indexOf("@media (max-width: 720px)"));
  assert.match(mobile, /\.home-page \.book-brand-mark\s*\{[\s\S]*?width:\s*40px;[\s\S]*?height:\s*40px;/);
  assert.match(
    mobile,
    /\.home-page \.journey-hero\s*\{[\s\S]*?min-height:\s*auto;[\s\S]*?padding:\s*0 1rem 3\.5rem;/
  );
  assert.match(
    mobile,
    /\.home-page \.journey-hero h1\s*\{[\s\S]*?font-size:\s*clamp\(3\.2rem,\s*14vw,\s*4\.4rem\);/
  );
});

test("faithful homepage hero mask dissolves every illustration edge", () => {
  const css = read("styles/homepage-book.css");
  assert.match(
    css,
    /mask-image:\s*radial-gradient\(ellipse 60% 60% at 50% 50%,\s*#000 68%,\s*transparent 84%\)/
  );
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
