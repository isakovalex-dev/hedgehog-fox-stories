import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const screenshotDirectory = "artifacts/intro";

async function openIntro(page, { hour, viewport, reducedMotion = false, failVideo = false }) {
  await page.setViewportSize(viewport);
  await page.route("**/_vercel/insights/script.js", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" })
  );

  if (failVideo) {
    await page.route("**/assets/intro/*.webm", (route) => route.abort());
    await page.route("**/assets/intro/*.mp4", (route) => route.abort());
  }

  if (reducedMotion) {
    await page.emulateMedia({ reducedMotion: "reduce" });
  }

  await page.addInitScript((introHour) => {
    const NativeDate = Date;

    class IntroTestDate extends NativeDate {
      constructor(...argumentsList) {
        super(...(argumentsList.length === 0 ? [new NativeDate(2026, 7, 2, introHour, 0)] : argumentsList));
      }

      static now() {
        return new NativeDate(2026, 7, 2, introHour, 0).getTime();
      }
    }

    window.Date = IntroTestDate;
  }, hour);

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".intro-splash")).toBeVisible();
}

const scenarios = [
  {
    filename: "desktop-day-1920x1080.png",
    hour: 12,
    viewport: { width: 1920, height: 1080 }
  },
  {
    filename: "desktop-night-1920x1080.png",
    hour: 20,
    viewport: { width: 1920, height: 1080 }
  },
  {
    filename: "desktop-night-button-focus.png",
    hour: 20,
    viewport: { width: 1920, height: 1080 },
    focusButton: true
  },
  {
    filename: "mobile-day-390x844.png",
    hour: 12,
    viewport: { width: 390, height: 844 }
  },
  {
    filename: "mobile-night-390x844.png",
    hour: 20,
    viewport: { width: 390, height: 844 }
  },
  {
    filename: "mobile-night-button-focus.png",
    hour: 20,
    viewport: { width: 390, height: 844 },
    focusButton: true
  },
  {
    filename: "reduced-motion-desktop.png",
    hour: 12,
    viewport: { width: 1920, height: 1080 },
    reducedMotion: true
  },
  {
    filename: "video-error-poster-fallback.png",
    hour: 20,
    viewport: { width: 1920, height: 1080 },
    failVideo: true
  }
];

for (const scenario of scenarios) {
  test(`intro screenshot: ${scenario.filename}`, async ({ page }) => {
    await mkdir(screenshotDirectory, { recursive: true });
    await openIntro(page, scenario);

    if (scenario.focusButton) {
      await page.keyboard.press("Tab");
      await expect(page.locator(".intro-hit-button")).toBeFocused();
    }

    if (scenario.failVideo) {
      await page.locator(".intro-video").evaluate((video) => {
        video.dispatchEvent(new Event("error"));
      });
      await expect(page.locator(".intro-video")).toHaveClass(/is-unavailable/);
    }

    await page.screenshot({ path: `${screenshotDirectory}/${scenario.filename}`, fullPage: false });
  });
}
