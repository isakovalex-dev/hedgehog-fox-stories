import { expect, test } from "@playwright/test";

async function openEasyTrail(page) {
  await page.goto("/labyrinth.html", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Лёгкая тропинка" }).click();
  await page.getByRole("button", { name: "Открыть карту" }).click();
  await expect(page.locator("#labyrinthBoard")).toBeVisible();
}

async function solveEntryEncounter(page) {
  await expect(page.getByRole("dialog", { name: "Находка у входа" })).toBeVisible();
  await page.getByRole("button", { name: "3" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function collectEasyTicket(page) {
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog", { name: "Призовой билетик" })).toBeVisible();
  await expect(page.locator("#labyrinthBoard")).toBeVisible();
  await page.getByRole("button", { name: "Положить билетик в кармашек" }).click();
}

test("opens the entry puzzle over a foggy illustrated map and keeps it in place", async ({ page }) => {
  await openEasyTrail(page);

  await expect(page.getByRole("dialog", { name: "Находка у входа" })).toContainText("Сколько находок в корзинке?");
  await expect(page.locator('#labyrinthBoard [data-row="1"][data-column="5"]')).toHaveAttribute("data-fogged", "true");
  await expect(page.locator('#labyrinthBoard [data-row="1"][data-column="5"] .goal-token')).toHaveCount(0);

  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".game-counter strong")).toHaveText("0");
  await solveEntryEncounter(page);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".game-counter strong")).toHaveText("1");
  await expect(page.locator('#labyrinthBoard [data-row="1"][data-column="3"]')).toHaveAttribute("data-fogged", "false");
});

test("shows a branch ticket as a modal and reveals the final finding only after the goal", async ({ page }) => {
  await openEasyTrail(page);
  await solveEntryEncounter(page);
  await collectEasyTicket(page);

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");

  await expect(page.locator("#labyrinthResult")).toBeVisible();
  await expect(page.locator("#labyrinthResult")).toContainText("Письмо с добрыми словами");
  await expect(page.locator("#labyrinthBoard [data-row=\"1\"][data-column=\"5\"] .goal-token")).toBeVisible();
});

test("the phone layout keeps the four movement buttons visible and tappable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openEasyTrail(page);
  await solveEntryEncounter(page);

  for (const direction of ["вверх", "влево", "вниз", "вправо"]) {
    const control = page.getByRole("button", { name: `Идти ${direction}` });
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test("a finger swipe moves the hero exactly once without a duplicate map click", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openEasyTrail(page);
  await solveEntryEncounter(page);

  const board = page.locator("#labyrinthBoard");
  const box = await board.boundingBox();
  const startX = (box?.x || 0) + 90;
  const startY = (box?.y || 0) + 90;
  await board.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: startX, clientY: startY });
  await board.dispatchEvent("pointerup", { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: startX + 90, clientY: startY + 4 });

  await expect(page.locator(".game-counter strong")).toHaveText("1");
  await page.locator('#labyrinthBoard [data-row="1"][data-column="2"]').click();
  await expect(page.locator(".game-counter strong")).toHaveText("1");
});

test("keeps a control focused, gives the same hint for wall taps, and focuses the reward", async ({ page }) => {
  await openEasyTrail(page);
  await solveEntryEncounter(page);

  const right = page.getByRole("button", { name: "Идти вправо" });
  await right.focus();
  await right.press("Enter");
  await expect(right).toBeFocused();
  await right.press("Enter");
  await expect(page.getByRole("dialog", { name: "Призовой билетик" })).toBeVisible();
  await page.getByRole("button", { name: "Положить билетик в кармашек" }).click();
  await expect(right).toBeFocused();

  await page.locator('#labyrinthBoard [data-row="0"][data-column="3"]').click();
  await expect(page.locator("#labyrinthStatus")).toHaveText("Там густые кусты. Попробуй другую тропинку.");

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#labyrinthResult")).toBeFocused();
});
