import { expect, test } from "@playwright/test";

test("a child can choose a hero, pass an easy trail by keyboard, and see a gentle reward", async ({ page }) => {
  await page.goto("/labyrinth.html", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Выбрать Ежика" }).click();
  await expect(page.getByRole("button", { name: "Выбрать Ежика" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Лёгкая тропинка" }).click();
  await page.getByRole("button", { name: "Отправиться в лабиринт" }).click();
  await expect(page.locator("#labyrinthBoard")).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");

  await expect(page.locator("#labyrinthResult")).toBeVisible();
  await expect(page.locator("#labyrinthResult")).toContainText("Находка найдена");
});

test("the phone layout keeps the four movement buttons visible and tappable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/labyrinth.html", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Отправиться в лабиринт" }).click();

  for (const direction of ["вверх", "влево", "вниз", "вправо"]) {
    const control = page.getByRole("button", { name: `Идти ${direction}` });
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test("keeps a control focused, gives the same hint for wall taps, and focuses the reward", async ({ page }) => {
  await page.goto("/labyrinth.html", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Отправиться в лабиринт" }).click();

  const right = page.getByRole("button", { name: "Идти вправо" });
  await right.focus();
  await right.press("Enter");
  await expect(right).toBeFocused();
  await right.press("Enter");
  await expect(page.locator(".game-counter strong")).toHaveText("2");

  await page.locator('#labyrinthBoard [data-row="0"][data-column="3"]').click();
  await expect(page.locator("#labyrinthStatus")).toHaveText("Там густые кусты. Попробуй другую тропинку.");

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#labyrinthResult")).toBeFocused();
});
