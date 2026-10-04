import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/_vercel/insights/script.js", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" })
  );
});

test("flight starts and its pause and speed controls respond", async ({ page }) => {
  await page.goto("/flight.html", { waitUntil: "networkidle" });

  await expect(page.locator("#fallback")).toBeHidden();
  await expect(page.locator("#scene canvas")).toBeVisible();

  await page.getByRole("button", { name: "Отправиться в полёт" }).click();
  await expect(page.locator("#startScreen")).toHaveClass(/started/);

  await page.getByLabel("Скорость полёта").press("End");
  await expect(page.locator("#speedText")).toHaveText("бодрая");

  await page.getByRole("button", { name: "Пауза" }).click();
  await expect(page.locator("body")).toHaveClass(/paused/);
  await expect(page.getByRole("button", { name: "Пауза" })).toHaveText("▶");

  await page.keyboard.press("p");
  await expect(page.locator("body")).not.toHaveClass(/paused/);
});

test("forest catcher opens help and stores the chosen difficulty", async ({ page }) => {
  await page.goto("/forest-catcher.html", { waitUntil: "networkidle" });

  await expect(page.locator("#fcLoadingScreen")).toHaveClass(/is-hidden/);
  await page.getByRole("button", { name: "Обычный" }).click();
  await expect(page.getByRole("button", { name: "Обычный" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Как играть" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Лови лесные дары");

  await page.getByRole("button", { name: "Понятно" }).click();
  await expect(page.getByRole("button", { name: "Начать игру" })).toBeFocused();
});

test("forest catcher starts, pauses, and resumes a game", async ({ page }) => {
  await page.goto("/forest-catcher.html", { waitUntil: "networkidle" });

  await expect(page.locator("#fcLoadingScreen")).toHaveClass(/is-hidden/);
  await page.getByRole("button", { name: "Начать игру" }).click();
  await expect(page.locator("#fcMenuScreen")).toHaveClass(/is-hidden/);
  await expect(page.locator("#fcHud")).not.toHaveClass(/is-hidden/);
  await expect(page.locator("#forestCatcherCanvas")).toBeFocused();

  await page.keyboard.press("Space");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Пауза");

  await page.getByRole("button", { name: "Продолжить" }).click();
  await expect(page.locator("#fcPauseScreen")).toHaveClass(/is-hidden/);
  await expect(page.locator("#forestCatcherCanvas")).toBeFocused();
});
