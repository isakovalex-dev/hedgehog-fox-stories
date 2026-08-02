import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/_vercel/insights/script.js", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" })
  );
});

async function openFirstVisit(page, { hour = 12, viewport = { width: 1366, height: 768 }, reducedMotion = false } = {}) {
  await page.setViewportSize(viewport);

  if (reducedMotion) {
    await page.emulateMedia({ reducedMotion: "reduce" });
  }

  await page.addInitScript((introHour) => {
    const NativeDate = Date;
    window.__introTestHour = introHour;

    class IntroTestDate extends NativeDate {
      constructor(...argumentsList) {
        super(
          ...(argumentsList.length === 0
            ? [new NativeDate(2026, 7, 2, window.__introTestHour, 0)]
            : argumentsList)
        );
      }

      static now() {
        return new NativeDate(2026, 7, 2, window.__introTestHour, 0).getTime();
      }
    }

    window.Date = IntroTestDate;
  }, hour);
  await page.goto("/", { waitUntil: "networkidle" });
}

test("intro uses a single desktop day media set and closes without changing the URL", async ({ page }) => {
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await openFirstVisit(page);

  const overlay = page.locator(".intro-splash");
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute("data-theme", "day");
  await expect(overlay).toHaveAttribute("data-layout", "desktop");
  await expect(overlay.locator("source")).toHaveCount(2);
  await expect(overlay.locator('source[type="video/webm"]')).toHaveAttribute(
    "src",
    "/assets/intro/intro-day-desktop.webm"
  );
  await expect(overlay.locator('source[type="video/mp4"]')).toHaveAttribute(
    "src",
    "/assets/intro/intro-day-desktop.mp4"
  );
  await expect(overlay.locator(".intro-poster")).toHaveAttribute(
    "src",
    "/assets/intro/intro-day-desktop-poster.webp"
  );

  await overlay.getByRole("button", { name: /Добро пожаловать в мир приключений/i }).click();
  await expect(overlay).toBeHidden({ timeout: 1_500 });
  await expect(page).toHaveURL("/");
  await expect(page.locator("#mainContent")).toBeFocused();

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".intro-splash")).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});

test("intro uses the mobile night poster instead of video when reduced motion is requested", async ({ page }) => {
  await openFirstVisit(page, {
    hour: 20,
    viewport: { width: 390, height: 844 },
    reducedMotion: true
  });

  const overlay = page.locator(".intro-splash");
  await expect(overlay).toHaveAttribute("data-theme", "night");
  await expect(overlay).toHaveAttribute("data-layout", "mobile");
  await expect(overlay.locator("video")).toHaveCount(0);
  await expect(overlay.locator(".intro-poster")).toHaveAttribute(
    "src",
    "/assets/intro/intro-night-mobile-poster.webp"
  );
});

test("Escape closes the intro and restores access to the main page", async ({ page }) => {
  await openFirstVisit(page, { hour: 20 });
  await expect(page.locator(".intro-splash")).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.locator(".intro-splash")).toBeHidden({ timeout: 1_500 });
  await expect(page.locator("#mainContent")).toBeFocused();
});

test("intro keeps its initial theme when the viewport changes after a time boundary", async ({ page }) => {
  await openFirstVisit(page, { hour: 19 });
  const overlay = page.locator(".intro-splash");

  await expect(overlay).toHaveAttribute("data-theme", "day");
  await page.evaluate(() => {
    window.__introTestHour = 20;
  });
  await page.setViewportSize({ width: 1280, height: 720 });

  await expect(overlay).toHaveAttribute("data-theme", "day");
});

test("intro displays its focus treatment only after keyboard navigation", async ({ page }) => {
  await openFirstVisit(page);
  const overlay = page.locator(".intro-splash");

  await expect(overlay).not.toHaveClass(/is-keyboard-navigation/);
  await page.keyboard.press("Tab");

  await expect(overlay).toHaveClass(/is-keyboard-navigation/);
  await expect(page.locator(".intro-hit-button")).toBeFocused();
});
