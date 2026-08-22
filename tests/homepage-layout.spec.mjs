import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const viewports = [
  { name: "homepage-1568x1003", width: 1568, height: 1003 },
  { name: "homepage-1440x900", width: 1440, height: 900 },
  { name: "homepage-1024x768", width: 1024, height: 768 },
  { name: "homepage-390x844", width: 390, height: 844 }
];

test.beforeEach(async ({ page }) => {
  await page.route("**/_vercel/insights/script.js", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" })
  );
  await page.addInitScript(() => {
    sessionStorage.setItem("ezhik-intro-seen-v1", "true");
  });
});

test("homepage presents the reference hero, three stories, and the journey map", async ({ page }) => {
  await page.setViewportSize({ width: 1568, height: 1003 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.querySelectorAll(".home-story-list > .story-card").length === 3);
  await page.evaluate(() => window.scrollTo(0, 0));

  await expect(page.locator("header.home-header")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Добрые истории\s*для тихих вечеров/);
  await expect(page.locator(".home-story-list > .story-card")).toHaveCount(3);
  await expect(page.locator("#travel-map")).toBeVisible();
});

test("homepage header uses the transparent logo artwork", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });

  const logo = page.locator(".home-header .nav-brand img");
  await expect(logo).toHaveAttribute("src", "assets/logo-mark-transparent-400.png");
  await expect(logo).toHaveCSS("mix-blend-mode", "normal");
});

test("featured home story shows its source and an interactive like", async ({ page }) => {
  await page.setViewportSize({ width: 1568, height: 1003 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelectorAll(".home-story-list > .story-card").length === 3);

  const firstStory = page.locator(".home-story-list > .story-card").first();
  const like = firstStory.locator("[data-like]");

  await expect(firstStory.getByText("История от автора")).toBeVisible();
  await expect(like).toHaveAttribute("aria-pressed", "false");

  await like.click();

  await expect(firstStory.locator("[data-like]")).toHaveAttribute("aria-pressed", "true");
});

test("featured home cards use the title of the story they open", async ({ page }) => {
  const featuredStories = [
    { id: "sea-bench", title: "Скамейка на краю моря" },
    { id: "lost-cloud", title: "Облако, которое заблудилось" },
    { id: "warm-wind-map", title: "Лисёнок и карта тёплого ветра" },
  ];

  await page.setViewportSize({ width: 1440, height: 900 });

  for (const story of featuredStories) {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelectorAll(".home-story-list > .story-card").length === 3);
    await expect(page.locator(`[data-story-card="${story.id}"] h3`)).toHaveText(story.title);

    await page.goto(`/?route=/stories/${story.id}`, { waitUntil: "networkidle" });
    await expect(page.locator("#readerTitle")).toHaveText(story.title);
  }
});

test("homepage loads compact image variants for the hero and featured stories", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelectorAll(".home-story-list > .story-card").length === 3);
  await page.waitForFunction(() => {
    const images = document.querySelectorAll(".hero-illustration, .home-story-art img");
    return Array.from(images).every((image) => image.complete && image.naturalWidth > 0);
  });

  const loadedSources = await page.locator(".hero-illustration, .home-story-art img").evaluateAll((images) =>
    images.map((image) => image.currentSrc)
  );

  expect(loadedSources[0]).toContain("assets/optimized/hero-seaside-bench-1200.jpg");
  loadedSources.slice(1).forEach((source) => expect(source).toMatch(/assets\/optimized\/.+-480\.avif$/));
});

test("homepage defers illustrations in the story creator below the fold", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });

  const loadingModes = await page
    .locator(".create-page-background, .create-age-choice img")
    .evaluateAll((images) => images.map((image) => image.getAttribute("loading")));

  expect(loadingModes).toEqual(["lazy", "lazy", "lazy", "lazy"]);
});

test("homepage does not preload media in the hidden generation dialog", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });

  const loadingModes = await page
    .locator("#generationOverlay img")
    .evaluateAll((images) => images.map((image) => image.getAttribute("loading")));

  expect(loadingModes).toEqual(["lazy", "lazy"]);
});

test("journey map and games use the illustrated reference presentation", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.goto("/", { waitUntil: "networkidle" });

  const journeyMap = page.locator("#travel-map");
  const games = page.locator("#memoryPromo");

  await expect(journeyMap.locator(".journey-map__desktop img")).toBeVisible();
  const gamesArtwork = games.locator(".memory-promo__art img");
  await expect(gamesArtwork).toBeVisible();
  await page.waitForFunction(() => {
    const image = document.querySelector("#memoryPromo .memory-promo__art img");
    return image?.complete && image.naturalWidth > 0;
  });
  expect(await gamesArtwork.evaluate((image) => image.currentSrc)).toMatch(
    /assets\/optimized\/games-clearing-fox-plane-1200\.jpg$/
  );
  await expect(games.locator(".game-pass")).toHaveCount(2);
  await expect(games.getByRole("link", { name: /Мемори/ })).toHaveAttribute("href", "/games/memory");
  await expect(games.getByRole("link", { name: /Бесконечный полёт/ })).toHaveAttribute("href", "/endless-flight.html");

  const gamesPresentation = await games.evaluate((section) => {
    const bounds = section.getBoundingClientRect();
    return { boxShadow: getComputedStyle(section).boxShadow, height: bounds.height, width: bounds.width };
  });
  expect(gamesPresentation.width).toBeLessThanOrEqual(1500);
  expect(gamesPresentation.height).toBeCloseTo(545, 0);
  expect(gamesPresentation.boxShadow).toBe("none");
});

test("featured stories start 50 pixels below the hero", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelectorAll(".home-story-list > .story-card").length === 3);

  const gap = await page.evaluate(() => {
    const hero = document.querySelector(".home-route .hero");
    const firstStory = document.querySelector(".home-story-list > .story-card");

    if (!hero || !firstStory) {
      throw new Error("Hero or featured story card was not found");
    }

    return firstStory.getBoundingClientRect().top - hero.getBoundingClientRect().bottom;
  });

  expect(gap).toBeCloseTo(50, 0);
});

test("mobile featured story keeps its opening arrow inside the card", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelectorAll(".home-story-list > .story-card").length === 3);

  const arrowFits = await page.locator(".home-story-list > .story-card").first().evaluate((card) => {
    const arrow = card.querySelector(".home-story-arrow");
    const cardBounds = card.getBoundingClientRect();
    const arrowBounds = arrow.getBoundingClientRect();

    return arrowBounds.bottom <= cardBounds.bottom;
  });

  expect(arrowFits).toBe(true);
});

test("story route hides home-only games and pricing sections", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?route=/stories/sea-bench", { waitUntil: "networkidle" });

  await expect(page).toHaveURL(/\/stories\/sea-bench$/);
  await expect(page.locator("#reader")).toBeVisible();
  await expect(page.locator("#readerTitle")).toHaveText("Скамейка на краю моря");
  await expect(page.locator("#memoryPromo")).toBeHidden();
  await expect(page.locator("#pricing")).toBeHidden();
});

test("about page keeps landscape sketches in their original proportions", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/about.html", { waitUntil: "networkidle" });

  const sketches = page.locator(".note-sketch, .draft-image");
  await expect(sketches).toHaveCount(5);

  for (let index = 0; index < 5; index += 1) {
    const sketch = sketches.nth(index);
    await sketch.scrollIntoViewIfNeeded();
    await expect(sketch).toHaveJSProperty("naturalWidth", 1448);
    await expect(sketch).toHaveJSProperty("naturalHeight", 1086);
  }

  const ratios = await sketches.evaluateAll((images) =>
    images.map((image) => {
      const bounds = image.getBoundingClientRect();
      return bounds.height / bounds.width;
    })
  );

  ratios.forEach((ratio) => expect(ratio).toBeCloseTo(0.75, 1));
});

test("about page shows complete portrait sketches without cropping", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/about.html", { waitUntil: "networkidle" });

  const sketches = await page.locator(".sketch-thumb img, .future-sketch img").evaluateAll((images) =>
    images.map((image) => getComputedStyle(image).objectFit)
  );

  expect(sketches).toHaveLength(4);
  sketches.forEach((fit) => expect(fit).toBe("contain"));
});

for (const viewport of viewports) {
  test(`homepage screenshot: ${viewport.name}`, async ({ page }) => {
    await mkdir("artifacts", { recursive: true });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.querySelectorAll(".home-story-list > .story-card").length === 3);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `artifacts/${viewport.name}.png`, fullPage: false });
  });
}
