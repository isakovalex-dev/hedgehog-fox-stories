import { expect, test } from "@playwright/test";

const EASY_TO_TICKET = [
  "ArrowUp", "ArrowUp",
  "ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight",
  "ArrowUp", "ArrowUp", "ArrowUp", "ArrowUp"
];
const EASY_TO_GOAL_AFTER_TICKET = ["ArrowRight", "ArrowRight", "ArrowUp", "ArrowUp"];
const HARD_TO_TICKET = [
  "ArrowUp", "ArrowUp", "ArrowRight", "ArrowRight",
  "ArrowUp", "ArrowUp", "ArrowUp", "ArrowUp",
  "ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight"
];
const HARD_TO_BESIDE_GOAL_AFTER_TICKET = [
  "ArrowRight", "ArrowRight",
  "ArrowDown", "ArrowDown", "ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight",
  "ArrowUp", "ArrowUp", "ArrowUp", "ArrowUp", "ArrowLeft", "ArrowLeft",
  "ArrowUp", "ArrowUp", "ArrowRight", "ArrowRight", "ArrowUp"
];

async function chooseTrail(page, heroId, levelId) {
  await page.goto("/labyrinth.html", { waitUntil: "networkidle" });
  await page.locator(`button[data-hero-choice="${heroId}"]`).click();
  await expect(page.locator('[data-screen="level"]')).toHaveAttribute("data-hero", heroId);
  await page.locator(`button[data-level-choice="${levelId}"]`).click();
  await page.getByRole("button", { name: "Начать путь" }).click();
}

async function openTrail(page, heroId, levelId) {
  await chooseTrail(page, heroId, levelId);
  await expect(page.locator('[data-screen="play"]')).toHaveAttribute("data-level", levelId);
}

async function solveEntry(page, answer = "1") {
  await expect(page.getByRole("dialog", { name: "Записка у входа" })).toBeVisible();
  await page.locator(`[data-answer="${answer}"]`).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function walk(page, keys) {
  for (const key of keys) await page.keyboard.press(key);
}

async function collectEasyTicket(page) {
  await walk(page, EASY_TO_TICKET);
  await expect(page.getByRole("dialog", { name: "Билетик развилки" })).toBeVisible();
  await page.getByRole("button", { name: "Взять билетик" }).click();
}

test("selects either hero and opens each named orthogonal labyrinth", async ({ page }) => {
  const journeys = [
    ["hedgehog", "easy", "Лесной старт"],
    ["fox", "medium", "Таинственный лес"],
    ["hedgehog", "hard", "Горная пещера"]
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
  await expect(playfield).toHaveAttribute("data-hint-count", "0");
  await expect(playfield).not.toHaveAttribute("data-finding-count", /.+/);
  await expect(page.locator('#labyrinthBoard [data-row="1"][data-column="9"]')).toHaveAttribute("data-fogged", "true");
  await page.locator('[data-answer="0"]').click();

  await expect(playfield).toHaveAttribute("data-lives", "2");
  await expect(playfield).toHaveAttribute("data-hint-count", "0");
  await expect(page.locator("[data-move-count]")).toHaveText("0");
  await expect(page.getByRole("dialog", { name: "Записка у входа" })).toBeVisible();
});

test("blocks map actions and keeps Tab inside an open hint dialog", async ({ page }) => {
  await openTrail(page, "fox", "easy");

  await page.locator('[data-action="back-level"]').evaluate((button) => button.click());
  await expect(page.getByRole("dialog", { name: "Записка у входа" })).toBeVisible();
  await expect(page.locator(".labyrinth-playfield")).toHaveAttribute("inert", "");

  await page.locator('[data-answer="2"]').focus();
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-answer="0"]')).toBeFocused();
});

test("uses one uniform orthogonal grid for every playable marker", async ({ page }) => {
  await openTrail(page, "hedgehog", "easy");
  const start = page.locator('#labyrinthBoard [data-row="9"][data-column="1"]');
  const east = page.locator('#labyrinthBoard [data-row="9"][data-column="2"]');
  const north = page.locator('#labyrinthBoard [data-row="8"][data-column="1"]');

  const points = await Promise.all([start, east, north].map(async (locator) => ({
    x: Number(await locator.getAttribute("data-grid-x")),
    y: Number(await locator.getAttribute("data-grid-y")),
    hasLegacyX: await locator.getAttribute("data-path-x"),
    hasLegacyY: await locator.getAttribute("data-path-y")
  })));
  const [startPoint, eastPoint, northPoint] = points;

  expect(startPoint).toMatchObject({ x: 18, y: 83.6, hasLegacyX: null, hasLegacyY: null });
  expect(eastPoint.x - startPoint.x).toBeCloseTo(8, 3);
  expect(eastPoint.y).toBeCloseTo(startPoint.y, 3);
  expect(northPoint.x).toBeCloseTo(startPoint.x, 3);
  expect(startPoint.y - northPoint.y).toBeCloseTo(8.4, 3);

  const allMarkersUseGrid = await page.locator("#labyrinthBoard [data-row]").evaluateAll((nodes) => nodes.every((node) => (
    node.hasAttribute("data-grid-x")
      && node.hasAttribute("data-grid-y")
      && node.getAttribute("style")?.includes("--grid-x")
      && node.getAttribute("style")?.includes("--grid-y")
      && !node.hasAttribute("data-path-x")
      && !node.hasAttribute("data-path-y")
  )));
  expect(allMarkersUseGrid).toBe(true);
});

test("counts hints on the route but reveals the only prize in the final chest", async ({ page }) => {
  await openTrail(page, "hedgehog", "easy");
  await solveEntry(page);
  await expect(page.locator('[data-screen="play"]')).toHaveAttribute("data-hint-count", "1");
  await expect(page.locator("[data-finding-count]")).toHaveCount(0);

  await collectEasyTicket(page);
  await expect(page.locator('[data-screen="play"]')).toHaveAttribute("data-hint-count", "2");
  await expect(page.locator(".labyrinth-treasure-count")).toHaveCount(0);

  await walk(page, EASY_TO_GOAL_AFTER_TICKET);
  await expect(page.locator('[data-screen="treasure"]')).toHaveAttribute("data-hint-count", "2");
  await expect(page.getByRole("dialog", { name: "Сундучок лесных секретов" })).toBeVisible();
  await expect(page.locator(".labyrinth-treasure-count")).toHaveCount(0);
  await page.getByRole("button", { name: "Дальше" }).click();

  await expect(page.locator('[data-screen="complete"]')).toBeVisible();
  await expect(page.locator('[data-stars="3"]')).toBeVisible();
  await expect(page.locator("[data-complete-prize]")).toHaveText("Сундучок лесных секретов");
});

test("shows a pause guide without resetting the journey", async ({ page }) => {
  await openTrail(page, "fox", "easy");
  await solveEntry(page);
  await page.keyboard.press("ArrowUp");
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
  await solveEntry(page);

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
  await page.locator('#labyrinthBoard [data-row="9"][data-column="3"]').click();
  await expect(page.locator("[data-move-count]")).toHaveText("1");
});

test("keeps four sufficiently large direction buttons tappable on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openTrail(page, "hedgehog", "easy");
  await solveEntry(page);

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

test("renders the new map art and keeps phone controls in viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openTrail(page, "hedgehog", "easy");

  await expect(page.locator("#labyrinthBoard")).toHaveAttribute("data-art", "assets/labyrinth/storybook/forest-start-maze-v2.png");
  await expect(page.locator("[data-map-art]")).toHaveAttribute("src", /forest-start-maze-v2\.png/);
  await expect(page.locator(".labyrinth-game-hud")).toBeVisible();
  await expect(page.locator(".labyrinth-heart-counter")).toHaveAttribute("data-lives", "3");
  await expect(page.locator(".labyrinth-hints-counter")).toContainText("0/2");

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
});

test("keeps the hard treasure hidden until the final orthogonal approach", async ({ page }) => {
  await openTrail(page, "fox", "hard");
  await solveEntry(page, "1");

  await walk(page, HARD_TO_TICKET);
  await expect(page.getByRole("dialog", { name: "Билетик с компасом" })).toBeVisible();
  await page.getByRole("button", { name: "Запомнить подсказку" }).click();
  await walk(page, HARD_TO_BESIDE_GOAL_AFTER_TICKET);

  const goal = page.locator('#labyrinthBoard [data-row="1"][data-column="13"]');
  const finalHero = page.locator('#labyrinthBoard [data-current="true"]');
  await expect(goal).toHaveAttribute("data-fogged", "true");
  await expect(goal).toHaveClass(/is-goal-veiled/);
  await expect(goal).toHaveCSS("pointer-events", "auto");
  await expect(finalHero).toHaveClass(/is-yielding-tap/);
  await goal.click();
  await expect(page.locator('[data-screen="treasure"]')).toBeVisible();
});

test("shows a recovery screen when a required map asset cannot load", async ({ page }) => {
  await page.route("**/assets/labyrinth/storybook/forest-start-maze-v2.png", (route) => route.abort());
  await chooseTrail(page, "hedgehog", "easy");

  await expect(page.getByRole("heading", { name: "Не удалось открыть карту" })).toBeVisible();
  await page.getByRole("button", { name: "К уровням" }).click();
  await expect(page.locator('[data-screen="level"]')).toHaveAttribute("data-level", "easy");
});
