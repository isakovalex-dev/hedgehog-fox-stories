import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/create", (route) => route.fulfill({ path: "dist/index.html" }));
  await page.route("https://ynidvdesfolavhngubqv.supabase.co/**", (route) =>
    route.fulfill({ contentType: "application/json", status: 500, body: "{}" })
  );
  await page.route("**/auth/v1/user", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ id: "test-user" }) })
  );
  await page.route("**/_vercel/insights/script.js", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" })
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
  await page.route(/https:\/\/ynidvdesfolavhngubqv\.supabase\.co\/rest\/v1\/stories\?.*/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "story-7",
          title: "Проверка",
          age_group: "7-8",
          mood: "bedtime",
          lesson: "Помогать друзьям"
        }
      ])
    });
  });
  await page.route(/https:\/\/ynidvdesfolavhngubqv\.supabase\.co\/rest\/v1\/story_pages\?.*/, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        { page_number: 1, text: "Текст", scene_tag: "forest_day", image_prompt: "Кадр" }
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
  await expect(page.getByRole("button", { name: /Открыть сказку/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Открыть сказку/ })).toHaveAttribute("data-story-id", "story-7");
  await expect
    .poll(() => page.evaluate(() => Boolean(window.HFStoryService?.getStoryById("story-7"))))
    .toBe(true);
  await page.getByRole("button", { name: /Открыть сказку/ }).click();
  await expect(page).toHaveURL(/\/stories\/story-7$/);
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
