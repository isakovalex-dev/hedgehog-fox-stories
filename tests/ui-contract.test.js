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

test("homepage hero sources size AVIF and WebP for the actual one-column breakpoint", () => {
  const html = read("index.html");
  const expectedSizes = "(max-width: 768px) 100vw, (max-width: 1100px) 58vw, 900px";
  const sourceTags = [...html.matchAll(/<source\b[\s\S]*?\/>/g)].map((match) => match[0]);

  ["avif", "webp"].forEach((format) => {
    const source = sourceTags.find(
      (tag) => tag.includes(`type="image/${format}"`) && tag.includes(`hero-coast-480.${format}`)
    );
    assert.ok(source, `Missing ${format.toUpperCase()} hero source`);
    assert.match(source, new RegExp(`sizes=["']${expectedSizes.replace(/[().]/g, "\\$&")}["']`));
    ["480", "768", "1200", "1800"].forEach((width) => {
      assert.match(source, new RegExp(`hero-coast-${width}\\.${format}\\s+${width}w`));
    });
  });
});

test("faithful homepage hero keeps desktop and mobile geometry safeguards", () => {
  const css = read("styles/homepage-book.css");
  assert.match(
    css,
    /grid-template-columns:\s*minmax\(540px,\s*1fr\)\s+minmax\(500px,\s*1fr\)/
  );
  assert.match(css, /font-size:\s*clamp\(4\.25rem,\s*5\.5vw,\s*5\.5rem\)/);

  const tabletStart = css.indexOf("@media (min-width: 721px) and (max-width: 1100px)");
  const mobileStart = css.indexOf("@media (max-width: 720px)");
  const tablet = css.slice(tabletStart, mobileStart);
  assert.ok(tabletStart >= 0, "Missing faithful tablet breakpoint");
  assert.match(
    tablet,
    /\.home-page \.journey-hero\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/
  );
  assert.match(tablet, /\.home-page \.journey-hero__copy\s*\{[\s\S]*?min-width:\s*0;/);
  assert.match(
    tablet,
    /\.home-page \.journey-hero__art\s*\{[\s\S]*?width:\s*100%;[\s\S]*?margin-left:\s*0;/
  );
  assert.match(
    tablet,
    /\.home-page \.journey-hero h1\s*\{[\s\S]*?font-size:\s*clamp\(2\.75rem,\s*5\.2vw,\s*4\.5rem\);/
  );

  const mobile = css.slice(css.indexOf("@media (max-width: 720px)"));
  assert.match(
    mobile,
    /\.home-page \.site-nav\s*\{[\s\S]*?flex-direction:\s*row;[\s\S]*?flex-wrap:\s*nowrap;/
  );
  assert.match(
    mobile,
    /\.home-page \.nav-brand\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-width:\s*0;[\s\S]*?font-size:\s*1\.25rem;/
  );
  assert.match(mobile, /\.home-page \.brand-leaf\s*\{[\s\S]*?display:\s*none;/);
  assert.match(mobile, /\.home-page \.book-brand-mark\s*\{[\s\S]*?width:\s*36px;[\s\S]*?height:\s*36px;/);
  assert.match(
    mobile,
    /\.home-page \.nav-menu-button\s*\{[\s\S]*?flex:\s*0 0 42px;[\s\S]*?margin-left:\s*0;/
  );
  assert.match(
    mobile,
    /\.home-page \.journey-hero\s*\{[\s\S]*?min-height:\s*auto;[\s\S]*?padding:\s*0 1rem 3\.5rem;/
  );
  assert.match(
    mobile,
    /\.home-page \.journey-hero h1\s*\{[\s\S]*?font-size:\s*clamp\(2\.75rem,\s*11\.8vw,\s*3\.25rem\);/
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

test("homepage story cards expose book metadata and exact source labels", () => {
  const source = read("js/app.js");
  assert.match(source, /options\.sequence/);
  assert.match(source, /story-card__book-meta/);
  assert.match(source, /story-card__sequence/);
  assert.match(source, /story-card__arrow/);
  assert.match(source, />Моя история</);
  assert.match(source, />История от автора</);
  assert.match(source, /renderStoryCard\(story,\s*\{\s*sequence:\s*index\s*\+\s*1\s*\}\)/);
  assert.match(read("index.html"), /class=["'][^"']*book-route--stories/);
});

test("homepage story cards use horizontal scrolling at tablet widths", () => {
  const css = read("styles/homepage-book.css");
  const tabletStart = css.indexOf("@media (min-width: 721px) and (max-width: 1100px)");
  const mobileStart = css.indexOf("@media (max-width: 720px)");
  const tablet = css.slice(tabletStart, mobileStart);

  assert.ok(tabletStart >= 0, "Missing homepage tablet breakpoint");
  assert.match(
    tablet,
    /\.home-page \.stories-section \.story-list\s*\{[\s\S]*?display:\s*flex;[\s\S]*?overflow-x:\s*auto;[\s\S]*?scroll-snap-type:\s*x mandatory;/
  );
  assert.match(
    tablet,
    /\.home-page \.stories-section \.story-card\s*\{[\s\S]*?flex:\s*0 0 min\(86vw,\s*650px\);[\s\S]*?scroll-snap-align:\s*start;/
  );
});

test("homepage source row reserves visible space for the source label and like action", () => {
  const css = read("styles/homepage-book.css");

  assert.match(
    css,
    /\.home-page \.story-card__source-row\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/
  );
  assert.match(
    css,
    /\.home-page \.stories-section \.story-source-badge\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?padding:\s*0;/
  );
});

test("desktop homepage keeps the concept sequence in one 1000px composition", () => {
  const css = read("styles/homepage-book.css");
  const desktopStart = css.indexOf("@media (min-width: 1101px)");
  const desktopEnd = css.indexOf("@media", desktopStart + 1);
  const desktop = css.slice(desktopStart, desktopEnd);

  assert.ok(desktopStart >= 0, "Missing desktop-only concept composition");
  assert.match(
    desktop,
    /\.home-page \.journey-hero\s*\{[\s\S]*?min-height:\s*425px;[\s\S]*?padding:\s*1rem clamp\(1\.5rem,\s*5vw,\s*4\.5rem\) 2rem;/
  );
  assert.match(
    desktop,
    /\.home-page \.journey-hero__art\s*\{[\s\S]*?width:\s*88%;[\s\S]*?margin-left:\s*0;/
  );
  assert.match(
    desktop,
    /\.home-page \.stories-section\s*\{[\s\S]*?padding-top:\s*0\.25rem;[\s\S]*?padding-bottom:\s*1\.25rem;/
  );
  assert.match(
    desktop,
    /\.home-page \.stories-section \.story-list\s*\{[\s\S]*?grid-auto-columns:\s*calc\(\(100% - 2\.2rem\) \/ 3\);[\s\S]*?grid-auto-flow:\s*column;[\s\S]*?grid-template-columns:\s*none;[\s\S]*?overflow-x:\s*auto;/
  );
  assert.match(
    desktop,
    /\.home-page \.stories-section \.story-card\s*\{[\s\S]*?height:\s*230px;[\s\S]*?min-height:\s*230px;/
  );
  assert.match(
    desktop,
    /\.home-page \.journey-map\s*\{[\s\S]*?margin:\s*-2rem auto clamp\(4rem,\s*7vw,\s*7rem\);/
  );
  assert.doesNotMatch(desktop, /(?:transform:\s*scale|zoom:|display:\s*none|visibility:\s*hidden)/);
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

test("homepage journey map exposes watercolor landmarks and live position", () => {
  const html = read("index.html");
  const source = read("js/app.js");
  ["journeyLandmarks", "journeyCurrentHeroes"].forEach((id) => {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  });
  assert.match(html, /class=["'][^"']*journey-map__compass/);
  assert.match(source, /--journey-progress/);
  assert.match(source, /discoveredStoryIds/);
});

test("journey route keeps paws and the live heroes marker in one decorative stage", () => {
  const html = read("index.html");
  const source = read("js/app.js");

  assert.match(html, /id=["']journeyRouteStage["']/);
  assert.match(html, /class=["'][^"']*journey-map__route-path--landscape/);
  assert.match(html, /class=["'][^"']*journey-map__route-path--vertical/);
  assert.equal((html.match(/class=["'][^"']*journey-route__paw/g) || []).length, 4);
  assert.match(source, /--journey-progress-landscape/);
  assert.match(source, /--journey-progress-vertical/);
});

test("journey heroes calibrate their painted baseline instead of the image box", () => {
  const css = read("styles/homepage-book.css");

  assert.match(css, /--journey-heroes-baseline-landscape:\s*-66\.2%;/);
  assert.match(css, /--journey-heroes-baseline-vertical:\s*-66\.2%;/);
  assert.match(
    css,
    /\.home-page \.journey-current-heroes\s*\{[\s\S]*?transform:\s*translate\(-50%,\s*var\(--journey-heroes-baseline\)\);/
  );
  assert.match(
    css,
    /@media \(max-width: 980px\) \{[\s\S]*?--journey-heroes-baseline:\s*var\(--journey-heroes-baseline-vertical\);/
  );
});

test("homepage journey map switches to an unclipped one-column vertical trail", () => {
  const css = read("styles/homepage-book.css");
  const responsiveStart = css.indexOf("@media (max-width: 980px)");
  const responsiveEnd = css.indexOf("@media (min-width: 721px)", responsiveStart);
  const responsive = css.slice(responsiveStart, responsiveEnd);

  assert.match(
    responsive,
    /\.home-page \.journey-map\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/
  );
  assert.match(
    responsive,
    /\.home-page \.journey-route-stage,[\s\S]*?\.home-page \.journey-places\s*\{[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*2;[\s\S]*?min-width:\s*0;/
  );
  assert.match(
    responsive,
    /\.home-page \.journey-keepsakes\s*\{[\s\S]*?grid-row:\s*3;/
  );
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

test("homepage book layout preserves and restyles lower-section functionality", () => {
  const html = read("index.html");
  const css = read("styles/homepage-book.css");
  ["games", "why-read", "pricing", "about"].forEach((id) => {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  });
  assert.match(html, /href=["']\/games\/memory["']/);
  assert.match(html, /href=["']\/games\/endless-flight["']/);
  assert.match(html, /data-start-checkout/);
  assert.match(html, /href=["']about\.html["']/);
  assert.match(
    css,
    /\.home-page\s+\.games-clearing,\s*\.home-page\s+\.reading-values,\s*\.home-page\s+\.pricing-section\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-top:\s*1px solid var\(--book-line\);[\s\S]*?border-bottom:\s*1px solid var\(--book-line\);[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;/
  );
  assert.doesNotMatch(css, /\.home-page\s+:where\(\.games-clearing,\s*\.reading-values,\s*\.pricing-section\)/);
  assert.match(css, /\.home-page\s+\.game-pass/);
  assert.match(css, /\.home-page\s+\.pricing-card/);
});

test("homepage book theme defines responsive and reduced-motion fallbacks", () => {
  const css = read("styles/homepage-book.css");
  ["1100px", "768px", "520px"].forEach((breakpoint) => {
    assert.match(css, new RegExp(`@media\\s*\\(max-width:\\s*${breakpoint.replace(".", "\\.")}\\)`));
  });
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /scroll-snap-type/);
});

test("homepage book theme keeps compact controls touchable and map copy contained", () => {
  const css = read("styles/homepage-book.css");
  assert.match(
    css,
    /\.home-page \.nav-menu-button,[\s\S]*?\.home-page \.story-card__arrow\s*\{[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;/
  );
  assert.match(
    css,
    /\.home-page \.journey-map__intro h2\s*\{[\s\S]*?font-size:\s*clamp\(2\.5rem,\s*3vw,\s*3\.25rem\);/
  );
  assert.match(
    css,
    /\.home-page \.story-title-link\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center;[\s\S]*?min-height:\s*44px;/
  );

  const tablet = css.slice(css.indexOf("@media (max-width: 768px)"), css.indexOf("@media (max-width: 520px)"));
  assert.match(tablet, /\.home-page \.site-nav\s*\{[\s\S]*?flex-direction:\s*row;[\s\S]*?flex-wrap:\s*nowrap;/);
  assert.match(
    tablet,
    /\.home-page \.games-clearing__grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/
  );
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
