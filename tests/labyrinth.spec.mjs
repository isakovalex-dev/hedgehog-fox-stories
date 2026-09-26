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
