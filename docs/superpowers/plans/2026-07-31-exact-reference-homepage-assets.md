# Exact Reference Homepage Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the homepage materially closer to the supplied “Живая книга путешествий” reference by using the approved logo and map strip directly, matching its paper surface, lowering the story cards, and rebuilding the games clearing around one purpose-made watercolor illustration without changing existing routes, story content, badges, auth, payments, or game behavior.

**Architecture:** Keep the current static HTML/CSS/vanilla-JavaScript application. Commit optimized static image variants, replace only the homepage presentation layer, retain the journey service and stored progress data for future use, and add one static `/map` placeholder route. No runtime image processing and no new application dependency are introduced.

**Tech Stack:** HTML5, CSS, vanilla JavaScript, Node.js built-in test runner, existing static build script, Vercel rewrites, one-time bundled Python/Pillow asset preparation, imagegen for the single new games illustration.

## Global Constraints

- Work only in the existing `codex/living-travel-book` worktree.
- Preserve the current story data, reader, story generator, library, login, checkout, navigation anchors, and both public games.
- Preserve the exact story badges `История от автора` and `Моя история`.
- Do not add npm or pip packages to the project.
- Do not modify or stage the user-owned untracked experimental game files.
- Use the supplied images as approved source material:
  - logo: `/var/folders/l2/yp9vjwvn5f1gskjcssjlsjdc0000gn/T/codex-clipboard-aa0e9629-4d4c-4794-be5c-f52d651b9ffe.png`
  - map strip: `/var/folders/l2/yp9vjwvn5f1gskjcssjlsjdc0000gn/T/codex-clipboard-5f65c022-9777-4388-943f-150d06073e6d.png`
  - paper reference: `/Users/a1234/Downloads/Живая книга путешествий.png`
- Generate exactly one new illustration for the games section. Do not spend another generation unless the first result is visibly malformed or unusable.
- Every implementation task ends with a focused commit; push only after the full verification task passes.

---

### Task 1: Prepare the approved reference assets without project dependencies

**Files:**
- Create: `assets/journey/reference/brand-lockup.png`
- Create: `assets/journey/reference/brand-lockup.webp`
- Create: `assets/journey/reference/brand-lockup.avif`
- Create: `assets/journey/reference/map-strip.png`
- Create: `assets/journey/reference/map-strip.webp`
- Create: `assets/journey/reference/map-strip.avif`
- Create: `assets/journey/reference/map-copy-mobile.png`
- Create: `assets/journey/reference/map-copy-mobile.webp`
- Create: `assets/journey/reference/map-copy-mobile.avif`
- Create: `assets/journey/reference/map-route-mobile.png`
- Create: `assets/journey/reference/map-route-mobile.webp`
- Create: `assets/journey/reference/map-route-mobile.avif`
- Create: `assets/journey/reference/paper-texture.png`
- Create: `assets/journey/reference/paper-texture.webp`
- Create: `assets/journey/reference/paper-texture.avif`
- Modify: `tests/ui-contract.test.js`

- [ ] **Step 1: Add a failing asset contract test**

Append a test that requires every committed variant and verifies that the old synthetic homepage grain is no longer the intended background:

```js
test("approved reference artwork is committed in fallback and modern formats", () => {
  [
    "brand-lockup",
    "map-strip",
    "map-copy-mobile",
    "map-route-mobile",
    "paper-texture"
  ].forEach((asset) => {
    ["png", "webp", "avif"].forEach((extension) => {
      assert.equal(
        fs.existsSync(path.join(projectRoot, `assets/journey/reference/${asset}.${extension}`)),
        true,
        `${asset}.${extension} must exist`
      );
    });
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
node --test --test-name-pattern="approved reference artwork" tests/*.test.js
```

Expected: FAIL because `assets/journey/reference/` does not exist yet.

- [ ] **Step 3: Prepare the source paths and create optimized variants**

Use the bundled Python runtime and Pillow already available in Codex; do not install anything:

```bash
mkdir -p assets/journey/reference
/Users/a1234/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 - <<'PY'
from pathlib import Path
import unicodedata
from PIL import Image, ImageChops

output = Path("assets/journey/reference")
logo_source = Path("/var/folders/l2/yp9vjwvn5f1gskjcssjlsjdc0000gn/T/codex-clipboard-aa0e9629-4d4c-4794-be5c-f52d651b9ffe.png")
map_source = Path("/var/folders/l2/yp9vjwvn5f1gskjcssjlsjdc0000gn/T/codex-clipboard-5f65c022-9777-4388-943f-150d06073e6d.png")

downloads = Path("/Users/a1234/Downloads")
target_name = unicodedata.normalize("NFC", "Живая книга путешествий.png")
paper_source = next(
    item for item in downloads.iterdir()
    if unicodedata.normalize("NFC", item.name) == target_name
)

def save_variants(image: Image.Image, stem: str, png_optimize: bool = True) -> None:
    rgb = image.convert("RGB")
    rgb.save(output / f"{stem}.png", optimize=png_optimize)
    rgb.save(output / f"{stem}.webp", format="WEBP", quality=88, method=6)
    rgb.save(output / f"{stem}.avif", format="AVIF", quality=62, speed=6)

logo = Image.open(logo_source)
save_variants(logo, "brand-lockup")

map_strip = Image.open(map_source)
save_variants(map_strip, "map-strip")

# The mobile layout uses two readable crops from the same approved strip.
copy_crop = map_strip.crop((0, 0, 520, map_strip.height))
route_crop = map_strip.crop((430, 0, map_strip.width, map_strip.height))
save_variants(copy_crop, "map-copy-mobile")
save_variants(route_crop, "map-route-mobile")

# Sample untouched paper from the supplied concept's clear upper-left margin,
# then mirror it into a larger tile so repetition has no hard vertical seam.
concept = Image.open(paper_source).convert("RGB")
sample = concept.crop((0, 0, 64, 256))
mirror = ImageChops.offset(sample.transpose(Image.Transpose.FLIP_LEFT_RIGHT), 0, 0)
tile = Image.new("RGB", (128, 256))
tile.paste(sample, (0, 0))
tile.paste(mirror, (64, 0))
save_variants(tile, "paper-texture")
PY
```

Visually inspect all prepared files before committing. If the paper sample contains any part of an illustration, move the crop within an untouched paper-only margin of the supplied concept; do not retouch or synthesize the texture.

- [ ] **Step 4: Verify dimensions and file sizes**

Run:

```bash
/Users/a1234/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 - <<'PY'
from pathlib import Path
from PIL import Image

for path in sorted(Path("assets/journey/reference").iterdir()):
    with Image.open(path) as image:
        print(f"{path.name}: {image.width}x{image.height}, {path.stat().st_size // 1024} KB")
PY
```

Expected: all 15 assets open successfully; the WebP/AVIF files are materially smaller than the PNG fallback.

- [ ] **Step 5: Run the focused test and commit**

Run:

```bash
node --test --test-name-pattern="approved reference artwork" tests/*.test.js
git add tests/ui-contract.test.js assets/journey/reference
git commit -m "Add approved homepage reference assets"
```

Expected: PASS.

---

### Task 2: Install the exact logo, paper surface, and lower story-card position

**Files:**
- Modify: `index.html`
- Modify: `styles/homepage-book.css`
- Modify: `tests/ui-contract.test.js`

- [ ] **Step 1: Replace the old homepage contract with failing reference-asset assertions**

Update the homepage tests so they require:

```js
test("homepage uses the approved brand lockup and reference paper", () => {
  const html = read("index.html");
  const css = read("styles/homepage-book.css");

  assert.match(html, /class=["'][^"']*book-brand-lockup/);
  assert.match(html, /assets\/journey\/reference\/brand-lockup\.avif/);
  assert.match(html, /assets\/journey\/reference\/brand-lockup\.webp/);
  assert.match(html, /assets\/journey\/reference\/brand-lockup\.png/);
  assert.match(css, /assets\/journey\/reference\/paper-texture\.avif/);
  assert.doesNotMatch(css, /assets\/journey\/paper-grain\.svg/);
});

test("desktop story cards sit below the hero trail instead of covering the painting", () => {
  const css = read("styles/homepage-book.css");
  assert.match(
    css,
    /@media \(min-width: 1101px\) \{[\s\S]*?\.home-page \.stories-section\s*\{[\s\S]*?margin-top:\s*-20px;/
  );
  assert.doesNotMatch(css, /margin-top:\s*-80px;/);
});
```

Remove or update the former assertions that specifically require the old `book-brand-mark` markup and `margin-top: -80px`.

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run:

```bash
node --test --test-name-pattern="approved brand lockup|story cards sit below" tests/*.test.js
```

Expected: FAIL against the current separate icon/text logo, synthetic SVG grain, and `-80px` overlap.

- [ ] **Step 3: Replace the homepage logo markup**

In `index.html`, replace the contents of `#navTopButton` with one accessible picture:

```html
<a class="nav-brand" id="navTopButton" href="/" aria-label="Ёжик и Лисёнок — на главную">
  <picture class="book-brand-lockup">
    <source type="image/avif" srcset="assets/journey/reference/brand-lockup.avif" />
    <source type="image/webp" srcset="assets/journey/reference/brand-lockup.webp" />
    <img
      src="assets/journey/reference/brand-lockup.png"
      alt="Ёжик и Лисёнок"
      width="832"
      height="212"
      decoding="async"
    />
  </picture>
</a>
```

Keep `#navTopButton` and the `/` route unchanged so existing navigation behavior continues to work.

- [ ] **Step 4: Change only the homepage paper and spacing rules**

In `styles/homepage-book.css`:

- use `image-set()` with AVIF, WebP, and PNG for `.home-page`;
- retain the current fallback paper color under the image;
- make `main` and content sections transparent;
- size the logo from approximately `280px` to `410px` depending on viewport;
- set the desktop `.stories-section` overlap to `-20px`, a 60px downward movement from the current `-80px`;
- keep the current no-overlap/mobile stacking behavior below 1100px;
- remove obsolete homepage-only rules for `.book-brand-mark`, `.brand-leaf`, and the separate brand text without changing non-homepage shared navigation.

The core rules should be:

```css
.home-page {
  background-color: var(--book-paper);
  background-image: image-set(
    url("../assets/journey/reference/paper-texture.avif") type("image/avif"),
    url("../assets/journey/reference/paper-texture.webp") type("image/webp"),
    url("../assets/journey/reference/paper-texture.png") type("image/png")
  );
  background-repeat: repeat;
  background-size: 128px 256px;
}

.home-page .book-brand-lockup {
  display: block;
  width: clamp(280px, 27vw, 410px);
}

.home-page .book-brand-lockup img {
  display: block;
  width: 100%;
  height: auto;
}

@media (min-width: 1101px) {
  .home-page .stories-section {
    margin-top: -20px;
  }
}
```

- [ ] **Step 5: Run tests and inspect desktop/mobile navigation**

Run:

```bash
node --test --test-name-pattern="approved brand lockup|story cards sit below|navigation|homepage book" tests/*.test.js
```

Then verify at 1536px, 1024px, and 390px that the lockup is fully visible, does not distort, and does not collide with menu controls.

- [ ] **Step 6: Commit the presentation change**

Run:

```bash
git add index.html styles/homepage-book.css tests/ui-contract.test.js
git commit -m "Match homepage logo paper and story spacing"
```

---

### Task 3: Replace the interactive homepage map with the approved static strip and add `/map`

**Files:**
- Modify: `index.html`
- Create: `map.html`
- Modify: `styles/homepage-book.css`
- Modify: `vercel.json`
- Modify: `tests/ui-contract.test.js`

- [ ] **Step 1: Replace interactive-map tests with failing static-map contracts**

Remove tests that require `journeyPlaces`, `journeyKeepsakes`, `journeyLandmarks`, `journeyRouteStage`, and the live-position CSS. Replace them with:

```js
test("homepage journey map is the approved static artwork with one real link", () => {
  const html = read("index.html");
  assert.match(html, /id=["']journeyMap["']/);
  assert.match(html, /class=["'][^"']*journey-map__desktop/);
  assert.match(html, /assets\/journey\/reference\/map-strip\.avif/);
  assert.match(html, /assets\/journey\/reference\/map-copy-mobile\.avif/);
  assert.match(html, /assets\/journey\/reference\/map-route-mobile\.avif/);
  assert.match(html, /id=["']journeyMapLink["'][^>]*href=["']\/map["']/);
  assert.equal((html.match(/href=["']\/map["']/g) || []).length, 1);
  ["journeyPlaces", "journeyKeepsakes", "journeyLandmarks", "journeyRouteStage"].forEach((id) => {
    assert.doesNotMatch(html, new RegExp(`id=["']${id}["']`));
  });
});

test("map placeholder is built and routed", () => {
  const page = read("map.html");
  const vercel = JSON.parse(read("vercel.json"));
  assert.match(page, /Карта путешествий скоро откроется/);
  assert.match(page, /href=["']\/["']/);
  assert.ok(
    vercel.rewrites.some((rewrite) => rewrite.source === "/map" && rewrite.destination === "/map.html")
  );
});
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run:

```bash
node --test --test-name-pattern="approved static artwork|map placeholder" tests/*.test.js
```

Expected: FAIL because the homepage still renders the live map and `/map` does not exist.

- [ ] **Step 3: Replace the map section with semantic static artwork**

In `index.html`, replace the current `#journeyMap` contents with:

```html
<section class="journey-map journey-map--reference" id="journeyMap" aria-label="Карта путешествий">
  <picture class="journey-map__desktop">
    <source type="image/avif" srcset="assets/journey/reference/map-strip.avif" />
    <source type="image/webp" srcset="assets/journey/reference/map-strip.webp" />
    <img
      src="assets/journey/reference/map-strip.png"
      alt="Карта путешествий Ежонка и Лисёнка: лес, горы, море, маяк и дом"
      width="2494"
      height="374"
      loading="lazy"
      decoding="async"
    />
  </picture>
  <div class="journey-map__mobile" aria-hidden="true">
    <picture>
      <source type="image/avif" srcset="assets/journey/reference/map-copy-mobile.avif" />
      <source type="image/webp" srcset="assets/journey/reference/map-copy-mobile.webp" />
      <img src="assets/journey/reference/map-copy-mobile.png" alt="" width="520" height="374" loading="lazy" />
    </picture>
    <picture>
      <source type="image/avif" srcset="assets/journey/reference/map-route-mobile.avif" />
      <source type="image/webp" srcset="assets/journey/reference/map-route-mobile.webp" />
      <img src="assets/journey/reference/map-route-mobile.png" alt="" width="2064" height="374" loading="lazy" />
    </picture>
  </div>
  <a class="journey-map__link" id="journeyMapLink" href="/map">Открыть карту</a>
</section>
```

The overlay link must cover only the visible “Открыть карту” text region, have at least a 44×44px hit area, show a keyboard focus ring, and be the only interactive element in the map section. Keep its accessible text in the DOM, but visually hide that duplicate text because the same words are already painted into the supplied image.

- [ ] **Step 4: Replace old map CSS instead of layering new rules over it**

Delete the obsolete rules for the live route, landmarks, places, keepsakes, compass, paws, and progress marker. Add concise rules for:

- edge-to-edge desktop artwork with `width: 100%` and `height: auto`;
- transparent section background and no white box;
- desktop/mobile picture switching at 768px;
- stacked readable mobile crops;
- an absolutely positioned accessible link aligned over the left crop’s printed action;
- `:focus-visible` outline and minimum 44px target.

- [ ] **Step 5: Add the independent placeholder page and Vercel rewrite**

Create `map.html` as a standalone static document using the same paper texture and approved brand lockup. Its visible content must be:

```html
<main class="map-placeholder">
  <p class="journey-meta">Карта путешествий</p>
  <h1>Карта путешествий скоро откроется</h1>
  <p>Мы прокладываем тропинки, расставляем маяки и собираем памятные находки.</p>
  <a class="button primary" href="/">Вернуться на главную</a>
</main>
```

Add this rewrite before catch-all story routes in `vercel.json`:

```json
{ "source": "/map", "destination": "/map.html" }
```

Do not add `/map` to the main navigation or sitemap yet; it is explicitly a temporary destination.

- [ ] **Step 6: Run tests, build, and commit**

Run:

```bash
node --test --test-name-pattern="static artwork|map placeholder|journey service" tests/*.test.js
npm run build
test -f dist/map.html
git add index.html map.html styles/homepage-book.css vercel.json tests/ui-contract.test.js
git commit -m "Replace homepage journey map with reference strip"
```

Expected: all focused tests PASS and `dist/map.html` exists.

---

### Task 4: Create one watercolor games illustration and rebuild the games clearing

**Files:**
- Create: `assets/journey/reference/games-clearing.png`
- Create: `assets/journey/reference/games-clearing.webp`
- Create: `assets/journey/reference/games-clearing.avif`
- Modify: `index.html`
- Modify: `styles/homepage-book.css`
- Modify: `tests/ui-contract.test.js`

- [ ] **Step 1: Add a failing games-art and route contract**

Add:

```js
test("games clearing uses one paper-edge watercolor while preserving both game routes", () => {
  const html = read("index.html");
  assert.match(html, /assets\/journey\/reference\/games-clearing\.avif/);
  assert.match(html, /assets\/journey\/reference\/games-clearing\.webp/);
  assert.match(html, /assets\/journey\/reference\/games-clearing\.png/);
  assert.match(html, /href=["']\/games\/memory["']/);
  assert.match(html, /href=["']\/games\/endless-flight["']/);
  assert.doesNotMatch(html, /assets\/game\/fox-catcher\.webp/);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
node --test --test-name-pattern="games clearing uses one paper-edge watercolor" tests/*.test.js
```

Expected: FAIL because the old fox catcher artwork is still used.

- [ ] **Step 3: Read the image generation instructions and generate exactly one illustration**

Before generating, the main agent must read `/Users/a1234/.codex/skills/.system/imagegen/SKILL.md` completely and follow it. Use the concept screenshot as the visual reference and generate a single transparent/soft-paper-edge watercolor scene with this prompt:

```text
Create a warm hand-painted watercolor illustration for the children’s website “Ёжик и Лисёнок”, matching the attached “Живая книга путешествий” reference: delicate ink-and-watercolor storybook rendering, muted sage, ochre, warm brown and dusty blue, natural paper showing through, fine pencil detail, calm nostalgic mood. Show the familiar little hedgehog seated on grass arranging pairs of memory cards, while the little orange fox beside him holds and gently launches a small paper airplane. Both characters are playing together and smiling softly. Add only a few subtle grass stems, tiny flowers and two loose cards. No text, no UI, no rectangular background, no frame, no hard crop, no glossy 3D, no vector style. Let the watercolor fade naturally into transparency/pale paper on every edge so it blends into the website background. Wide landscape composition, characters centered with breathing room, suitable for the left third of a desktop section and the top of a mobile stack.
```

Use the supplied concept only for style/composition guidance; do not regenerate the logo or map. If the first output is usable, stop after this one generation.

- [ ] **Step 4: Save and optimize the generated illustration**

Save the chosen output as `assets/journey/reference/games-clearing.png`, then create WebP and AVIF variants with the bundled Pillow runtime. Preserve transparency if present:

```bash
/Users/a1234/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 - <<'PY'
from pathlib import Path
from PIL import Image

source = Path("assets/journey/reference/games-clearing.png")
image = Image.open(source)
image.save(source.with_suffix(".webp"), format="WEBP", quality=88, method=6)
image.save(source.with_suffix(".avif"), format="AVIF", quality=62, speed=6)
PY
```

- [ ] **Step 5: Replace the game artwork markup without changing links or copy**

Replace only `.memory-promo__art` with:

```html
<div class="memory-promo__art">
  <picture>
    <source type="image/avif" srcset="assets/journey/reference/games-clearing.avif" />
    <source type="image/webp" srcset="assets/journey/reference/games-clearing.webp" />
    <img
      src="assets/journey/reference/games-clearing.png"
      alt="Ежонок раскладывает карточки мемори, а Лисёнок запускает бумажный самолётик"
      loading="lazy"
      decoding="async"
    />
  </picture>
</div>
```

Keep `#games`, `#memoryPromo`, `data-open-memory`, `/games/memory`, and `/games/endless-flight` exactly intact.

- [ ] **Step 6: Restyle the games section as part of the paper page**

In `styles/homepage-book.css`:

- make `.games-clearing` a transparent two-column grid;
- allocate approximately 36% to the illustration and 64% to copy/cards on desktop;
- remove the current white/blue panel effect;
- give cards the same subtle translucent paper, thin warm line, and restrained shadow as the story cards;
- use sage/rust accents already defined in the homepage tokens;
- prevent headings and body copy from overflowing at 1280px and 1024px;
- stack illustration, copy, and cards below 768px;
- keep every game link target at least 44px high and visibly focusable.

- [ ] **Step 7: Run focused tests and manually enter both games**

Run:

```bash
node --test --test-name-pattern="games clearing|exactly the two production games|lower-section functionality" tests/*.test.js
```

Then verify:

- `/games/memory` opens the existing memory game;
- `/games/endless-flight` opens the existing flight game;
- browser Back returns to `/#games` without layout breakage;
- the illustration has no visible rectangular white background.

- [ ] **Step 8: Commit the games redesign**

Run:

```bash
git add assets/journey/reference/games-clearing.png assets/journey/reference/games-clearing.webp assets/journey/reference/games-clearing.avif index.html styles/homepage-book.css tests/ui-contract.test.js
git commit -m "Blend games clearing into the travel book"
```

---

### Task 5: Full visual regression, functional verification, and PR update

**Files:**
- Modify only if verification exposes a scoped defect: `index.html`
- Modify only if verification exposes a scoped defect: `styles/homepage-book.css`
- Modify only if verification exposes a scoped defect: `map.html`
- Modify only if verification exposes a scoped defect: `tests/ui-contract.test.js`

- [ ] **Step 1: Run the complete automated verification**

Run:

```bash
npm run verify
git status --short
```

Expected: all tests pass, the static build succeeds, and only the known user-owned untracked experimental files remain untracked.

- [ ] **Step 2: Start the production-like static build locally**

Run:

```bash
python3 -m http.server 4173 --directory dist
```

Keep the server running for browser verification.

- [ ] **Step 3: Verify the complete homepage at required viewport widths**

Use browser automation or the in-app browser at:

- 1536×960
- 1440×900
- 1280×800
- 1024×768
- 768×1024
- 390×844

At each width verify:

- the approved logo is fully visible and undistorted;
- the paper texture matches the supplied concept and no white section blocks appear;
- hero art remains centered and dissolves into the page;
- story cards sit lower and no longer obscure the important hero scene;
- card text and badges do not overlap or escape their cards;
- the desktop or mobile map artwork is readable and not stretched;
- only “Открыть карту” is interactive in the map;
- games illustration blends into the paper and both game cards fit;
- there is no horizontal overflow.

- [ ] **Step 4: Verify routes and anchors in a fresh session**

Check:

- first click on `Тарифы` lands at `#pricing`;
- first click on `Для родителей` lands at `#why-read` without breaking layout;
- `/map` shows the placeholder and its return link works;
- `/stories`, `/library`, `/games/memory`, and `/games/endless-flight` still work;
- author stories show `История от автора`;
- user-created stories show `Моя история`;
- login, create-story, and checkout controls still open their existing flows.

- [ ] **Step 5: Fix only verified regressions, rerun everything, and commit if necessary**

For each defect, first add or update a targeted test, confirm it fails, apply the smallest correction, then rerun:

```bash
npm run verify
```

If fixes were needed:

```bash
git add index.html map.html styles/homepage-book.css tests/ui-contract.test.js
git commit -m "Fix reference homepage visual regressions"
```

- [ ] **Step 6: Push the branch and update the existing PR**

Run:

```bash
git push origin codex/living-travel-book
gh pr view 1 --web
```

Confirm that the existing Vercel preview updates and repeat a final smoke check there before reporting the preview URL to the user.
