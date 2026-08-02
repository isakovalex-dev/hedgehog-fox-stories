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

test("journey map and games use the illustrated reference presentation", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.goto("/", { waitUntil: "networkidle" });

  const journeyMap = page.locator("#travel-map");
  const games = page.locator("#memoryPromo");

  await expect(journeyMap.locator(".journey-map__desktop img")).toBeVisible();
  const gamesArtwork = games.locator(".memory-promo__art img");
  await expect(gamesArtwork).toBeVisible();
  await expect(gamesArtwork).toHaveAttribute(
    "src",
    "assets/journey/reference/games-clearing-fox-plane.png"
  );
  await expect(games.locator(".game-pass")).toHaveCount(2);
  await expect(games.getByRole("link", { name: /Мемори/ })).toHaveAttribute("href", "/games/memory");
  await expect(games.getByRole("link", { name: /Бесконечный полёт/ })).toHaveAttribute("href", "/endless-flight.html");

  const gamesPresentation = await games.evaluate((section) => {
    const bounds = section.getBoundingClientRect();
    return { boxShadow: getComputedStyle(section).boxShadow, height: bounds.height, width: bounds.width };
  });
  expect(gamesPresentation.width).toBeLessThanOrEqual(1500);
  expect(gamesPresentation.height).toBeLessThanOrEqual(750);
  expect(gamesPresentation.boxShadow).toBe("none");
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
