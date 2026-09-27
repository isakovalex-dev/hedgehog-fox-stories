import { expect, test } from "@playwright/test";

async function openTrail(page, heroId, levelId) {
  await page.goto("/labyrinth.html", { waitUntil: "networkidle" });
  await page.locator(`button[data-hero-choice="${heroId}"]`).click();
  await expect(page.locator('[data-screen="level"]')).toHaveAttribute("data-hero", heroId);
  await page.locator(`button[data-level-choice="${levelId}"]`).click();
  await page.getByRole("button", { name: "Начать путь" }).click();
  await expect(page.locator('[data-screen="play"]')).toHaveAttribute("data-level", levelId);
}

async function solveEasyEntry(page, answer = "1") {
  await expect(page.getByRole("dialog", { name: "Записка у входа" })).toBeVisible();
  await page.locator(`[data-answer="${answer}"]`).click();
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

  const pauseBox = await page.getByRole("button", { name: "Пауза" }).boundingBox();
  expect(pauseBox?.width).toBeGreaterThanOrEqual(44);
  expect(pauseBox?.height).toBeGreaterThanOrEqual(44);
});

test("renders storybook playfield and keeps phone controls in viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openTrail(page, "hedgehog", "easy");

  await expect(page.locator("#labyrinthBoard")).toHaveAttribute("data-art", "assets/labyrinth/storybook/forest-trail.png");
  await expect(page.locator(".labyrinth-game-hud")).toBeVisible();
  await expect(page.locator(".labyrinth-heart-counter")).toHaveAttribute("data-lives", "3");
  await expect(page.locator(".labyrinth-findings-counter")).toContainText("0/3");

  const viewport = page.viewportSize();
  const required = [
    page.getByRole("dialog", { name: "Записка у входа" }),
    page.getByRole("button", { name: "Идти вверх" }),
    page.getByRole("button", { name: "Идти влево" }),
    page.getByRole("button", { name: "Идти вниз" }),
    page.getByRole("button", { name: "Идти вправо" })
  ];

  for (const locator of required) {
    await expect(locator).toBeVisible();
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x || 0) + (box?.width || 0)).toBeLessThanOrEqual(viewport.width);
    expect(box?.y).toBeGreaterThanOrEqual(0);
    expect((box?.y || 0) + (box?.height || 0)).toBeLessThanOrEqual(viewport.height);
  }

  const heroBox = await page.locator('#labyrinthBoard [data-current="true"]').boundingBox();
  const helpBox = await page.locator(".labyrinth-map-help").boundingBox();
  expect(heroBox).not.toBeNull();
  expect(helpBox).not.toBeNull();
  const helperCoversHero = (heroBox?.x || 0) < (helpBox?.x || 0) + (helpBox?.width || 0)
    && (heroBox?.x || 0) + (heroBox?.width || 0) > (helpBox?.x || 0)
    && (heroBox?.y || 0) < (helpBox?.y || 0) + (helpBox?.height || 0)
    && (heroBox?.y || 0) + (heroBox?.height || 0) > (helpBox?.y || 0);
  expect(helperCoversHero).toBe(false);
});

test("places every playable marker on an authored illustrated trail", async ({ page }) => {
  await openTrail(page, "hedgehog", "medium");
  await solveEasyEntry(page, "0");

  const markers = page.locator("#labyrinthBoard [data-row]");
  await expect(markers).toHaveCount(23);
  const allMarkersUseTrailCoordinates = await markers.evaluateAll((nodes) => nodes.every((node) => (
    node.hasAttribute("data-path-x")
      && node.hasAttribute("data-path-y")
      && node.getAttribute("style")?.includes("--path-x")
      && node.getAttribute("style")?.includes("--path-y")
  )));
  expect(allMarkersUseTrailCoordinates).toBe(true);

  const hero = page.locator('#labyrinthBoard [data-current="true"]');
  await expect(hero).toHaveAttribute("data-path-x", "12");
  await expect(hero).toHaveAttribute("data-path-y", "84");

  await page.keyboard.press("ArrowDown");
  await expect(page.locator('#labyrinthBoard [data-current="true"]')).toHaveAttribute("data-path-x", "17");
  await expect(page.locator('#labyrinthBoard [data-current="true"]')).toHaveAttribute("data-path-y", "78");
});

test("keeps the hard treasure hidden until the final illustrated approach", async ({ page }) => {
  await openTrail(page, "fox", "hard");
  await solveEasyEntry(page, "1");

  const finalRoute = page.locator('#labyrinthBoard [data-row][data-column="9"]');
  const points = await finalRoute.evaluateAll((nodes) => nodes.map((node) => ({
    x: Number(node.getAttribute("data-path-x")),
    y: Number(node.getAttribute("data-path-y"))
  })));
  expect(points).toHaveLength(7);
  expect(new Set(points.map((point) => `${point.x}:${point.y}`)).size).toBe(7);
  expect(points[0].y).toBeGreaterThan(24);
  expect(points.at(-1)).toEqual({ x: 90, y: 12 });
  expect(points.every((point, index) => index === 0 || (
    point.x > points[index - 1].x && point.y < points[index - 1].y
  ))).toBe(true);

  for (const key of [
    ...Array(4).fill("ArrowDown"),
    ...Array(4).fill("ArrowRight")
  ]) await page.keyboard.press(key);
  await expect(page.getByRole("dialog", { name: "Билетик с компасом" })).toBeVisible();
  await page.getByRole("button", { name: "Запомнить подсказку" }).click();

  for (const key of [
    ...Array(2).fill("ArrowDown"),
    ...Array(2).fill("ArrowRight"),
    ...Array(4).fill("ArrowUp"),
    ...Array(4).fill("ArrowLeft"),
    ...Array(2).fill("ArrowUp"),
    ...Array(6).fill("ArrowRight"),
    ...Array(5).fill("ArrowDown")
  ]) await page.keyboard.press(key);

  const goal = page.locator('#labyrinthBoard [data-row="7"][data-column="9"]');
  const finalHero = page.locator('#labyrinthBoard [data-current="true"]');
  await expect(goal).toHaveAttribute("data-fogged", "true");
  await expect(goal).toHaveClass(/is-goal-veiled/);
  await expect(goal).toHaveCSS("pointer-events", "auto");
  await expect(finalHero).toHaveClass(/is-yielding-tap/);
  await goal.click();
  await expect(page.locator('[data-screen="treasure"]')).toBeVisible();
});
