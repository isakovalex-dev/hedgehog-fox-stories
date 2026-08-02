import { test, expect } from "@playwright/test";

test("endless flight menu displays the supplied heroes biplane artwork", async ({ page }) => {
  await page.goto("/endless-flight.html", { waitUntil: "networkidle" });

  const menuPlane = page.locator(".menu-plane");

  await expect(menuPlane).toBeVisible();
  await expect(menuPlane).toHaveAttribute("src", "/public/assets/endless-flight/plane-heroes-menu.png");
  await expect(menuPlane).toHaveJSProperty("complete", true);
  expect(await menuPlane.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
});
