import { expect, test } from "@playwright/test";

const TEST_SUPABASE_URL = "https://supabase.e2e.test";

test("registration requests confirmation back to the current site", async ({ page }) => {
  let signupPayload;

  await page.route("**/library", (route) => route.fulfill({ path: "dist/index.html" }));
  await page.route(`${TEST_SUPABASE_URL}/**`, (route) =>
    route.fulfill({ contentType: "application/json", body: "[]" })
  );
  await page.route(`${TEST_SUPABASE_URL}/auth/v1/signup`, async (route) => {
    signupPayload = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "pending-user", email: "parent@example.com" },
        session: null
      })
    });
  });
  await page.route("**/_vercel/insights/script.js", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" })
  );
  await page.addInitScript(() => {
    sessionStorage.setItem("ezhik-intro-seen-v1", "true");
  });

  await page.goto("/library");
  await page.getByLabel("Email").fill("parent@example.com");
  await page.getByLabel(/Я взрослый или родитель/).check();
  await page.locator("#authPassword").fill("secure-password");
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();

  await expect.poll(() => signupPayload).toMatchObject({
    email: "parent@example.com",
    password: "secure-password",
    email_redirect_to: "http://127.0.0.1:4318/library"
  });
});
