# Create Story Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved watercolor `/create` experience with compatible story parameters, local age-appropriate tasks, and a truthful synchronous generation overlay.

**Architecture:** Keep the static SPA and its one synchronous `POST /api/generate-story` request. Add two browser IIFE modules: `HFGenerationTasks` owns deterministic task data and answer validation, while `HFCreateStoryFlow` owns the overlay, focus, task UI, and cleanup. `app.js` remains responsible for form validation, authorization and quota checks, the API/mock request, persistence, and opening the returned story.

**Tech Stack:** Static HTML, CSS, browser JavaScript IIFEs with JSDoc, Vercel Node serverless function, Supabase RPC, Node built-in test runner, Playwright.

## Global Constraints

- Preserve the current Header, Footer, route handling, authorization, subscription limits, persistence and OpenAI-compatible server integration.
- Use native labelled controls; age and page count use radio groups with a visible `:focus-visible` state and minimum 44×44 px hit targets.
- New age values are exactly `5-6`, `7-8`, `9-10`; stored legacy values `5-7`, `8-10` remain valid and readable.
- The form offers exactly 3, 5 and 7 pages, defaults to 5, and the backend continues accepting prior counts 1–4 while raising its maximum to 7.
- The generation API remains synchronous. Never show fake percentage progress or a fifth completed star before the actual response is received.
- Local tasks never call AI, do not block generation, avoid the same task twice in a row, and calculate arithmetic answers from operands.
- Preserve source artwork under `pictures/Создание сказки`; only copies and optimized derivatives are served by the site.
- Respect `prefers-reduced-motion`; decorative images have `alt=""`; the semantic hero image has concise Russian alt text.
- Do not introduce framework or runtime dependencies.

---

## File structure and responsibilities

| File | Responsibility |
| --- | --- |
| `assets/create/*` | Optimized copies of the approved hero, paper background, form characters and generation illustration. |
| `index.html` | Accessible `/create` page structure, radio-card markup, overlay dialog and the two new script tags. |
| `styles.css` | Namespaced `create-*` layout, states, responsive rules, dialog, progress and reduced-motion styles. |
| `js/generationTasks.js` | `window.HFGenerationTasks`: age-aware task data, selection and answer checking. |
| `js/createStoryFlow.js` | `window.HFCreateStoryFlow`: overlay lifecycle, task presentation, keyboard support and focus restoration. |
| `js/app.js` | Existing app orchestration adapted to hand the real request lifecycle to `HFCreateStoryFlow`. |
| `js/storyService.js` | Backward-compatible age normalization, labels and story metadata preservation. |
| `api/generate-story.js` | Request/response validation, mock generation and AI prompt support for all new parameters. |
| `docs/supabase-rpc-generated-story.sql` | RPC age preservation for authenticated stories. |
| `docs/backend-mock-api.md` | Published request contract for new age and page values. |
| `tests/create-story-contract.test.js` | Server, RPC source and story-service compatibility checks. |
| `tests/generation-tasks.test.js` | Task-generation and answer-validation unit tests. |
| `tests/create-story-flow.test.js` | Overlay lifecycle and keyboard/focus unit tests. |
| `tests/create-story.spec.mjs` | Browser tests for the form, the synchronous wait state, ready state, accessibility and responsive overflow. |

### Task 1: Make the story contract backward-compatible and extend its supported values

**Files:**
- Create: `tests/create-story-contract.test.js`
- Modify: `api/generate-story.js:708-716,836-849,946-972,tail export`
- Modify: `js/storyService.js:161-192,432-440`
- Modify: `docs/supabase-rpc-generated-story.sql:48-64`
- Modify: `docs/backend-mock-api.md:71-85,91-105`

**Interfaces:**
- Consumes: browser payload `{ topic, ageGroup, mood, lesson, pageCount }`.
- Produces: `handler.__testables.normalizeAgeGroup(value)`, `handler.__testables.normalizePageCount(value)`, `window.HFStoryService.normalizeAgeGroup(value)`, and `window.HFStoryService.getAgeGroupLabel(value)`.
- Compatibility: all five strings `5-7`, `5-6`, `7-8`, `8-10`, `9-10` remain storable; unknown values normalize to `5-6` only at new-input boundaries.

- [ ] **Step 1: Write the failing contract test**

Create `tests/create-story-contract.test.js` with this executable test setup and assertions:

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const handler = require("../api/generate-story.js");

test("generation contract accepts new ages and seven pages without rewriting legacy ages", () => {
  const api = handler.__testables;
  assert.deepEqual(
    ["5-6", "7-8", "9-10"].map(api.normalizeAgeGroup),
    ["5-6", "7-8", "9-10"]
  );
  assert.equal(api.normalizePageCount(7), 7);
  assert.equal(api.normalizePageCount(99), 7);

  global.window = { HFStorageService: { getJSON: () => [], setJSON() {}, removeItem() {} } };
  delete require.cache[require.resolve("../js/storyService.js")];
  require("../js/storyService.js");
  const stories = window.HFStoryService;
  assert.equal(stories.normalizeAgeGroup("5-7"), "5-7");
  assert.equal(stories.normalizeAgeGroup("8-10"), "8-10");
  assert.equal(stories.getAgeGroupLabel("9-10"), "9–10 лет");

  const rpc = fs.readFileSync(path.join(__dirname, "..", "docs", "supabase-rpc-generated-story.sql"), "utf8");
  assert.match(rpc, /p_age_group in \('5-6', '7-8', '9-10', '5-7', '8-10'\)/);
});
```

- [ ] **Step 2: Run the contract test to verify the expected failure**

Run:

```bash
node --test tests/create-story-contract.test.js
```

Expected: FAIL because `handler.__testables`, `normalizeAgeGroup`, and `normalizePageCount` do not exist, and because the RPC still coerces new values to `5-7`.

- [ ] **Step 3: Implement the smallest compatible normalization layer**

In `api/generate-story.js`, replace the two clamp helpers with an explicit supported-value set and export them only for tests:

```js
const SUPPORTED_AGE_GROUPS = new Set(["5-6", "7-8", "9-10", "5-7", "8-10"]);

function normalizePageCount(value) {
  const pageCount = Number(value || 5);
  if (!Number.isInteger(pageCount)) return 5;
  return Math.min(7, Math.max(1, pageCount));
}

function normalizeAgeGroup(value) {
  return SUPPORTED_AGE_GROUPS.has(value) ? value : "5-6";
}
```

Use those functions in request validation, generated-story validation, mock output, and `getAiUserPrompt`. Change the AI contract text to list all five accepted values and `maxPages` to `7`. At the export, retain the handler export and expose exactly the helpers under `handler.__testables`.

In `js/storyService.js`, add the same `SUPPORTED_AGE_GROUPS` list, plus an `AGE_GROUP_LABELS` map. Replace the binary `toAgeTag` logic with `normalizeAgeGroup`; render labels through the map without changing supplied legacy values. Publish both functions in `window.HFStoryService`.

In the RPC, replace the binary `case` expression with:

```sql
case
  when p_age_group in ('5-6', '7-8', '9-10', '5-7', '8-10') then p_age_group
  else '5-6'
end
```

Update `docs/backend-mock-api.md` to document accepted values `5-6`, `7-8`, `9-10`, `5-7`, `8-10` and page counts `1-7`, noting that the new UI offers 3, 5 and 7.

- [ ] **Step 4: Run the contract test and syntax check**

Run:

```bash
node --test tests/create-story-contract.test.js
node --check api/generate-story.js
```

Expected: PASS. The test proves both new values and saved legacy values survive normalization.

- [ ] **Step 5: Commit the contract change**

```bash
git add api/generate-story.js js/storyService.js docs/supabase-rpc-generated-story.sql docs/backend-mock-api.md tests/create-story-contract.test.js
git commit -m "feat: support new story age groups and page counts"
```

### Task 2: Create the pure local generation-task service

**Files:**
- Create: `js/generationTasks.js`
- Create: `tests/generation-tasks.test.js`
- Modify: `index.html:889-900`

**Interfaces:**
- Consumes: a valid age group and optional deterministic random function.
- Produces: `window.HFGenerationTasks.createTaskSet(ageGroup, count, random)`, `checkAnswer(task, answer)`, and `getAgeTaskConfig(ageGroup)`.
- Task shape: `{ id, ageGroup, type, text, visual, options, correctAnswer, hint, explanation, difficulty }`.

- [ ] **Step 1: Write the failing task-service tests**

Create `tests/generation-tasks.test.js`:

```js
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

global.window = {};
require(path.join(__dirname, "..", "js", "generationTasks.js"));
const tasks = window.HFGenerationTasks;

test("every age group receives valid unique tasks with a correct answer", () => {
  ["5-6", "7-8", "9-10"].forEach((ageGroup) => {
    const generated = tasks.createTaskSet(ageGroup, 3, () => 0.25);
    assert.equal(generated.length, 3);
    assert.equal(new Set(generated.map((task) => task.id)).size, 3);
    generated.forEach((task) => {
      assert.equal(task.ageGroup, ageGroup);
      assert.ok(task.options.includes(task.correctAnswer));
      assert.equal(tasks.checkAnswer(task, task.correctAnswer).correct, true);
      assert.equal(tasks.checkAnswer(task, "wrong").correct, false);
    });
  });
});

test("arithmetic tasks calculate their own answer instead of trusting display text", () => {
  const task = tasks.createTaskSet("9-10", 3, () => 0.74).find((item) => item.type === "arithmetic");
  assert.ok(task);
  assert.equal(tasks.checkAnswer(task, String(task.visual.left * task.visual.right)).correct, task.visual.operation === "multiply");
});
```

- [ ] **Step 2: Run the task-service tests to verify the expected failure**

Run:

```bash
node --test tests/generation-tasks.test.js
```

Expected: FAIL with `Cannot find module '../js/generationTasks.js'`.

- [ ] **Step 3: Implement the task module and load it before the app**

Create `js/generationTasks.js` as an IIFE. Define fixed templates for non-math tasks and factories for arithmetic tasks. Build options by placing the computed answer in a unique array with age-appropriate distractors, then shuffle with the injected random function. Keep the previous task ids in a `Set` until a set is returned, so one set cannot repeat a task. Normalize answers by trimming, lowercasing and replacing `ё` with `е`.

Expose this exact public object:

```js
window.HFGenerationTasks = {
  createTaskSet,
  checkAnswer,
  getAgeTaskConfig,
  normalizeAnswer
};
```

Add the script in `index.html` after `js/storyService.js` and before `js/createStoryFlow.js`/`js/app.js`:

```html
<script src="js/generationTasks.js?v=1"></script>
```

- [ ] **Step 4: Run the task-service tests**

Run:

```bash
node --test tests/generation-tasks.test.js
```

Expected: PASS. Each group has three non-repeated tasks, every answer is verifiable, and a wrong answer is never accepted.

- [ ] **Step 5: Commit the task service**

```bash
git add js/generationTasks.js index.html tests/generation-tasks.test.js
git commit -m "feat: add local age-aware generation tasks"
```

### Task 3: Build the accessible generation overlay as an isolated DOM controller

**Files:**
- Create: `js/createStoryFlow.js`
- Create: `tests/create-story-flow.test.js`
- Modify: `index.html:889-900`

**Interfaces:**
- Consumes: `window.HFGenerationTasks`, a dialog root `#generationOverlay`, and callbacks `{ onOpenStory, onRetry }`.
- Produces: `window.HFCreateStoryFlow.create(options)` returning `{ start, setReady, setError, hide, destroy, isOpen }`.
- Lifecycle: `start({ ageGroup, trigger })` → `setReady({ storyId })` or `setError({ message })` → `hide()`/`destroy()`.

- [ ] **Step 1: Write the failing overlay lifecycle test**

Create `tests/create-story-flow.test.js` with a small fake DOM that supports `classList`, `focus`, `addEventListener`, `querySelector`, and `querySelectorAll`, then assert the controller contract:

```js
test("overlay keeps generation pending until ready, restores focus, and opens the exact story", () => {
  const { window, trigger, overlay, openButton } = createOverlayEnvironment();
  require(path.join(__dirname, "..", "js", "createStoryFlow.js"));
  let openedStoryId = "";
  const flow = window.HFCreateStoryFlow.create({
    root: overlay,
    onOpenStory: (storyId) => { openedStoryId = storyId; }
  });

  flow.start({ ageGroup: "7-8", trigger });
  assert.equal(flow.isOpen(), true);
  assert.equal(overlay.dataset.state, "generating");
  assert.equal(openButton.hidden, true);

  flow.setReady({ storyId: "story-42" });
  assert.equal(overlay.dataset.state, "ready");
  assert.equal(openButton.hidden, false);
  openButton.click();
  assert.equal(openedStoryId, "story-42");

  flow.hide();
  assert.equal(flow.isOpen(), false);
  assert.equal(trigger.focused, true);
});
```

- [ ] **Step 2: Run the overlay test to verify the expected failure**

Run:

```bash
node --test tests/create-story-flow.test.js
```

Expected: FAIL with `Cannot find module '../js/createStoryFlow.js'`.

- [ ] **Step 3: Implement the flow controller**

Create `js/createStoryFlow.js` as an IIFE. It must:

```js
window.HFCreateStoryFlow = {
  create({ root, onOpenStory, onRetry }) {
    return { start, setReady, setError, hide, destroy, isOpen };
  }
};
```

`start` adds `body.create-overlay-open`, stores the triggering element, focuses the dialog, renders a task set for the submitted age, and starts only one 12-second phase interval. `setReady` clears that interval, sets `data-state="ready"`, fills the final title and stores the exact `storyId` on the open button. `setError` clears the interval and reveals retry without calling it. `hide` clears all timers/listeners, removes the body class and restores focus. Implement Tab wrapping inside the dialog; Escape may hide the visual overlay only while the generated request is pending or ready and must not abort the request. Handle answer buttons so the first wrong answer announces «Попробуй ещё раз», the second reveals the task hint, correct answers announce «Верно!» and advance after 700 ms, and skip advances immediately.

Add this script after `js/generationTasks.js`:

```html
<script src="js/createStoryFlow.js?v=1"></script>
```

- [ ] **Step 4: Run the overlay test**

Run:

```bash
node --test tests/create-story-flow.test.js
```

Expected: PASS. No timer continues after `hide`, focus returns to the trigger, and the callback receives only `story-42`.

- [ ] **Step 5: Commit the overlay controller**

```bash
git add js/createStoryFlow.js index.html tests/create-story-flow.test.js
git commit -m "feat: add accessible story generation overlay"
```

### Task 4: Replace the create page markup and add approved image assets

**Files:**
- Create: `assets/create/create-page-background.webp`
- Create: `assets/create/create-hero.webp`
- Create: `assets/create/create-hedgehog.webp`
- Create: `assets/create/create-fox-lantern.webp`
- Create: `assets/create/generation-hero.webp`
- Create: `assets/create/generation-modal-background.webp`
- Create: `tests/create-story-markup.test.js`
- Modify: `index.html:242-337,889-900`

**Interfaces:**
- Consumes: source images in `pictures/Создание сказки` and the service ids from Tasks 2–3.
- Produces: semantic elements `#createHero`, `#generatorForm`, `#ageGroupOptions`, `#pageCountOptions`, `#generationOverlay`, `#generationProgress`, `#generationTasksPanel`, and `#generationOpenStoryButton`.

- [ ] **Step 1: Write the failing static-markup and asset test**

Create `tests/create-story-markup.test.js`:

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("create page exposes semantic controls, overlay, and optimized artwork", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  ["createHero", "generatorForm", "ageGroupOptions", "pageCountOptions", "generationOverlay", "generationProgress", "generationTasksPanel", "generationOpenStoryButton"].forEach((id) => {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  });
  ["5-6", "7-8", "9-10"].forEach((value) => assert.match(html, new RegExp(`name=["']ageGroup["'][^>]*value=["']${value}["']`)));
  ["3", "5", "7"].forEach((value) => assert.match(html, new RegExp(`name=["']pageCount["'][^>]*value=["']${value}["']`)));
  ["create-page-background.webp", "create-hero.webp", "create-hedgehog.webp", "create-fox-lantern.webp", "generation-hero.webp"].forEach((file) => {
    assert.equal(fs.existsSync(path.join(__dirname, "..", "assets", "create", file)), true);
  });
});
```

- [ ] **Step 2: Run the markup test to verify the expected failure**

Run:

```bash
node --test tests/create-story-markup.test.js
```

Expected: FAIL because the new ids, age values, page values and `assets/create` files do not yet exist.

- [ ] **Step 3: Audit, copy, optimize, and wire the approved source artwork**

Inspect every source with these commands before assigning it a semantic output name:

```bash
find "pictures/Создание сказки" -maxdepth 1 -type f ! -name ".DS_Store" -exec sips -g pixelWidth -g pixelHeight -g hasAlpha {} \;
```

Copy only the visually matching approved originals to `assets/create` and convert them to WebP with `sips -s format webp`. Preserve alpha for decorative illustrations; do not use any image with a baked-in rectangular background as a decorative transparent layer. Use the shown reference `ChatGPT Image 3 авг. 2026 г., 13_35_35.png` only as a visual guide, never as a site asset.

Replace the current `#generator` contents with semantic hero, form and dialog markup. Keep `topic` `maxlength="80"`, `lesson` `maxlength="160"`, the existing `mood` option values and the `illustrations` value. Set `5` pages as checked. Each large visual option must wrap its own native input:

```html
<label class="create-choice create-age-choice">
  <input type="radio" name="ageGroup" value="5-6" checked>
  <span class="create-choice__check" aria-hidden="true">✓</span>
  <span class="create-choice__copy"><strong>5–6 лет</strong><span>Простые слова, короткие предложения и увлекательные приключения</span></span>
  <img src="assets/create/create-hedgehog.webp" width="160" height="180" alt="">
</label>
```

Place the overlay after `main` with `role="dialog"`, `aria-modal="true"`, `aria-labelledby="generationOverlayTitle"`, hidden by default, one polite live region for status and one assertive live region for task feedback. The dialog includes the five named phase labels, one active task area, skip/next controls, retry, close and `#generationOpenStoryButton`.

- [ ] **Step 4: Run the markup test and build**

Run:

```bash
node --test tests/create-story-markup.test.js
npm run build
```

Expected: PASS. `dist/assets/create` contains the optimized files and the HTML exposes every required semantic hook.

- [ ] **Step 5: Commit markup and imagery**

```bash
git add index.html assets/create tests/create-story-markup.test.js
git commit -m "feat: redesign create story form structure"
```

### Task 5: Connect the real create request lifecycle to the overlay without duplicate generation

**Files:**
- Create: `tests/create-story-app-contract.test.js`
- Modify: `js/app.js:1-90,480-650,1536-1615,1814-1951,2254-2316`

**Interfaces:**
- Consumes: `window.HFCreateStoryFlow.create`, the existing `generateStory(formData)`, `storyService`, `subscriptionService`, and the new form ids.
- Produces: one request for one submit, `flow.start` before the request, `flow.setReady({ storyId })` after persistence, and `openStory(storyId)` only when the ready action is clicked.

- [ ] **Step 1: Write the failing app-flow contract test**

Create `tests/create-story-app-contract.test.js` by reading the app source as a stable contract:

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("app delegates generation lifecycle to the create-story flow", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(source, /HFCreateStoryFlow\.create/);
  assert.match(source, /generationFlow\.start\(\{ ageGroup: getFormValue\(formData, "ageGroup", "5-6"\), trigger: submitButton \}\)/);
  assert.match(source, /generationFlow\.setReady\(\{ storyId: savedStory\.id \}\)/);
  assert.match(source, /onOpenStory: \(storyId\) => openStory\(storyId\)/);
  assert.doesNotMatch(source, /generationTaskTimerId/);
  assert.doesNotMatch(source, /generationMessageTimerId/);
});
```

- [ ] **Step 2: Run the app-flow contract test to verify the expected failure**

Run:

```bash
node --test tests/create-story-app-contract.test.js
```

Expected: FAIL because `app.js` still owns `generationTaskTimerId`, uses the compact wait panel, resets the form immediately and scrolls to the library.

- [ ] **Step 3: Replace the compact wait-panel orchestration with the flow API**

Create one `generationFlow` after DOM lookup:

```js
const generationFlow = window.HFCreateStoryFlow.create({
  root: document.querySelector("#generationOverlay"),
  onOpenStory: (storyId) => openStory(storyId),
  onRetry: () => generatorForm.requestSubmit()
});
```

Remove `buildGenerationTask`, `renderGenerationTask`, `startGenerationWaiting`, `stopGenerationWaiting`, `checkGenerationTaskAnswer` and their event listeners from `app.js`. In `handleGeneratorSubmit`, disable the single submit button before starting, call `generationFlow.start` once after quota validation, preserve `FormData` and never call `generatorForm.reset()` before the user opens the result. After the backend/mock story has been saved and optional illustration request has settled, call `generationFlow.setReady({ storyId: savedStory.id })` instead of scrolling. On the catch path call `generationFlow.setError({ message })`; in `finally`, only re-enable submit when the flow is in the error state or has been hidden, never while a successful story is waiting to be opened.

Keep existing authenticated-backend behaviour: it must never fall back to a browser mock after a server error. Keep current local fallback only for anonymous network/unavailable errors. Track the success event once after saving, not when opening the overlay.

- [ ] **Step 4: Run the app-flow contract test and syntax check**

Run:

```bash
node --test tests/create-story-app-contract.test.js
node --check js/app.js
```

Expected: PASS. `app.js` no longer contains old task timers and delegates ready opening using the saved story id.

- [ ] **Step 5: Commit the integration**

```bash
git add js/app.js tests/create-story-app-contract.test.js
git commit -m "feat: connect story generation overlay to request lifecycle"
```

### Task 6: Implement the watercolor styling and browser-level acceptance tests

**Files:**
- Create: `tests/create-story.spec.mjs`
- Modify: `styles.css:922-1090,2251-2380,4476-end`

**Interfaces:**
- Consumes: the markup ids and classes from Task 4 and the state attributes managed by Task 3.
- Produces: responsive layouts at 320, 375, 430, 768, 1024, 1440 and 1920 px with no horizontal overflow and an accessible keyboard dialog.

- [ ] **Step 1: Write the failing Playwright acceptance tests**

Create `tests/create-story.spec.mjs`:

```js
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/_vercel/insights/script.js", (route) => route.fulfill({ body: "" }));
  await page.addInitScript(() => sessionStorage.setItem("ezhik-intro-seen-v1", "true"));
});

test("create form sends the selected new values and opens the ready story", async ({ page }) => {
  await page.route("**/api/generate-story", async (route) => {
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({ ageGroup: "7-8", mood: "bedtime", pageCount: 7 });
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ story: { id: "story-7", title: "Проверка", ageGroup: "7-8", pages: [{ pageNumber: 1, text: "Текст", sceneTag: "forest_day", imagePrompt: "Кадр" }] }, meta: { mode: "mock" } }) });
  });
  await page.goto("/create");
  await page.getByLabel(/Тема истории/).fill("Потерянная ракушка");
  await page.getByLabel(/Чему должна научить/).fill("Помогать друзьям");
  await page.getByLabel("7–8 лет").check();
  await page.getByLabel(/7 страниц/).check();
  await page.getByRole("button", { name: /Создать сказку/ }).click();
  await expect(page.locator("#generationOverlay")).toBeVisible();
  await expect(page.getByRole("button", { name: /Открыть сказку/ })).toBeVisible();
  await page.getByRole("button", { name: /Открыть сказку/ }).click();
  await expect(page).toHaveURL(/\/stories\/story-7$/);
});

for (const width of [320, 375, 430, 768, 1024, 1440, 1920]) {
  test(`create page has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/create");
    await expect(page.locator("html")).toEvaluate((element) => element.scrollWidth <= window.innerWidth);
  });
}
```

- [ ] **Step 2: Run the browser test to verify the expected failure**

Run:

```bash
npx playwright test tests/create-story.spec.mjs
```

Expected: FAIL because the existing fields use legacy labels and the overlay does not exist.

- [ ] **Step 3: Add the scoped create-page CSS**

Replace the old `.generator-shell`, `.generator-form` and `.generation-wait-panel` presentation with `create-*` styles. Implement a `minmax(0, 1fr)` three-card grid at wide sizes; collapse to one column below 720 px; use `overflow-wrap: anywhere` and `max-width: 100%` on all create content. Make the selected radio style depend on `input:checked + .create-choice__check` and `input:checked ~ .create-choice__copy`; give every native input and button a `:focus-visible` outline in `var(--grass-dark)`.

Add the fixed overlay with a `rgba(47, 42, 30, .22)` backdrop and `backdrop-filter: blur(2px)`. Its dialog has `max-height: min(92vh, 900px)`, `overflow-y: auto`, and `overscroll-behavior: contain`. Display one `.generation-task-card` on mobile; reveal two preview cards only from 960 px. Animation must use a short opacity/transform transition and be disabled in:

```css
@media (prefers-reduced-motion: reduce) {
  .create-page *,
  .generation-overlay * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Run the create-page browser tests and capture reference screenshots**

Run:

```bash
npx playwright test tests/create-story.spec.mjs
npx playwright test tests/homepage-layout.spec.mjs
```

Expected: PASS. The request body contains `7-8` and `7`; the ready action opens only `story-7`; each listed viewport has no overflow; homepage visual tests remain green.

- [ ] **Step 5: Commit the visual system and e2e tests**

```bash
git add styles.css tests/create-story.spec.mjs
git commit -m "feat: style watercolor create story experience"
```

### Task 7: Run the full regression suite and perform final visual verification

**Files:**
- Modify: only files found failing by the commands below, scoped to the create-story feature.
- Verify: `tests/create-story-contract.test.js`, `tests/generation-tasks.test.js`, `tests/create-story-flow.test.js`, `tests/create-story-markup.test.js`, `tests/create-story-app-contract.test.js`, all existing `tests/*.test.js`, and Playwright suites.

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: a buildable static distribution with no create-page console errors, no stale timers, and no regressions to the existing home/intro/game flows.

- [ ] **Step 1: Run all Node unit and contract tests**

```bash
node --test tests/*.test.js
```

Expected: PASS. If a test fails, make the smallest production fix that satisfies that test without weakening its assertion, then rerun the exact failing test followed by this complete command.

- [ ] **Step 2: Build the production distribution**

```bash
npm run build
```

Expected: PASS and `dist/index.html`, `dist/js/generationTasks.js`, `dist/js/createStoryFlow.js`, and `dist/assets/create` exist.

- [ ] **Step 3: Run all Playwright tests**

```bash
npx playwright test
```

Expected: PASS. Browser console output is free of errors and warnings on `/create`, including after an API error and after closing the generation overlay.

- [ ] **Step 4: Inspect the new page at desktop and mobile widths**

Run:

```bash
npx playwright test tests/create-story.spec.mjs
```

Expected: the 1440 px view matches the approved composition (hero text left, illustration right, airy paper card); the 375 px view has text, illustration, then form; decorative characters never cover a field or action.

- [ ] **Step 5: Record only a required verification fix**

Run:

```bash
git status --short
```

Expected: when all prior checks pass without a corrective change, create no extra commit. If a corrective change was necessary, stage only its explicit in-scope path from this list — `index.html`, `styles.css`, `js/app.js`, `js/generationTasks.js`, `js/createStoryFlow.js`, `js/storyService.js`, `api/generate-story.js`, `assets/create`, `tests/create-story-contract.test.js`, `tests/generation-tasks.test.js`, `tests/create-story-flow.test.js`, `tests/create-story-markup.test.js`, `tests/create-story-app-contract.test.js`, or `tests/create-story.spec.mjs` — and commit it as `fix: verify create story page`. Do not stage any pre-existing unrelated user file.
