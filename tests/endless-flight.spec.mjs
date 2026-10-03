import { test, expect } from "@playwright/test";

test("endless flight menu is usable before large game assets finish loading", async ({ page }) => {
  let releaseAssets;
  let notifyAssetRequest;
  const assetsMayContinue = new Promise((resolve) => {
    releaseAssets = resolve;
  });
  const assetRequestStarted = new Promise((resolve) => {
    notifyAssetRequest = resolve;
  });

  await page.route("**/assets/endless-flight/**", async (route) => {
    notifyAssetRequest();
    await assetsMayContinue;
    await route.continue();
  });

  await page.goto("/endless-flight.html", { waitUntil: "domcontentloaded" });
  await assetRequestStarted;

  try {
    await expect(page.locator("#menuScreen")).toHaveClass(/visible/);
    await expect(page.getByRole("button", { name: "Играть" })).toBeVisible();
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
