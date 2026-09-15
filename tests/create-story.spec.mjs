import { expect, test } from "@playwright/test";

const TEST_SUPABASE_URL = "https://supabase.e2e.test";

test.beforeEach(async ({ page }) => {
  await page.route("**/create", (route) => route.fulfill({ path: "dist/index.html" }));
  await page.route(`${TEST_SUPABASE_URL}/**`, (route) =>
    route.fulfill({ contentType: "application/json", body: "[]" })
  );
  await page.route("**/auth/v1/user", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ id: "test-user" }) })
  );
  await page.route("**/_vercel/insights/script.js", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" })
  );
  await page.route("**/api/auth/session-cookie", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) })
  );
  await page.route("**/api/admin/analytics?view=access", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: { allowed: false } }) })
  );
  await page.route("**/api/analytics/events", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) })
  );
  await page.addInitScript(() => {
    sessionStorage.setItem("ezhik-intro-seen-v1", "true");
    localStorage.setItem(
      "hedgehogFoxSupabaseSession",
      JSON.stringify({
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: "test-user" }
      })
    );
  });
});

test("create form sends selected values and opens the ready story", async ({ page }) => {
  await page.route(new RegExp(`${TEST_SUPABASE_URL}/rest/v1/stories\\?.*`), async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "story-7",
          title: "Проверка",
          age_group: "7-8",
          mood: "bedtime",
          lesson: "Помогать друзьям",
          illustrations_enabled: false
        }
      ])
    });
  });
  await page.route(new RegExp(`${TEST_SUPABASE_URL}/rest/v1/story_pages\\?.*`), (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          page_number: 1,
          text: "Текст",
          scene_tag: "forest_day",
          image_prompt: "Кадр",
          image_status: null
        }
      ])
    })
  );
  await page.route("**/api/generate-story", async (route) => {
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({ ageGroup: "7-8", mood: "bedtime", pageCount: 7 });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        story: {
          id: "story-7",
          title: "Проверка",
          ageGroup: "7-8",
          pages: [
            {
              pageNumber: 1,
              text: "Текст",
              sceneTag: "forest_day",
              imagePrompt: "Кадр"
            }
          ]
        },
        meta: { mode: "mock" }
      })
    });
  });

  await page.goto("/create");
  await page.waitForFunction(() => window.HFSupabaseService?.isAuthenticated?.());
  await page.getByLabel(/Тема истории/).fill("Потерянная ракушка");
  await page.getByLabel(/Чему должна научить/).fill("Помогать друзьям");
  await page.getByLabel("7–8 лет").check();
  await page.getByLabel(/7 страниц/).check();
  await page.getByLabel("Только текст").check();
  await page.getByRole("button", { name: /Создать сказку/ }).click();

  await expect(page.locator("#generationOverlay")).toBeVisible();
  await expect(page.getByRole("button", { name: "Читать сказку", exact: true })).toBeVisible();
  await expect(page.locator("#generationTasksPanel")).toBeVisible();
  await expect(page.getByRole("button", { name: "Читать сказку" })).toHaveAttribute("data-story-id", "story-7");
  await expect
    .poll(() => page.evaluate(() => Boolean(window.HFStoryService?.getStoryById("story-7"))))
    .toBe(true);
  await page.getByRole("button", { name: "Читать сказку" }).click();
  await expect(page).toHaveURL(/\/stories\/story-7$/);
});

test("story becomes readable before illustration requests finish", async ({ page }) => {
  await page.route(new RegExp(`${TEST_SUPABASE_URL}/rest/v1/stories\\?.*`), async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "story-illustrated",
          title: "Иллюстрации позже",
          age_group: "7-8",
          mood: "bedtime",
          lesson: "Делиться теплом",
          illustrations_enabled: true
        }
      ])
    });
  });
  await page.route(new RegExp(`${TEST_SUPABASE_URL}/rest/v1/story_pages\\?.*`), (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        { page_number: 1, text: "Первая страница", scene_tag: "forest_day", image_prompt: "Кадр 1", image_status: "pending" },
        { page_number: 2, text: "Вторая страница", scene_tag: "forest_day", image_prompt: "Кадр 2", image_status: "pending" }
      ])
    })
  );
  await page.route("**/api/generate-story", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        story: {
          id: "story-illustrated",
          title: "Иллюстрации позже",
          ageGroup: "7-8",
          mood: "перед сном",
          lesson: "Делиться теплом",
          pages: [
            { pageNumber: 1, text: "Первая страница", sceneTag: "forest_day", imagePrompt: "Кадр 1" },
            { pageNumber: 2, text: "Вторая страница", sceneTag: "forest_day", imagePrompt: "Кадр 2" }
          ]
        },
        meta: { mode: "mock" }
      })
    });
  });
  await page.route("**/api/generate-story-illustration", () => new Promise(() => {}));

  await page.goto("/create");
  await page.waitForFunction(() => window.HFSupabaseService?.isAuthenticated?.());
  await page.evaluate(() => {
    window.HFConfig.ILLUSTRATION_API_ENABLED = true;
    window.HFConfig.ILLUSTRATION_API_URL = "/api/generate-story-illustration";
  });
  await page.getByLabel(/Тема истории/).fill("Тёплый фонарик");
  await page.getByLabel(/Чему должна научить/).fill("Делиться теплом");
  await page.getByLabel("7–8 лет").check();
  await page.getByLabel("Да, с иллюстрациями").check();
  await page.getByRole("button", { name: /Создать сказку/ }).click();

  await expect(page.locator("#generationOverlay")).toBeVisible();
  await expect(page.locator("#generationOverlayTitle")).toContainText("Текст готов");
  await expect(page.getByRole("button", { name: "Читать, пока рисуются картинки" })).toBeVisible();
  await expect(page.locator("#generationStatus")).toBeEmpty();
});

test("generation request keeps the backend connection open for the full waiting window", async ({ page }) => {
  await page.addInitScript(() => {
    const originalSetTimeout = window.setTimeout;
    window.__generationTimeoutDelays = [];
    window.setTimeout = function patchedSetTimeout(callback, delay, ...args) {
      const numericDelay = Number(delay);
      if (numericDelay >= 30000) window.__generationTimeoutDelays.push(numericDelay);
      return originalSetTimeout.call(window, callback, delay, ...args);
    };
  });
  await page.route("**/api/generate-story", () => new Promise(() => {}));

  await page.goto("/create");
  await page.waitForFunction(() => window.HFSupabaseService?.isAuthenticated?.());
  await page.getByLabel(/Тема истории/).fill("Магический шар");
  await page.getByLabel(/Чему должна научить/).fill("Друзья помогают друг другу");
  await page.getByLabel(/7 страниц/).check();
  await page.getByRole("button", { name: /Создать сказку/ }).click();

  await expect
    .poll(() => page.evaluate(() => window.__generationTimeoutDelays))
    .toContain(180000);
  await expect
    .poll(() => page.evaluate(() => window.__generationTimeoutDelays.includes(30000)))
    .toBe(false);
});

test("generation task hitboxes match the visible answer order on the artwork", async ({ page }) => {
  await page.route("**/api/generate-story", () => new Promise(() => {}));
  await page.setViewportSize({ width: 960, height: 1000 });

  await page.goto("/create");
  await page.waitForFunction(() => window.HFGenerationTasks?.createTaskSet && window.HFSupabaseService?.isAuthenticated?.());
  const forcedOptions = await page.evaluate(() => {
    const originalCreateTaskSet = window.HFGenerationTasks.createTaskSet;
    const task = originalCreateTaskSet("5-6", 6, () => 0).at(-1);
    window.HFGenerationTasks.createTaskSet = () => [task];
    window.HFGenerationTasks.pickNextTask = () => task;
    return task.options;
  });

  expect(forcedOptions).toEqual(["К", "О", "Т"]);

  await page.getByLabel(/Тема истории/).fill("Магический шар");
  await page.getByLabel(/Чему должна научить/).fill("Друзья помогают друг другу");
  await page.getByRole("button", { name: /Создать сказку/ }).click();

  const overlay = page.locator("#generationOverlay");
  const taskStage = overlay.locator(".generation-task-image-stage");
  const taskImage = overlay.locator("#generationTaskImage");
  const taskFeedback = overlay.locator("#generationTaskFeedback");

  await expect(overlay).toBeVisible();
  await expect(taskImage).toHaveAttribute("src", /\/images\/generation-tasks\/5-6\/task-06\.webp$/);
  await taskStage.scrollIntoViewIfNeeded();

  const clickStagePoint = async (xRatio, yRatio) => {
    const box = await taskStage.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
  };

  await clickStagePoint(0.28, 0.82);
  await expect(taskFeedback).toHaveText("Попробуй ещё раз");

  await clickStagePoint(0.72, 0.82);
  await expect(taskFeedback).toHaveText("Верно! ⭐");
});

for (const width of [375, 960]) {
  test(`height puzzle selects the word under the pointer at ${width}px`, async ({ page }) => {
    await page.route("**/api/generate-story", () => new Promise(() => {}));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/create");
    await page.waitForFunction(() => window.HFGenerationTasks && window.HFSupabaseService?.isAuthenticated?.());
    await page.evaluate(() => {
      const task = window.HFGenerationTasks.createTaskSet("9-10", 12, () => 0)[9];
      window.HFGenerationTasks.pickNextTask = () => task;
    });
    await page.getByLabel(/Тема истории/).fill("Лесные друзья");
    await page.getByLabel(/Чему должна научить/).fill("Помогать друзьям");
    await page.getByRole("button", { name: /Создать сказку/ }).click();
    const stage = page.locator(".generation-task-image-stage");
    await stage.scrollIntoViewIfNeeded();
    const box = await stage.boundingBox();
    // Independently measured centres of the printed buttons in the artwork.
    await page.mouse.click(box.x + box.width * 0.30, box.y + box.height * 0.87);
    await expect(page.locator('[data-answer="Аня"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#generationTaskSelection")).toHaveText("Твой ответ: Аня");
    await expect(page.locator("#generationTaskFeedback")).toHaveText("Попробуй ещё раз");
    await page.mouse.click(box.x + box.width * 0.71, box.y + box.height * 0.87);
    await expect(page.locator("#generationTaskSelection")).toHaveText("Твой ответ: Вова");
    await expect(page.locator("#generationTaskFeedback")).toHaveText("Верно! ⭐");
    await expect(page.locator('[data-answer="Аня"]')).toBeDisabled();
    await expect(page.locator('[data-answer="Вова"]')).toHaveAttribute("aria-pressed", "true");
    await page.mouse.click(box.x + box.width * 0.30, box.y + box.height * 0.87);
    await expect(page.locator("#generationTaskFeedback")).toHaveText("Верно! ⭐");
    const answer = await page.locator('[data-answer="Вова"]').boundingBox();
    expect(Math.abs((answer.y - box.y) / box.height - 0.819)).toBeLessThan(0.005);
    await page.screenshot({ path: `artifacts/task-height-${width}.png` });
  });
}

for (const fixture of [
  { age: "5-6", index: 8, answer: "Ромашка", x: 0.813, y: 0.738 },
  { age: "7-8", index: 10, answer: "Берёза", x: 0.84, y: 0.71 },
  { age: "7-8", index: 4, answer: "3", x: 0.50, y: 0.857 },
  { age: "9-10", index: 6, answer: "Прилагательное", x: 0.505, y: 0.765 }
]) {
  test(`artwork answer ${fixture.age}/${fixture.index + 1} selects ${fixture.answer}`, async ({ page }) => {
    await page.route("**/api/generate-story", () => new Promise(() => {}));
    await page.goto("/create");
    await page.waitForFunction(() => window.HFGenerationTasks && window.HFSupabaseService?.isAuthenticated?.());
    await page.evaluate(({ age, index }) => {
      const task = window.HFGenerationTasks.createTaskSet(age, 12, () => 0)[index];
      window.HFGenerationTasks.pickNextTask = () => task;
    }, fixture);
    await page.getByLabel(/Тема истории/).fill("Лесные друзья");
    await page.getByLabel(/Чему должна научить/).fill("Помогать друзьям");
    await page.getByRole("button", { name: /Создать сказку/ }).click();
    const stage = page.locator(".generation-task-image-stage");
    await stage.scrollIntoViewIfNeeded();
    const box = await stage.boundingBox();
    await page.mouse.click(box.x + box.width * fixture.x, box.y + box.height * fixture.y);
    await expect(page.locator("#generationTaskSelection")).toHaveText(`Твой ответ: ${fixture.answer}`);
    await expect(page.locator("#generationTaskFeedback")).toHaveText("Верно! ⭐");
  });
}

test("enabled generation API does not save a browser mock when the user session is unavailable", async ({ page }) => {
  await page.goto("/create");
  await page.waitForFunction(() => window.HFSupabaseService?.isAuthenticated?.());
  await page.evaluate(async () => {
    await window.HFSupabaseService.signOut();
    localStorage.removeItem("hedgehogFoxUserStories");
    localStorage.removeItem("hedgehogFoxGenerationDiagnostics");
    await window.HFStoryService.initializeUserStories();
    await window.HFSubscriptionService.initializeSubscription();
  });

  await expect
    .poll(() => page.evaluate(() => window.HFSupabaseService?.isAuthenticated?.()))
    .toBe(false);
  await page.getByLabel(/Тема истории/).fill("Магический шар");
  await page.getByLabel(/Чему должна научить/).fill("Друзья помогают друг другу");
  await page.getByLabel(/7 страниц/).check();
  await page.getByRole("button", { name: /Создать сказку/ }).click();

  const overlay = page.locator("#generationOverlay");
  await expect(overlay).toHaveAttribute("data-state", "error");
  await expect(overlay.locator("#generationErrorMessage")).toContainText("Не удалось создать историю");
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("hedgehogFoxUserStories") || "[]").length))
    .toBe(0);
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("hedgehogFoxGenerationDiagnostics") || "[]").map((item) => item.mode)))
    .not.toContain("browser-mock-fallback");
});

test("authorized generation keeps explicit backend error messages", async ({ page }) => {
  await page.route("**/api/generate-story", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        error: "rate_limited",
        message: "Слишком много запросов. Попробуйте позже."
      })
    })
  );

  await page.goto("/create");
  await page.waitForFunction(() => window.HFSupabaseService?.isAuthenticated?.());
  await page.getByLabel(/Тема истории/).fill("Магический шар");
  await page.getByLabel(/Чему должна научить/).fill("Друзья помогают друг другу");
  await page.getByRole("button", { name: /Создать сказку/ }).click();

  const errorMessage = page.locator("#generationErrorMessage");
  await expect(page.locator("#generationOverlay")).toHaveAttribute("data-state", "error");
  await expect(errorMessage).toContainText("Слишком много запросов. Попробуйте позже.");
  await expect(errorMessage).not.toContainText("История не была сохранена");
});

for (const outcome of ["a fully illustrated reader", "an honest failure", "a refresh failure without losing completed images", "already ready images survive a refresh failure"]) {
test(`illustrations progress to ${outcome}`, async ({ page }) => {
  const failSecondPage = outcome === "an honest failure";
  const alreadyReady = outcome === "already ready images survive a refresh failure";
  const failRefresh = outcome === "a refresh failure without losing completed images" || alreadyReady;
  let firstPageReady = alreadyReady;
  let secondPageStatus = alreadyReady ? "ready" : "generating";
  let textCreated = false;
  let pageReadsAfterText = 0;
  let secondPageRoute;
  const imageRequests = [];

  await page.route(/\/js\/config\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.HFConfig = ${JSON.stringify({
        SUPABASE_ENABLED: true,
        SUPABASE_URL: TEST_SUPABASE_URL,
        SUPABASE_ANON_KEY: "e2e-anon-key",
        GENERATION_MINI_GAMES_ENABLED: false,
        GENERATION_API_ENABLED: true,
        GENERATION_API_URL: "/api/generate-story",
        ILLUSTRATION_API_ENABLED: true,
        ILLUSTRATION_API_URL: "/api/generate-story-illustration",
        ILLUSTRATION_SIGNING_API_URL: "/api/get-story-illustration-url",
        PAYMENT_API_URL: ""
      })};`
    })
  );
  await page.route(new RegExp(`${TEST_SUPABASE_URL}/rest/v1/stories\\?.*`), (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([{
        id: "story-prewarm",
        title: "Рисунок загружается заранее",
        age_group: "7-8",
        mood: "bedtime",
        lesson: "Помогать друзьям",
        illustrations_enabled: true
      }])
    })
  );
  await page.route(new RegExp(`${TEST_SUPABASE_URL}/rest/v1/story_pages\\?.*`), (route) => {
    if (textCreated) pageReadsAfterText += 1;
    if (failRefresh && (alreadyReady ? pageReadsAfterText > 1 : secondPageStatus === "ready")) {
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Temporary refresh failure" }) });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          page_number: 1,
          text: "Первая страница",
          scene_tag: "forest_day",
          image_prompt: "Кадр 1",
          image_status: firstPageReady ? "ready" : "pending",
          image_url: firstPageReady ? "storage://story-illustrations/test-user/story-prewarm/page-1.webp" : ""
        },
        {
          page_number: 2,
          text: "Вторая страница",
          scene_tag: "forest_day",
          image_prompt: "Кадр 2",
          image_status: secondPageStatus,
          image_url: secondPageStatus === "ready" ? "storage://story-illustrations/test-user/story-prewarm/page-2.webp" : ""
        }
      ])
    });
  });
  await page.route("**/api/generate-story", (route) => {
    textCreated = true;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        story: {
          id: "story-prewarm",
          title: "Рисунок загружается заранее",
          ageGroup: "7-8",
          pages: [
            { pageNumber: 1, text: "Первая страница", sceneTag: "forest_day", imagePrompt: "Кадр 1" },
            { pageNumber: 2, text: "Вторая страница", sceneTag: "forest_day", imagePrompt: "Кадр 2" }
          ]
        },
        meta: { mode: "mock" }
      })
    });
  });
  await page.route("**/api/generate-story-illustration", (route) => {
    const { pageNumber } = route.request().postDataJSON();
    if (pageNumber === 1) {
      firstPageReady = true;
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ illustrated: true, pageNumber })
      });
    }

    secondPageRoute = route;
  });
  await page.route("**/api/get-story-illustration-url", (route) => {
    const body = route.request().postDataJSON();
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ signedUrl: `https://images.e2e.test/story-prewarm/page-${body.imageReference?.includes("page-2") ? 2 : 1}.webp` })
    });
  });
  await page.route("https://images.e2e.test/**", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1\" height=\"1\"/>" })
  );
  page.on("request", (request) => {
    if (request.url() === "https://images.e2e.test/story-prewarm/page-1.webp") {
      imageRequests.push(request.url());
    }
  });

  await page.goto("/create");
  await expect.poll(() => page.evaluate(() => window.HFConfig?.ILLUSTRATION_API_ENABLED)).toBe(true);
  await page.waitForFunction(() => window.HFSupabaseService?.isAuthenticated?.());
  await page.getByLabel(/Тема истории/).fill("Тёплый фонарик");
  await page.getByLabel(/Чему должна научить/).fill("Помогать друзьям");
  await page.getByLabel("7–8 лет").check();
  await page.getByLabel("Да, с иллюстрациями").check();
  await page.getByRole("button", { name: /Создать сказку/ }).click();

  if (alreadyReady) {
    await expect(page.locator("#generationOverlayTitle")).toContainText("Не удалось обновить картинки");
    await expect(page.locator("#generationIllustrationProgress")).toContainText("2 из 2");
    return;
  }
  await expect(page.getByRole("button", { name: "Читать, пока рисуются картинки" })).toBeVisible();
  await expect.poll(() => imageRequests.length).toBe(1);
  await expect(page.locator("#generationIllustrationProgress")).toContainText("1 из 2");
  await expect(page.locator("#generationOverlayTitle")).toContainText("Текст готов");
  await expect(page).toHaveURL(/\/create$/);
  await expect.poll(() => Boolean(secondPageRoute)).toBe(true);
  secondPageStatus = failSecondPage ? "failed" : "ready";
  await secondPageRoute.fulfill({
    contentType: "application/json",
    status: failSecondPage ? 502 : 200,
    body: JSON.stringify(failSecondPage
      ? { error: "provider_unavailable", message: "Картинка пока не получилась" }
      : { illustrated: true, pageNumber: 2 })
  });
  if (failRefresh) {
    await expect(page.locator("#generationOverlayTitle")).toContainText("Не удалось обновить картинки");
    await expect(page.locator("#generationIllustrationProgress")).toContainText("2 из 2");
    await expect(page.locator("#generationIllustrationProgress")).not.toContainText("Нарисовать");
    return;
  }
  if (failSecondPage) {
    await expect(page.locator("#generationOverlayTitle")).toContainText("Не все картинки получились");
    await expect(page.locator("#generationIllustrationProgress")).toContainText("Дорисовать иллюстрации");
    await page.getByRole("button", { name: "Читать готовый текст" }).click();
  } else {
    await expect(page.locator("#generationOverlayTitle")).toHaveText("Сказка готова!");
    await expect(page.locator("#generationIllustrationProgress")).toContainText("2 из 2");
    await page.getByRole("button", { name: "Читать сказку", exact: true }).click();
  }
  const images = page.locator("#slides .reader-illustration");
  await expect(images).toHaveCount(failSecondPage ? 1 : 2);
  await expect.poll(() => images.first().evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  if (!failSecondPage) {
    await images.last().scrollIntoViewIfNeeded();
    await expect.poll(() => images.last().evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  }
});
}

test("generation dialog keeps approved paper tokens and responsive task cards", async ({ page }) => {
  await page.route("**/api/generate-story", () => new Promise(() => {}));
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/create");

  await expect(page.getByLabel(/5 страниц/)).toBeChecked();
  await page.getByLabel(/Тема истории/).fill("Тихий лес");
  await page.getByLabel(/Чему должна научить/).fill("Беречь друзей");
  await page.getByRole("button", { name: /Создать сказку/ }).click();

  const overlay = page.locator("#generationOverlay");
  const paper = overlay.locator(".generation-overlay__paper");
  await expect(overlay).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/create-overlay-open/);
  await expect
    .poll(() => page.locator("body").evaluate((element) => getComputedStyle(element).overflowY))
    .toBe("hidden");
  await expect(overlay.locator(".generation-task-card")).toHaveCount(1);
  await expect(overlay.locator("#generationTaskText")).toHaveCount(0);
  const taskImage = overlay.locator("#generationTaskImage");
  const taskStage = overlay.locator(".generation-task-image-stage");
  await expect(taskStage.locator("#generationTaskImage")).toHaveCount(1);
  await expect(taskStage.locator("#generationTaskOptions")).toHaveCount(1);
  await expect(taskImage).toHaveAttribute("src", /\/images\/generation-tasks\/5-6\/task-\d{2}\.webp$/);
  await expect(overlay.locator(".generation-task-card__badge")).toHaveCount(0);
  await expect
    .poll(() => taskImage.evaluate((element) => getComputedStyle(element).backgroundImage))
    .toBe("none");
  await expect(overlay.locator(".generation-task-card--active .generation-task-answer")).not.toHaveCount(0);
  await expect(overlay.locator("#generationTaskSkip")).toBeVisible();
  await expect(overlay.locator("#generationTaskNext")).toBeVisible();

  const mobileDialog = await paper.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      background: styles.backgroundColor,
      color: styles.color,
      horizontalFits: element.scrollWidth <= element.clientWidth,
      verticalContainment: styles.overflowY === "auto" && styles.overscrollBehavior === "contain"
    };
  });
  expect(mobileDialog.background).toBe("rgb(251, 250, 245)");
  expect(mobileDialog.color).toBe("rgb(77, 65, 54)");
  expect(mobileDialog.horizontalFits).toBe(true);
  expect(mobileDialog.verticalContainment).toBe(true);

  await page.setViewportSize({ width: 960, height: 700 });
  await expect(overlay.locator(".generation-task-card")).toHaveCount(1);
  const firstImageSource = await taskImage.getAttribute("src");
  await overlay.getByRole("button", { name: "Другая задачка" }).click();
  await expect(taskImage).not.toHaveAttribute("src", firstImageSource);
});

test("create form recovers from a validation error without browser errors", async ({ page }) => {
  await page.route("**/api/generate-story", (route) =>
    route.fulfill({
      contentType: "application/json",
      status: 422,
      body: JSON.stringify({ error: "Тема истории слишком короткая." })
    })
  );

  const browserErrors = [];
  const expectedValidationTransportError =
    "Failed to load resource: the server responded with a status of 422 (Unprocessable Entity)";
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && message.text() !== expectedValidationTransportError) {
      browserErrors.push(message.text());
    }
  });

  await page.goto("/create");
  await page.waitForFunction(() => window.HFSupabaseService?.isAuthenticated?.());

  const topic = "Тихий лес";
  const lesson = "Беречь друзей";
  const submitButton = page.getByRole("button", { name: /Создать сказку/ });
  await page.getByLabel(/Тема истории/).fill(topic);
  await page.getByLabel(/Чему должна научить/).fill(lesson);
  await submitButton.click();

  const overlay = page.locator("#generationOverlay");
  await expect(overlay).toHaveAttribute("data-state", "error");
  await expect(overlay).toContainText("Пока не получилось создать сказку");
  await expect(overlay.locator("#generationErrorMessage")).toContainText("Не удалось создать историю");
  await expect(overlay.locator("#generationStatus")).toBeEmpty();
  await expect(overlay.getByRole("button", { name: "Открыть сказку" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Попробовать ещё раз" })).toBeFocused();

  await page.getByRole("button", { name: "Закрыть" }).click();
  await expect(overlay).toBeHidden();
  await expect(submitButton).toBeEnabled();
  await expect(submitButton).toBeFocused();
  await expect(page.getByLabel(/Тема истории/)).toHaveValue(topic);
  await expect(page.getByLabel(/Чему должна научить/)).toHaveValue(lesson);
  expect(browserErrors).toEqual([]);
});

test("create route marks the generator navigation current and keeps form helper text in sync", async ({ page }) => {
  await page.goto("/create");

  const generatorNavigation = page.locator("#navGeneratorButton");
  await expect(generatorNavigation).toHaveClass(/active/);
  await expect(generatorNavigation).toHaveAttribute("aria-current", "page");
  await expect(page.locator("#storyMoodHelp")).toContainText("спокой");
  await expect(page.locator("#pageCountHelp")).toContainText("рекомендуем");

  await page.getByLabel("Приключение").selectOption("adventure");
  await expect(page.locator("#storyMoodHelp")).toContainText("открыт");
  await page.getByLabel(/7 страниц/).check();
  await expect(page.locator("#pageCountHelp")).toContainText("Длинн");

  await page.locator("#navStoriesButton").click();
  await expect(generatorNavigation).not.toHaveClass(/active/);
  await expect(generatorNavigation).not.toHaveAttribute("aria-current", "page");
});

test("create route hides and does not load the home hero before account synchronization finishes", async ({ page }) => {
  const homeHeroRequests = [];

  await page.route(`${TEST_SUPABASE_URL}/rest/v1/rpc/get_current_usage`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await route.fulfill({ contentType: "application/json", body: "[]" });
  });
  page.on("request", (request) => {
    if (request.url().includes("/assets/optimized/hero-seaside-bench-")) {
      homeHeroRequests.push(request.url());
    }
  });

  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".hero")).toBeHidden({ timeout: 500 });
  await expect(page.locator("#generator")).toBeVisible({ timeout: 500 });
  await page.waitForTimeout(100);
  expect(homeHeroRequests).toEqual([]);
});

for (const width of [320, 375, 430, 768, 1024, 1440, 1920]) {
  test(`create page has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/create");

    await expect
      .poll(() =>
        page.locator("html").evaluate((element) => element.scrollWidth <= window.innerWidth)
      )
      .toBe(true);
  });
}
