import { expect, test } from "@playwright/test";

async function openTrail(page, heroId, levelId) {
  await page.goto("/labyrinth.html", { waitUntil: "networkidle" });
  await page.locator(`button[data-hero-choice="${heroId}"]`).click();
  await expect(page.locator('[data-screen="level"]')).toHaveAttribute("data-hero", heroId);
  await page.locator(`button[data-level-choice="${levelId}"]`).click();
  await page.getByRole("button", { name: "Начать путь" }).click();
  await expect(page.locator('[data-screen="play"]')).toHaveAttribute("data-level", levelId);
}

async function solveEasyEntry(page) {
  await expect(page.getByRole("dialog", { name: "Записка у входа" })).toBeVisible();
  await page.locator('[data-answer="1"]').click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function collectEasyTicket(page) {
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog", { name: "Призовой билетик" })).toBeVisible();
  await page.getByRole("button", { name: "Положить билетик в кармашек" }).click();
}

test("selects either hero and opens each named storybook trail", async ({ page }) => {
  const journeys = [
    ["hedgehog", "easy", "Лесная тропинка"],
    ["fox", "medium", "Долина ручьёв"],
    ["hedgehog", "hard", "Горный перевал"]
  ];

  for (const [heroId, levelId, title] of journeys) {
    await openTrail(page, heroId, levelId);
    const playfield = page.locator('[data-screen="play"]');
    await expect(playfield).toHaveAttribute("data-hero", heroId);
    await expect(playfield.getByRole("heading", { name: title })).toBeVisible();
  }
});

test("shows a foggy entry map with three hearts and spends one heart for a wrong answer", async ({ page }) => {
  await openTrail(page, "hedgehog", "easy");
  const playfield = page.locator('[data-screen="play"]');

  await expect(playfield).toHaveAttribute("data-lives", "3");
  await expect(playfield).toHaveAttribute("data-finding-count", "0");
  await expect(page.locator('#labyrinthBoard [data-row="1"][data-column="5"]')).toHaveAttribute("data-fogged", "true");
  await page.locator('[data-answer="0"]').click();

  await expect(playfield).toHaveAttribute("data-lives", "2");
  await expect(playfield).toHaveAttribute("data-finding-count", "0");
  await expect(page.locator("[data-move-count]")).toHaveText("0");
  await expect(page.getByRole("dialog", { name: "Записка у входа" })).toBeVisible();
});

test("blocks map actions and keeps Tab inside an open finding dialog", async ({ page }) => {
  await openTrail(page, "fox", "easy");

  await page.locator('[data-action="back-level"]').evaluate((button) => button.click());
  await expect(page.getByRole("dialog", { name: "Записка у входа" })).toBeVisible();
  await expect(page.locator(".labyrinth-playfield")).toHaveAttribute("inert", "");

  await page.locator('[data-answer="2"]').focus();
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-answer="0"]')).toBeFocused();
});

test("collects entry, branch, and chest as exactly three findings before the completion screen", async ({ page }) => {
  await openTrail(page, "hedgehog", "easy");
  await solveEasyEntry(page);
  await expect(page.locator('[data-screen="play"]')).toHaveAttribute("data-finding-count", "1");
  await collectEasyTicket(page);
  await expect(page.locator('[data-screen="play"]')).toHaveAttribute("data-finding-count", "2");

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-screen="treasure"]')).toHaveAttribute("data-finding-count", "3");
  await expect(page.getByRole("dialog", { name: "Сундучок лесных секретов" })).toBeVisible();
  await page.getByRole("button", { name: "Дальше" }).click();

  await expect(page.locator('[data-screen="complete"]')).toBeVisible();
  await expect(page.locator('[data-stars="3"]')).toBeVisible();
  await expect(page.locator("[data-complete-findings]")).toHaveText("3/3");
});

test("shows a pause guide without resetting the journey", async ({ page }) => {
  await openTrail(page, "fox", "easy");
  await solveEasyEntry(page);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-move-count]")).toHaveText("1");

  await page.getByRole("button", { name: "Пауза" }).click();
  await expect(page.getByRole("dialog", { name: "Как управлять героем?" })).toBeVisible();
  await page.getByRole("button", { name: "Продолжить путь" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-move-count]")).toHaveText("1");
});

test("supports a real touch swipe and suppresses the following map click", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openTrail(page, "hedgehog", "easy");
  await solveEasyEntry(page);

  const heroCell = page.locator('#labyrinthBoard [data-current="true"]');
  const box = await heroCell.boundingBox();
  const startX = (box?.x || 0) + (box?.width || 0) / 2;
  const startY = (box?.y || 0) + (box?.height || 0) / 2;
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: startX, y: startY, id: 1, radiusX: 1, radiusY: 1, force: 1 }]
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: startX + 90, y: startY + 4, id: 1, radiusX: 1, radiusY: 1, force: 1 }]
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: []
  });

  await expect(page.locator("[data-move-count]")).toHaveText("1");
  await page.locator('#labyrinthBoard [data-row="1"][data-column="2"]').click();
  await expect(page.locator("[data-move-count]")).toHaveText("1");
});

test("keeps four sufficiently large direction buttons tappable on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openTrail(page, "hedgehog", "easy");
  await solveEasyEntry(page);

  for (const direction of ["вверх", "влево", "вниз", "вправо"]) {
    const control = page.getByRole("button", { name: `Идти ${direction}` });
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});
