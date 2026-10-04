import { test, expect } from "@playwright/test";

test("endless flight menu is usable before large game assets finish loading", async ({ page }) => {
  const deferredAssetNames = new Set([
    "background-watercolor.png",
    "obstacle-bird.png",
    "obstacle-balloon.png",
    "obstacle-cloud.png"
  ]);
  let releaseAssets;
  const assetsMayContinue = new Promise((resolve) => {
    releaseAssets = resolve;
  });

  await page.route("**/assets/endless-flight/**", async (route) => {
    const assetName = new URL(route.request().url()).pathname.split("/").pop();
    if (!deferredAssetNames.has(assetName)) {
      await route.continue();
      return;
    }
    await assetsMayContinue;
    await route.continue();
  });

  try {
    await page.goto("/endless-flight.html", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#menuScreen")).toHaveClass(/visible/);
    await expect(page.locator("#loadingScreen")).toHaveClass(/hidden/, { timeout: 15_000 });
    const playButton = page.getByRole("button", { name: "Играть" });
    await expect(playButton).toBeVisible();
    await playButton.click();
    await expect(page.locator("body")).toHaveAttribute("data-game-state", "PLAYING");
    await expect(page.locator("#hud")).toHaveClass(/visible/);
  } finally {
    releaseAssets();
  }
});

test("endless flight menu displays the supplied heroes biplane artwork", async ({ page }) => {
  await page.goto("/endless-flight.html", { waitUntil: "networkidle" });

  const menuPlane = page.locator(".menu-plane");

  await expect(menuPlane).toBeVisible();
  await expect(menuPlane).toHaveAttribute("src", "/assets/endless-flight/plane-heroes-menu.png");
  await expect(menuPlane).toHaveJSProperty("complete", true);
  expect(await menuPlane.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
});
