import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const engine = require("../js/labyrinth-engine.js");

const GRID_STEPS = {
  up: { row: -1, column: 0, key: "ArrowUp" },
  down: { row: 1, column: 0, key: "ArrowDown" },
  left: { row: 0, column: -1, key: "ArrowLeft" },
  right: { row: 0, column: 1, key: "ArrowRight" }
};

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

async function tapGridCellCenter(page, row, column) {
  const cell = page.locator(`#labyrinthBoard [data-row="${row}"][data-column="${column}"]`);
  const box = await cell.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click((box?.x || 0) + (box?.width || 0) / 2, (box?.y || 0) + (box?.height || 0) / 2);
}

async function collectEasyTicket(page) {
  await walk(page, EASY_TO_TICKET);
  await expect(page.getByRole("dialog", { name: "Билетик развилки" })).toBeVisible();
  await page.getByRole("button", { name: "Взять билетик" }).click();
}

function markerPosition(map, marker) {
  for (let row = 0; row < map.length; row += 1) {
    const column = map[row].indexOf(marker);
    if (column !== -1) return { row, column };
  }
  throw new Error(`Missing ${marker}`);
}

function endlessRoute(level) {
  const start = markerPosition(level.map, "S");
  const goal = markerPosition(level.map, "G");
  const queue = [{ position: start, directions: [] }];
  const seen = new Set([`${start.row}:${start.column}`]);

  while (queue.length) {
    const current = queue.shift();
    if (current.position.row === goal.row && current.position.column === goal.column) return current.directions;

    for (const [direction, step] of Object.entries(GRID_STEPS)) {
      const position = { row: current.position.row + step.row, column: current.position.column + step.column };
      const key = `${position.row}:${position.column}`;
      const tile = level.map[position.row]?.[position.column];
      if (!tile || tile === "#" || seen.has(key)) continue;
      seen.add(key);
      queue.push({ position, directions: [...current.directions, direction] });
    }
  }

  throw new Error(`No route through ${level.id}`);
}

function routePosition(level, directions, stepCount) {
  let position = markerPosition(level.map, "S");
  for (const direction of directions.slice(0, stepCount)) {
    const step = GRID_STEPS[direction];
    position = { row: position.row + step.row, column: position.column + step.column };
  }
  return position;
}

async function chooseEndlessTrail(page, heroId = "hedgehog") {
  await page.goto("/labyrinth.html", { waitUntil: "networkidle" });
  await page.locator(`button[data-hero-choice="${heroId}"]`).click();
  await page.locator("[data-endless-choice]").click();
  await expect(page.locator("[data-endless-choice]")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Начать путешествие" }).click();
}

async function solveEndlessEntry(page, chapter) {
  const level = engine.createEndlessLevel(chapter);
  const entry = level.encounters.find((encounter) => encounter.kind === "puzzle");
  await expect(page.getByRole("dialog", { name: "Записка у входа" })).toBeVisible();
  await page.locator(`[data-answer="${entry.correctAnswer}"]`).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  return level;
}

async function completeEndlessChapter(page, chapter) {
  await chooseEndlessTrail(page);
  const level = await solveEndlessEntry(page, chapter);
  const directions = endlessRoute(level);
  const ticket = level.encounters.find((encounter) => encounter.kind === "ticket");

  for (let index = 0; index < directions.length; index += 1) {
    await page.keyboard.press(GRID_STEPS[directions[index]].key);
    const position = routePosition(level, directions, index + 1);
    if (position.row === ticket.row && position.column === ticket.column) {
      await expect(page.getByRole("dialog", { name: "Билетик развилки" })).toBeVisible();
      await page.locator("[data-encounter-continue]").click();
    }
  }

  await expect(page.locator('[data-screen="treasure"]')).toBeVisible();
  await page.getByRole("button", { name: "Дальше" }).click();
  await expect(page.locator('[data-screen="complete"]')).toBeVisible();
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

test("renders one native sand-road link for every playable cardinal map link", async ({ page }) => {
  for (const levelId of ["easy", "medium", "hard"]) {
    await openTrail(page, "hedgehog", levelId);

    const expectedEdges = (await page.locator("#labyrinthBoard [data-row]").evaluateAll((nodes) => {
      const positions = new Set(nodes.map((node) => `${node.dataset.row}:${node.dataset.column}`));
      return nodes.flatMap((node) => {
        const row = Number(node.dataset.row);
        const column = Number(node.dataset.column);
        return [[row, column + 1], [row + 1, column]]
          .filter(([nextRow, nextColumn]) => positions.has(`${nextRow}:${nextColumn}`))
          .map(([nextRow, nextColumn]) => `${row}:${column}->${nextRow}:${nextColumn}`);
      });
    })).sort();
    const actualEdges = (await page.locator("[data-route-edge]").evaluateAll((nodes) => nodes.map((node) => node.dataset.routeEdge))).sort();

    expect(actualEdges).toEqual(expectedEdges);
    await expect(page.locator("svg[data-route-grid]")).toBeVisible();
  }
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
  await tapGridCellCenter(page, 9, 3);
  await expect(page.locator("[data-move-count]")).toHaveText("1");
});

test("maps a physical phone tap to the adjacent route cell instead of the hero overlay", async ({ page }) => {
  const journeys = [
    { levelId: "easy", answer: "1", row: 8, column: 1 },
    { levelId: "medium", answer: "0", row: 10, column: 1 },
    { levelId: "hard", answer: "1", row: 12, column: 1 }
  ];

  await page.setViewportSize({ width: 375, height: 812 });
  for (const journey of journeys) {
    await openTrail(page, "hedgehog", journey.levelId);
    await solveEntry(page, journey.answer);
    await tapGridCellCenter(page, journey.row, journey.column);
    await expect(page.locator("[data-move-count]")).toHaveText("1");
  }
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

  await expect(page.locator("#labyrinthBoard")).toHaveAttribute("data-art", "assets/labyrinth/storybook/forest-start-background-v3.png");
  await expect(page.locator("[data-map-art]")).toHaveAttribute("src", /forest-start-background-v3\.png/);
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
  await expect(finalHero).toHaveClass(/is-yielding-tap/);
  await tapGridCellCenter(page, 1, 13);
  await expect(page.locator('[data-screen="treasure"]')).toBeVisible();
});

test("opens the hard treasure from a physical phone tap at the final cell", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openTrail(page, "fox", "hard");
  await solveEntry(page, "1");
  await walk(page, HARD_TO_TICKET);
  await page.getByRole("button", { name: "Запомнить подсказку" }).click();
  await walk(page, HARD_TO_BESIDE_GOAL_AFTER_TICKET);

  await tapGridCellCenter(page, 1, 13);
  await expect(page.locator('[data-screen="treasure"]')).toBeVisible();
});

test("shows a recovery screen when a required map asset cannot load", async ({ page }) => {
  await page.route("**/assets/labyrinth/storybook/forest-start-background-v3.png", (route) => route.abort());
  await chooseTrail(page, "hedgehog", "easy");

  await expect(page.getByRole("heading", { name: "Не удалось открыть карту" })).toBeVisible();
  await page.getByRole("button", { name: "К уровням" }).click();
  await expect(page.locator('[data-screen="level"]')).toHaveAttribute("data-level", "easy");
});

test("starts the endless journey from a book-style fourth choice", async ({ page }) => {
  await chooseEndlessTrail(page);

  await expect(page.locator('[data-screen="play"]')).toHaveAttribute("data-mode", "endless");
  await expect(page.locator('[data-endless-chapter]')).toHaveText("1");
  await expect(page.locator("svg[data-route-grid='endless-1']")).toBeVisible();
});

test("continues from an endless treasure into the next generated chapter", async ({ page }) => {
  await completeEndlessChapter(page, 1);

  await expect(page.getByRole("heading", { name: "Глава 1 пройдена!" })).toBeVisible();
  await page.getByRole("button", { name: "Следующая глава" }).click();
  await expect(page.locator('[data-screen="play"]')).toHaveAttribute("data-level", "endless-2");
  await expect(page.locator('[data-screen="play"]')).toHaveAttribute("data-mode", "endless");
  await expect(page.locator('[data-endless-chapter]')).toHaveText("2");
});

test("recovers from corrupted endless progress without changing classic progress", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("hedgehogFoxLabyrinthProgress", JSON.stringify(["easy"]));
    window.localStorage.setItem("hedgehogFoxLabyrinthEndlessProgress", "{this is not json");
  });
  await page.goto("/labyrinth.html", { waitUntil: "networkidle" });
  await page.locator('[data-hero-choice="hedgehog"]').click();

  await expect(page.locator('[data-level-choice="easy"] .level-choice__done')).toHaveText("Пройден");
  await expect(page.locator("[data-endless-best]")).toBeVisible();
  await page.locator("[data-endless-choice]").click();
  await expect(page.getByRole("button", { name: "Начать путешествие" })).toBeVisible();
  await expect(page.evaluate(() => window.localStorage.getItem("hedgehogFoxLabyrinthProgress"))).resolves.toBe(JSON.stringify(["easy"]));
});

test("keeps endless card and physical phone controls usable on 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await chooseEndlessTrail(page);
  const level = await solveEndlessEntry(page, 1);
  const directions = endlessRoute(level);
  const firstPosition = routePosition(level, directions, 1);

  await tapGridCellCenter(page, firstPosition.row, firstPosition.column);
  await expect(page.locator("[data-move-count]")).toHaveText("1");

  const heroCell = page.locator('#labyrinthBoard [data-current="true"]');
  const box = await heroCell.boundingBox();
  const startX = (box?.x || 0) + (box?.width || 0) / 2;
  const startY = (box?.y || 0) + (box?.height || 0) / 2;
  const nextStep = GRID_STEPS[directions[1]];
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: startX, y: startY, id: 1, radiusX: 1, radiusY: 1, force: 1 }]
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: startX + nextStep.column * 90, y: startY + nextStep.row * 90, id: 1, radiusX: 1, radiusY: 1, force: 1 }]
  });
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  await expect(page.locator("[data-move-count]")).toHaveText("2");
});

test("returns to a classic level without retaining the endless dynamic map", async ({ page }) => {
  await page.goto("/labyrinth.html", { waitUntil: "networkidle" });
  await page.locator('[data-hero-choice="fox"]').click();
  await page.locator("[data-endless-choice]").click();
  await page.locator('[data-level-choice="easy"]').click();
  await page.getByRole("button", { name: "Начать путь" }).click();

  await expect(page.locator('[data-screen="play"]')).toHaveAttribute("data-mode", "classic");
  await expect(page.locator('[data-screen="play"]')).toHaveAttribute("data-level", "easy");
  await expect(page.locator("svg[data-route-grid='easy']")).toBeVisible();
  await expect(page.locator("svg[data-route-grid='endless-1']")).toHaveCount(0);
});
