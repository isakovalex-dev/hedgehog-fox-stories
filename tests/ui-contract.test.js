"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const zlib = require("node:zlib");

const projectRoot = path.join(__dirname, "..");

test("approved reference artwork is committed in fallback and modern formats", () => {
  [
    "brand-lockup",
    "map-strip",
    "map-copy-mobile",
    "map-route-mobile",
    "paper-texture"
  ].forEach((asset) => {
    ["png", "webp", "avif"].forEach((extension) => {
      assert.equal(
        fs.existsSync(path.join(projectRoot, `assets/journey/reference/${asset}.${extension}`)),
        true,
        `${asset}.${extension} must exist`
      );
    });
  });
});

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function readPngAlpha(relativePath) {
  const source = fs.readFileSync(path.join(projectRoot, relativePath));
  assert.equal(source.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${relativePath} must be a PNG`);

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const compressedRows = [];

  while (offset < source.length) {
    const length = source.readUInt32BE(offset);
    const type = source.subarray(offset + 4, offset + 8).toString("ascii");
    const data = source.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      compressedRows.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  assert.equal(bitDepth, 8, `${relativePath} must use 8-bit channels`);
  assert.equal(colorType, 6, `${relativePath} must contain native RGBA pixels`);

  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const rows = zlib.inflateSync(Buffer.concat(compressedRows));
  const alpha = new Uint8Array(width * height);
  let previous = Buffer.alloc(stride);
  let sourceOffset = 0;

  function paeth(left, above, upperLeft) {
    const estimate = left + above - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const aboveDistance = Math.abs(estimate - above);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
    if (aboveDistance <= upperLeftDistance) return above;
    return upperLeft;
  }

  for (let y = 0; y < height; y += 1) {
    const filter = rows[sourceOffset];
    sourceOffset += 1;
    const current = Buffer.alloc(stride);

    for (let x = 0; x < stride; x += 1) {
      const raw = rows[sourceOffset + x];
      const left = x >= bytesPerPixel ? current[x - bytesPerPixel] : 0;
      const above = previous[x];
      const upperLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      if (filter === 0) current[x] = raw;
      else if (filter === 1) current[x] = (raw + left) & 255;
      else if (filter === 2) current[x] = (raw + above) & 255;
      else if (filter === 3) current[x] = (raw + Math.floor((left + above) / 2)) & 255;
      else if (filter === 4) current[x] = (raw + paeth(left, above, upperLeft)) & 255;
      else assert.fail(`Unsupported PNG row filter ${filter}`);
    }

    for (let x = 0; x < width; x += 1) {
      alpha[y * width + x] = current[x * bytesPerPixel + 3];
    }
    sourceOffset += stride;
    previous = current;
  }

  return { width, height, alpha };
}

function averageAlpha(image, left, top, right, bottom) {
  let total = 0;
  let count = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      total += image.alpha[y * image.width + x];
      count += 1;
    }
  }
  return total / count;
}

function getBuiltInStories() {
  const context = { window: {} };
  vm.runInNewContext(read("js/storyService.js"), context);
  return context.window.HFStoryService.getBuiltInStories();
}

function readCssColor(source, propertyName) {
  const match = source.match(new RegExp(`${propertyName}:\\s*(#[0-9a-f]{6})`, "i"));
  assert.ok(match, `Missing ${propertyName}`);
  return match[1];
}

function relativeLuminance(hexColor) {
  const channels = hexColor
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => {
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground, background) {
  const luminances = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (left, right) => right - left
  );
  return (luminances[0] + 0.05) / (luminances[1] + 0.05);
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
  const legacyStyles = read("styles.css");
  assert.match(legacyStyles, /\.about-page[\s\S]*aspect-ratio:\s*auto\s*!important/);
  assert.match(legacyStyles, /\.about-page[\s\S]*height:\s*auto/);
  assert.match(legacyStyles, /\.about-page[\s\S]*object-fit:\s*contain/);
});

test("standalone about and legal pages retain their legacy theme", () => {
  const app = read("index.html");
  assert.match(app, /styles\/journey-tokens\.css/);
  assert.match(app, /styles\/journey-theme\.css/);
  assert.match(app, /<body[^>]*class=["'][^"']*journey-theme/);

  ["about.html", "privacy.html", "requisites.html", "terms.html"].forEach((file) => {
    const html = read(file);
    assert.match(html, /styles\.css/);
    assert.match(html, /family=Cormorant\+Garamond/);
    assert.doesNotMatch(html, /styles\/journey-(?:tokens|theme)\.css/);
    assert.doesNotMatch(html, /<body[^>]*class=["'][^"']*journey-theme/);
  });
});

test("homepage loads an isolated faithful book theme", () => {
  const homepage = read("index.html");
  assert.match(homepage, /<body[^>]*class=["'][^"']*\bhome-page\b/);
  assert.match(homepage, /styles\/homepage-book\.css/);

  ["about.html", "privacy.html", "requisites.html", "terms.html", "404.html"].forEach((file) => {
    assert.doesNotMatch(read(file), /styles\/homepage-book\.css/, `${file} must keep the shared theme`);
  });
});

test("homepage route state excludes every internal application route", () => {
  const html = read("index.html");
  const bootstrap = html.match(
    /<script id="homeRouteBootstrap">([\s\S]*?)<\/script>/
  )?.[1];
  assert.ok(bootstrap, "Missing synchronous home-route bootstrap");

  function hasHomeClass(pathname, search = "") {
    const classes = new Set(["journey-theme", "home-page"]);
    const context = {
      URL,
      URLSearchParams,
      document: {
        body: {
          classList: {
            toggle(className, enabled) {
              if (enabled) classes.add(className);
              else classes.delete(className);
            }
          }
        }
      },
      window: {
        location: {
          origin: "https://example.test",
          pathname,
          search
        }
      }
    };

    vm.runInNewContext(bootstrap, context);
    return classes.has("home-page");
  }

  assert.equal(hasHomeClass("/"), true);
  assert.equal(hasHomeClass("/index.html"), true);
  ["/stories", "/create", "/library", "/stories/sea-bench"].forEach((route) => {
    assert.equal(hasHomeClass(route), false, `${route} must not use homepage-book.css`);
  });
  assert.equal(hasHomeClass("/", "?route=%2Fstories%2Fsea-bench"), false);
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
    "assets/journey/reference/brand-lockup.avif",
    "assets/journey/reference/brand-lockup.webp",
    "assets/journey/reference/brand-lockup.png",
    "assets/journey/reference/paper-texture.avif",
    "assets/journey/reference/paper-texture.webp",
    "assets/journey/reference/paper-texture.png",
    "assets/journey/compass.svg",
    "assets/journey/paw-print.svg"
  ];

  requiredAssets.forEach((relativePath) => {
    assert.ok(fs.existsSync(path.join(projectRoot, relativePath)), `Missing ${relativePath}`);
  });
});

test("games clearing uses one paper-edge watercolor while preserving both game routes", () => {
  const html = read("index.html");
  assert.match(html, /assets\/journey\/reference\/games-clearing\.avif/);
  assert.match(html, /assets\/journey\/reference\/games-clearing\.webp/);
  assert.match(html, /assets\/journey\/reference\/games-clearing\.png/);
  assert.match(html, /href=["']\/games\/memory["']/);
  assert.match(html, /href=["']\/games\/endless-flight["']/);
  assert.doesNotMatch(html, /assets\/game\/fox-catcher\.webp/);
});

test("games clearing owns soft transparent edges without hiding the paper airplane", () => {
  const image = readPngAlpha("assets/journey/reference/games-clearing.png");
  const cornerSize = 32;
  const cornerAverages = [
    averageAlpha(image, 0, 0, cornerSize, cornerSize),
    averageAlpha(image, image.width - cornerSize, 0, image.width, cornerSize),
    averageAlpha(image, 0, image.height - cornerSize, cornerSize, image.height),
    averageAlpha(image, image.width - cornerSize, image.height - cornerSize, image.width, image.height)
  ];
  const airplaneAverage = averageAlpha(
    image,
    Math.floor(image.width * 0.64),
    Math.floor(image.height * 0.08),
    Math.ceil(image.width * 0.82),
    Math.ceil(image.height * 0.3)
  );

  cornerAverages.forEach((average) => assert.ok(average < 8, `Corner alpha must be transparent, got ${average}`));
  assert.ok(airplaneAverage > 220, `Paper airplane region must stay materially opaque, got ${airplaneAverage}`);
});

test("games clearing CSS does not depend on a clipping mask", () => {
  const css = read("styles/homepage-book.css");
  const imageRule = css.match(/\.home-page \.games-clearing \.memory-promo__art img\s*\{([\s\S]*?)\}/);
  assert.ok(imageRule, "Missing games clearing image rule");
  assert.doesNotMatch(imageRule[1], /(?:-webkit-)?mask-image|clip-path/);
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
  assert.match(html, /class=["'][^"']*book-brand-lockup/);
  assert.match(html, /class=["'][^"']*book-hero-picture/);
  assert.match(html, /hero-coast-1800\.avif/);
  assert.match(html, /class=["'][^"']*book-route--hero/);
  ["chooseStoryButton", "openGeneratorButton"].forEach((id) => {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  });
});

test("homepage hero sources size AVIF and WebP for the full-width scene", () => {
  const html = read("index.html");
  const expectedSizes = "(max-width: 1500px) 100vw, 1500px";
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

test("homepage hero does not eagerly request the legacy PNG fallback", () => {
  const css = read("styles/homepage-book.css");
  const html = read("index.html");
  const picture = html.match(/<picture class="book-hero-picture">[\s\S]*?<\/picture>/)?.[0] || "";

  assert.doesNotMatch(css, /hero-friends\.png/);
  assert.match(picture, /<source[\s\S]*?type="image\/avif"[\s\S]*?hero-coast-1800\.avif/);
  assert.match(picture, /<source[\s\S]*?type="image\/webp"[\s\S]*?hero-coast-1800\.webp/);
  assert.match(picture, /<img[\s\S]*?src="assets\/journey\/hero-coast-1200\.webp"/);
});

test("faithful homepage hero uses one full-bleed watercolor layer without an oval mask", () => {
  const css = read("styles/homepage-book.css");
  const heroArtwork = css.match(/\.home-page \.journey-hero__art\s*\{([\s\S]*?)\n\}/)?.[1] || "";

  assert.match(
    css,
    /\.home-page \.journey-hero__art\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;/
  );
  assert.match(
    css,
    /\.home-page \.book-hero-picture img\s*\{[\s\S]*?height:\s*100%;[\s\S]*?object-fit:\s*cover;[\s\S]*?object-position:\s*center 46%;/
  );
  assert.doesNotMatch(heroArtwork, /mask-image:\s*radial-gradient/);
});

test("mobile homepage returns the watercolor illustration to document flow", () => {
  const css = read("styles/homepage-book.css");
  const mobile = css.slice(css.lastIndexOf("@media (max-width: 768px)"));

  assert.match(
    mobile,
    /\.home-page \.journey-hero__art\s*\{[\s\S]*?position:\s*relative;[\s\S]*?inset:\s*auto;[\s\S]*?order:\s*-1;[\s\S]*?height:\s*auto;/
  );
  assert.match(
    mobile,
    /\.home-page \.book-hero-picture img\s*\{[\s\S]*?height:\s*auto;[\s\S]*?object-fit:\s*contain;/
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

test("source HTML sends no-JavaScript readers to the static story archive", () => {
  const html = read("index.html");
  const storyList = html.match(/<div class="story-list" id="storyList"[^>]*>([\s\S]*?)<\/div>/)?.[1] || "";
  const storyLinks = [...storyList.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(storyLinks, [
    "/stories-static.html#lost-cloud",
    "/stories-static.html#sea-bench",
    "/stories-static.html#hedgehog-bravery",
    "/stories-static.html#warm-wind-map",
    "/stories-static.html#rustling-grass",
    "/stories-static.html#star-for-friend"
  ]);
  assert.doesNotMatch(storyList, /onclick=|javascript:/i);
});

test("static story archive contains the unchanged readable text of every built-in story", () => {
  const archivePath = path.join(projectRoot, "stories-static.html");
  assert.ok(fs.existsSync(archivePath), "Missing stories-static.html");

  const html = fs.readFileSync(archivePath, "utf8");
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /<a class="skip-link" href="#mainContent">/);
  assert.match(html, /<nav\b[^>]*aria-label=/);

  getBuiltInStories().forEach((story) => {
    const article = html.match(
      new RegExp(`<article[^>]+id="${story.id}"[^>]*>([\\s\\S]*?)<\\/article>`)
    )?.[1];
    assert.ok(article, `Missing readable article for ${story.id}`);
    assert.match(article, new RegExp(`<h2[^>]*>${story.title}</h2>`));
    story.slides.forEach((slide) => {
      assert.ok(article.includes(`<p>${slide}</p>`), `Changed or missing text in ${story.id}`);
    });
  });
});

test("homepage story cards expose book metadata and exact source labels", () => {
  const source = read("js/app.js");
  assert.match(source, /options\.sequence/);
  assert.match(source, /story-card__book-meta/);
  assert.match(source, /story-card__sequence/);
  assert.match(source, /story-card__arrow/);
  assert.match(source, />Моя история</);
  assert.match(source, />История от автора</);
  assert.match(source, /activeRoute === "home"\s*\?\s*\{\s*sequence:\s*index\s*\+\s*1\s*\}/);
  assert.match(read("index.html"), /class=["'][^"']*book-route--stories/);
});

test("SPA route changes synchronize book styling before rendering route content", () => {
  const source = read("js/app.js");
  const theme = read("styles/journey-theme.css");

  assert.match(
    source,
    /function applyRoute[\s\S]*?document\.body\.classList\.toggle\("home-page", route\.name === "home"\)[\s\S]*?if \(route\.name === "story"\)/
  );
  assert.match(
    source,
    /function renderStories[\s\S]*?activeRoute === "home"\s*\?\s*\{\s*sequence:\s*index\s*\+\s*1\s*\}\s*:\s*\{\}/
  );
  assert.match(
    theme,
    /\.journey-theme:not\(\.home-page\)\s+:where\(\.book-brand-picture,\s*\.book-route\)\s*\{[\s\S]*?display:\s*none;/
  );
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

test("homepage uses the approved brand lockup and reference paper", () => {
  const html = read("index.html");
  const css = read("styles/homepage-book.css");

  assert.match(html, /class=["'][^"']*book-brand-lockup/);
  assert.match(html, /assets\/journey\/reference\/brand-lockup\.avif/);
  assert.match(html, /assets\/journey\/reference\/brand-lockup\.webp/);
  assert.match(html, /assets\/journey\/reference\/brand-lockup\.png/);
  assert.match(css, /assets\/journey\/reference\/paper-texture\.avif/);
  assert.doesNotMatch(css, /assets\/journey\/paper-grain\.svg/);
});

test("approved brand lockup stays bounded on client-side application routes", () => {
  const css = read("styles/homepage-book.css");

  assert.match(
    css,
    /\.journey-theme:not\(\.home-page\) \.book-brand-lockup\s*\{[\s\S]*?width:\s*clamp\(180px,\s*18vw,\s*270px\);[\s\S]*?max-width:\s*100%;/
  );
  assert.match(
    css,
    /\.journey-theme:not\(\.home-page\) \.book-brand-lockup img\s*\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*auto;/
  );
});

test("desktop story cards sit below the hero trail instead of covering the painting", () => {
  const css = read("styles/homepage-book.css");
  assert.match(
    css,
    /@media \(min-width: 1101px\) \{[\s\S]*?\.home-page \.stories-section\s*\{[\s\S]*?margin-top:\s*-20px;/
  );
  assert.doesNotMatch(css, /margin-top:\s*-80px;/);
});

test("desktop homepage positions three story cards below the watercolor first screen", () => {
  const css = read("styles/homepage-book.css");
  const desktopStart = css.indexOf("@media (min-width: 1101px)");
  const desktopEnd = css.indexOf("@media", desktopStart + 1);
  const desktop = css.slice(desktopStart, desktopEnd);

  assert.ok(desktopStart >= 0, "Missing desktop-only concept composition");
  assert.match(
    desktop,
    /\.home-page \.journey-hero\s*\{[\s\S]*?min-height:\s*500px;[\s\S]*?padding:\s*clamp\(2rem,\s*5vw,\s*4\.5rem\)\s+clamp\(1\.5rem,\s*5vw,\s*4\.5rem\)\s+5rem;/
  );
  assert.match(
    desktop,
    /\.home-page \.stories-section\s*\{[\s\S]*?z-index:\s*4;[\s\S]*?margin-top:\s*-20px;/
  );
  assert.match(
    desktop,
    /\.home-page \.stories-section \.section-heading,[\s\S]*?\.home-page \.stories-section \.filters\s*\{[\s\S]*?display:\s*none;/
  );
  assert.match(
    desktop,
    /\.home-page \.stories-section \.story-list\s*\{[\s\S]*?grid-auto-columns:\s*calc\(\(100% - 2\.2rem\) \/ 3\);[\s\S]*?grid-auto-flow:\s*column;/
  );
  assert.match(
    desktop,
    /\.home-page \.stories-section \.story-card\s*\{[\s\S]*?height:\s*230px;[\s\S]*?min-height:\s*230px;/
  );
  assert.doesNotMatch(desktop, /(?:transform:\s*scale|zoom:|visibility:\s*hidden)/);
});

test("homepage keeps the collapsed navigation through the narrow desktop boundary", () => {
  const css = read("styles/homepage-book.css");
  const boundaryStart = css.indexOf("@media (min-width: 981px) and (max-width: 1279px)");
  const boundaryEnd = css.indexOf("@media", boundaryStart + 1);
  const boundary = css.slice(boundaryStart, boundaryEnd);

  assert.ok(boundaryStart >= 0, "Missing homepage narrow-desktop navigation boundary");
  assert.match(
    boundary,
    /\.home-page \.nav-menu-button\s*\{[\s\S]*?display:\s*block;[\s\S]*?margin-left:\s*auto;/
  );
  assert.match(
    boundary,
    /\.home-page \.nav-menu\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?display:\s*none;/
  );
  assert.match(boundary, /\.home-page \.nav-menu\.open\s*\{[\s\S]*?display:\s*grid;/);
  assert.match(
    boundary,
    /\.home-page \.nav-link,[\s\S]*?\.home-page \.nav-action\s*\{[\s\S]*?width:\s*100%;/
  );

  const fullNavStart = css.indexOf("@media (min-width: 1280px)");
  const fullNavEnd = css.indexOf("@media", fullNavStart + 1);
  const fullNav = css.slice(fullNavStart, fullNavEnd);
  assert.ok(fullNavStart >= 0, "Missing measured full desktop navigation boundary");
  assert.match(
    fullNav,
    /\.home-page \.nav-menu\s*\{[\s\S]*?gap:\s*clamp\(1\.2rem,\s*3vw,\s*2\.5rem\);/
  );
});

test("shared navigation collapses at 980px while only the homepage extends to 1279px", () => {
  const sharedCss = read("styles.css");
  const homepageCss = read("styles/homepage-book.css");

  assert.match(
    sharedCss,
    /@media \(max-width: 980px\) \{\s*\.site-nav\s*\{[\s\S]*?\.nav-menu-button\s*\{[\s\S]*?display:\s*block;/
  );
  assert.doesNotMatch(
    sharedCss,
    /@media \(max-width: 1100px\) \{\s*\.site-nav\s*\{[\s\S]*?\.nav-menu-button\s*\{/
  );
  assert.match(
    homepageCss,
    /@media \(min-width: 981px\) and \(max-width: 1279px\) \{[\s\S]*?\.home-page \.nav-menu-button\s*\{[\s\S]*?display:\s*block;/
  );
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

test("homepage journey map is the approved static artwork with one real link", () => {
  const html = read("index.html");
  assert.match(html, /id=["']journeyMap["']/);
  assert.match(html, /class=["'][^"']*journey-map__desktop/);
  assert.match(html, /assets\/journey\/reference\/map-strip\.avif/);
  assert.match(html, /assets\/journey\/reference\/map-copy-mobile\.avif/);
  assert.match(html, /assets\/journey\/reference\/map-route-mobile\.avif/);
  assert.match(html, /id=["']journeyMapLink["'][^>]*href=["']\/map["']/);
  assert.equal((html.match(/href=["']\/map["']/g) || []).length, 1);
  ["map-strip", "map-copy-mobile", "map-route-mobile"].forEach((asset) => {
    ["avif", "webp", "png"].forEach((extension) => {
      assert.match(html, new RegExp(`assets/journey/reference/${asset}\\.${extension}`));
    });
  });
  ["journeyPlaces", "journeyKeepsakes", "journeyLandmarks", "journeyRouteStage"].forEach((id) => {
    assert.doesNotMatch(html, new RegExp(`id=["']${id}["']`));
  });

  const section = html.match(/<section[^>]*id=["']journeyMap["'][^>]*>([\s\S]*?)<\/section>/)?.[1] || "";
  assert.equal((section.match(/<(?:a|button|input|select|textarea)\b/g) || []).length, 1);
});

test("map placeholder is built and routed", () => {
  const page = read("map.html");
  const vercel = JSON.parse(read("vercel.json"));
  assert.match(page, /Карта путешествий скоро откроется/);
  assert.match(page, /Мы прокладываем тропинки, расставляем маяки и собираем памятные находки\./);
  assert.match(page, /href=["']\/["']/);
  assert.ok(
    vercel.rewrites.some((rewrite) => rewrite.source === "/map" && rewrite.destination === "/map.html")
  );
});

test("static journey map keeps an unclipped, responsive accessible action", () => {
  const css = read("styles/homepage-book.css");
  const mapRule = css.match(/\.home-page \.journey-map\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  const actionRule = css.match(/\.home-page \.journey-map__link\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  const focusRule = css.match(/\.home-page \.journey-map__link:focus-visible\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  const mobile = css.slice(css.indexOf("@media (max-width: 767px)"));

  assert.match(mapRule, /overflow:\s*visible;/);
  assert.match(css, /\.home-page \.journey-map::before\s*\{\s*display:\s*none;/);
  assert.match(actionRule, /top:\s*64%;/);
  assert.match(actionRule, /min-width:\s*44px;/);
  assert.match(actionRule, /min-height:\s*44px;/);
  assert.match(actionRule, /z-index:\s*1;/);
  assert.match(focusRule, /outline:\s*3px solid var\(--book-rust\);/);
  assert.match(mobile, /\.home-page \.journey-map__desktop\s*\{\s*display:\s*none;/);
  assert.match(mobile, /\.home-page \.journey-map__mobile\s*\{\s*display:\s*grid;/);
});

test("small rust text reaches WCAG AA contrast on every paper surface", () => {
  const tokens = read("styles/journey-tokens.css");
  const homepage = read("styles/homepage-book.css");
  const journeyRust = readCssColor(tokens, "--journey-fox");
  const journeyPaper = readCssColor(tokens, "--journey-paper");
  const bookRust = readCssColor(homepage, "--book-rust");
  const bookPaper = readCssColor(homepage, "--book-paper");
  const bookPaperLight = readCssColor(homepage, "--book-paper-light");

  [
    ["journey rust on journey paper", journeyRust, journeyPaper],
    ["journey rust on homepage paper", journeyRust, bookPaper],
    ["journey rust on light homepage paper", journeyRust, bookPaperLight],
    ["homepage rust on homepage paper", bookRust, bookPaper],
    ["homepage rust on light homepage paper", bookRust, bookPaperLight]
  ].forEach(([label, foreground, background]) => {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${label} must reach 4.5:1, got ${contrastRatio(foreground, background).toFixed(2)}:1`
    );
  });
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

test("homepage book theme keeps compact controls and map action touchable", () => {
  const css = read("styles/homepage-book.css");
  assert.match(
    css,
    /\.home-page \.nav-menu-button,[\s\S]*?\.home-page \.story-card__arrow\s*\{[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;/
  );
  assert.match(css, /\.home-page \.journey-map__link\s*\{[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;/);
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
