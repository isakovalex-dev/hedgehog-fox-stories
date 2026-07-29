# Faithful Living Book Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переделать только главную страницу «Ежонок и Лисёнок» в почти буквальное воплощение концепт-макета «Живая книга путешествий», сохранив существующие данные, маршруты, тарифы, авторизацию и две игры.

**Architecture:** Новый визуальный слой изолируется классом `home-page` и отдельным файлом `styles/homepage-book.css`, поэтому внутренние и юридические страницы не меняются. `index.html` получает новую композицию и декоративные слои, а `js/app.js` меняется только в двух местах: передаёт порядковый номер карточке и вычисляет прогресс панорамной карты. Растровые акварели хранятся в `assets/journey/`, а маршрут, компас, лапки и фактура бумаги реализуются лёгкими SVG.

**Tech Stack:** HTML5, CSS Grid/Flexbox/Masking, vanilla JavaScript, SVG, Node.js 20+, `node:test`, существующий статический сборщик, `ffmpeg` для WebP/AVIF без новых npm-зависимостей.

## Global Constraints

- Менять только главную страницу; внутренние страницы чтения, библиотеки, генератора и `about.html` не редизайнить.
- Сохранить текущие маршруты `/stories`, `/create`, `/library`, `/games/memory`, `/games/endless-flight`, а также hash-переходы `#games`, `#why-read`, `#pricing`, `#about`.
- На каждой карточке обязательно показывать `История от автора` для встроенной истории и `Моя история` для истории с `story.source === "user"`.
- Не менять API, Supabase, оплату, авторизацию, содержание историй и правила игр.
- На главной остаются ровно две игры: «Мемори» и «Бесконечный полёт».
- Не добавлять npm-зависимости.
- Суммарный вес загружаемых на первом экране новых AVIF/WebP-файлов не должен превышать 650 КБ на десктопе.
- Проверить ширины 390, 768, 1024 и 1440 px.
- Не добавлять в коммиты существующие экспериментальные файлы `assets/forest-catcher/`, `forest-catcher.html`, `flight.html`, `js/catchGame.js`, `js/forestCatcherGame.js`, `pictures/` и `export_chat_ezhik_lisenok.docx`.

## File Map

### Create

- `styles/homepage-book.css` — изолированный визуальный слой только для главной.
- `assets/journey/hero-coast-480.webp`
- `assets/journey/hero-coast-768.webp`
- `assets/journey/hero-coast-1200.webp`
- `assets/journey/hero-coast-1800.webp`
- `assets/journey/hero-coast-480.avif`
- `assets/journey/hero-coast-768.avif`
- `assets/journey/hero-coast-1200.avif`
- `assets/journey/hero-coast-1800.avif`
- `assets/journey/landmarks/forest.webp`
- `assets/journey/landmarks/forest.avif`
- `assets/journey/landmarks/mountains.webp`
- `assets/journey/landmarks/mountains.avif`
- `assets/journey/landmarks/boat.webp`
- `assets/journey/landmarks/boat.avif`
- `assets/journey/landmarks/lighthouse.webp`
- `assets/journey/landmarks/lighthouse.avif`
- `assets/journey/landmarks/village.webp`
- `assets/journey/landmarks/village.avif`
- `assets/journey/landmarks/heroes.webp`
- `assets/journey/landmarks/heroes.avif`
- `assets/journey/paper-grain.svg`
- `assets/journey/compass.svg`
- `assets/journey/paw-print.svg`

### Modify

- `index.html:34-177` — подключение темы, класс страницы, шапка, hero, истории и карта.
- `js/app.js:1084-1129` — книжная разметка карточки и источник истории.
- `js/app.js:1191-1249` — порядковые номера карточек и прогресс карты.
- `tests/ui-contract.test.js` — DOM-, asset- и source-контракты новой главной.

### Preserve

- `styles/journey-theme.css` — остаётся общей темой внутренних страниц; новые правила главной не добавлять сюда.
- `styles.css` — legacy-стили не расширять, если нужный результат можно получить в `styles/homepage-book.css`.
- `js/storyService.js`, `js/journeyService.js`, `js/subscriptionService.js` — публичные интерфейсы и хранение данных не менять.

---

### Task 1: Изолировать визуальную тему главной

**Files:**
- Create: `styles/homepage-book.css`
- Modify: `index.html:34-41`
- Test: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes: существующие CSS-переменные из `styles/journey-tokens.css`.
- Produces: класс `body.home-page`, подключённый после `styles/journey-theme.css` файл `styles/homepage-book.css`, переменные `--book-*` для следующих задач.

- [ ] **Step 1: Write the failing theme-isolation test**

Добавить в `tests/ui-contract.test.js`:

```js
test("homepage loads an isolated faithful book theme", () => {
  const homepage = read("index.html");
  assert.match(homepage, /<body[^>]*class=["'][^"']*\bhome-page\b/);
  assert.match(homepage, /styles\/homepage-book\.css/);

  ["about.html", "privacy.html", "requisites.html", "terms.html", "404.html"].forEach((file) => {
    assert.doesNotMatch(read(file), /styles\/homepage-book\.css/, `${file} must keep the shared theme`);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test tests/ui-contract.test.js
```

Expected: FAIL with `homepage-book.css` or `home-page` missing.

- [ ] **Step 3: Add the scoped theme hook**

In `index.html`, after `styles/journey-theme.css`, add:

```html
<link rel="stylesheet" href="styles/homepage-book.css?v=1" />
```

Change the body opening tag to:

```html
<body class="journey-theme home-page">
```

Create `styles/homepage-book.css` with the foundation:

```css
.home-page {
  --book-paper: #f4ebd4;
  --book-paper-light: #fbf5e6;
  --book-ink: #344438;
  --book-moss: #536b57;
  --book-gold: #b49a69;
  --book-sea: #afc8c5;
  --book-rust: #b96f47;
  --book-line: rgba(91, 75, 48, 0.24);
  --book-shadow: 0 10px 26px rgba(76, 61, 37, 0.11);
  color: var(--book-ink);
  background-color: var(--book-paper);
  background-image: url("../assets/journey/paper-grain.svg");
  background-size: 420px 420px;
}

.home-page main {
  overflow: clip;
}

.home-page :where(h1, h2, h3) {
  color: var(--book-ink);
}
```

- [ ] **Step 4: Run the focused and full tests**

Run:

```bash
node --test tests/ui-contract.test.js
npm test
```

Expected: all tests PASS. A missing decorative background request is acceptable until Task 2; layout and text must remain visible.

- [ ] **Step 5: Commit**

```bash
git add index.html styles/homepage-book.css tests/ui-contract.test.js
git commit -m "Add isolated homepage book theme"
```

---

### Task 2: Создать и оптимизировать акварельные ассеты

**Files:**
- Create: `assets/journey/hero-coast-*.{webp,avif}`
- Create: `assets/journey/landmarks/*.{webp,avif}`
- Create: `assets/journey/paper-grain.svg`
- Create: `assets/journey/compass.svg`
- Create: `assets/journey/paw-print.svg`
- Test: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes: референс `/Users/a1234/Downloads/Живая книга путешествий.png` и текущий стиль персонажей из `assets/hero-friends.png`.
- Produces: стабильные пути изображений, которые использует `index.html` и `styles/homepage-book.css`.

- [ ] **Step 1: Write the failing asset-contract test**

Добавить:

```js
test("faithful homepage watercolor assets exist", () => {
  const requiredAssets = [
    "assets/journey/hero-coast-480.webp",
    "assets/journey/hero-coast-768.webp",
    "assets/journey/hero-coast-1200.webp",
    "assets/journey/hero-coast-1800.webp",
    "assets/journey/hero-coast-480.avif",
    "assets/journey/hero-coast-768.avif",
    "assets/journey/hero-coast-1200.avif",
    "assets/journey/hero-coast-1800.avif",
    "assets/journey/landmarks/forest.webp",
    "assets/journey/landmarks/forest.avif",
    "assets/journey/landmarks/mountains.webp",
    "assets/journey/landmarks/mountains.avif",
    "assets/journey/landmarks/boat.webp",
    "assets/journey/landmarks/boat.avif",
    "assets/journey/landmarks/lighthouse.webp",
    "assets/journey/landmarks/lighthouse.avif",
    "assets/journey/landmarks/village.webp",
    "assets/journey/landmarks/village.avif",
    "assets/journey/landmarks/heroes.webp",
    "assets/journey/landmarks/heroes.avif",
    "assets/journey/paper-grain.svg",
    "assets/journey/compass.svg",
    "assets/journey/paw-print.svg"
  ];

  requiredAssets.forEach((relativePath) => {
    assert.ok(fs.existsSync(path.join(projectRoot, relativePath)), `Missing ${relativePath}`);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
node --test tests/ui-contract.test.js
```

Expected: FAIL with the first missing `assets/journey/...` file.

- [ ] **Step 3: Generate the hero panorama**

Use the `imagegen` skill with both referenced images:

```text
referenced_image_paths:
- /Users/a1234/Downloads/Живая книга путешествий.png
- /private/tmp/ezhik-i-lisenok-living-travel-book/assets/hero-friends.png
```

Prompt:

```text
Create one wide horizontal watercolor panorama for the hero of a Russian children's story website. Preserve the recognizable hedgehog and fox character design, proportions, pencil outline, warm traditional watercolor texture, and gentle facial expressions from the supplied character illustration. Composition: the hedgehog and fox sit together on a grassy sea cliff in the lower-right third, looking toward a small lighthouse on a rocky distant shore; a slender birch trunk and leafy branches enter from the upper-right edge; pale blue sea, two tiny sailboats, soft clouds and a few distant birds. Keep the left 38 percent quiet and very light so dark-green headline text can sit beside the scene, but do not render any text. Match the supplied concept's old illustrated travel-book mood. Natural pigments, visible paper grain, faded edges dissolving into warm ivory paper. No frame, no oval, no hard rectangular border, no 3D, no digital gloss, no typography.
```

Save the generated PNG to:

```text
/private/tmp/ezhik-journey-assets/hero-coast.png
```

Inspect it with `view_image`. Regenerate before continuing if any hero is duplicated, anatomy is malformed, text appears inside the image, or the left area is not quiet.

- [ ] **Step 4: Generate a six-cell landmark atlas**

Use the concept image and `assets/hero-friends.png` as references and this prompt:

```text
Create a 1536x1024 watercolor asset sheet on uniform warm ivory paper, divided conceptually into a precise 3 columns by 2 rows grid with generous blank margins and no visible grid lines. Each cell contains exactly one isolated children's-book watercolor vignette centered in its cell: top-left a small pine and birch forest; top-center pale blue-gray mountains with a winding path; top-right one tiny wooden sailboat on two soft sea ripples; bottom-left a lighthouse on a low rocky shore; bottom-center a cozy village cottage with trees; bottom-right two separate circular travel medallions, one with the recognizable hedgehog and one with the recognizable fox. Traditional watercolor, delicate graphite outline, subdued moss, ochre, rust and sea-blue palette, visible paper texture, soft feathered edges, no words, no labels, no border, no shadows, no 3D, no objects crossing cell boundaries.
```

Save as:

```text
/private/tmp/ezhik-journey-assets/landmark-atlas.png
```

Normalize the atlas to the required grid:

```bash
mkdir -p /private/tmp/ezhik-journey-assets assets/journey/landmarks
ffmpeg -y -i /private/tmp/ezhik-journey-assets/landmark-atlas.png \
  -vf "scale=1536:1024:force_original_aspect_ratio=decrease,pad=1536:1024:(ow-iw)/2:(oh-ih)/2:color=0xF4EBD4" \
  /private/tmp/ezhik-journey-assets/landmark-atlas-normalized.png
```

- [ ] **Step 5: Crop and encode the landmark assets**

Run:

```bash
ffmpeg -y -i /private/tmp/ezhik-journey-assets/landmark-atlas-normalized.png -vf "crop=512:512:0:0" -c:v libwebp -quality 82 assets/journey/landmarks/forest.webp
ffmpeg -y -i /private/tmp/ezhik-journey-assets/landmark-atlas-normalized.png -vf "crop=512:512:512:0" -c:v libwebp -quality 82 assets/journey/landmarks/mountains.webp
ffmpeg -y -i /private/tmp/ezhik-journey-assets/landmark-atlas-normalized.png -vf "crop=512:512:1024:0" -c:v libwebp -quality 82 assets/journey/landmarks/boat.webp
ffmpeg -y -i /private/tmp/ezhik-journey-assets/landmark-atlas-normalized.png -vf "crop=512:512:0:512" -c:v libwebp -quality 82 assets/journey/landmarks/lighthouse.webp
ffmpeg -y -i /private/tmp/ezhik-journey-assets/landmark-atlas-normalized.png -vf "crop=512:512:512:512" -c:v libwebp -quality 82 assets/journey/landmarks/village.webp
ffmpeg -y -i /private/tmp/ezhik-journey-assets/landmark-atlas-normalized.png -vf "crop=512:512:1024:512" -c:v libwebp -quality 82 assets/journey/landmarks/heroes.webp
```

Create AVIF versions:

```bash
ffmpeg -y -i /private/tmp/ezhik-journey-assets/landmark-atlas-normalized.png -vf "crop=512:512:0:0" -c:v libaom-av1 -crf 36 -still-picture 1 assets/journey/landmarks/forest.avif
ffmpeg -y -i /private/tmp/ezhik-journey-assets/landmark-atlas-normalized.png -vf "crop=512:512:512:0" -c:v libaom-av1 -crf 36 -still-picture 1 assets/journey/landmarks/mountains.avif
ffmpeg -y -i /private/tmp/ezhik-journey-assets/landmark-atlas-normalized.png -vf "crop=512:512:1024:0" -c:v libaom-av1 -crf 36 -still-picture 1 assets/journey/landmarks/boat.avif
ffmpeg -y -i /private/tmp/ezhik-journey-assets/landmark-atlas-normalized.png -vf "crop=512:512:0:512" -c:v libaom-av1 -crf 36 -still-picture 1 assets/journey/landmarks/lighthouse.avif
ffmpeg -y -i /private/tmp/ezhik-journey-assets/landmark-atlas-normalized.png -vf "crop=512:512:512:512" -c:v libaom-av1 -crf 36 -still-picture 1 assets/journey/landmarks/village.avif
ffmpeg -y -i /private/tmp/ezhik-journey-assets/landmark-atlas-normalized.png -vf "crop=512:512:1024:512" -c:v libaom-av1 -crf 36 -still-picture 1 assets/journey/landmarks/heroes.avif
```

Inspect all six files. Each crop must contain only its named vignette; if it does not, regenerate the atlas rather than changing CSS around a bad crop.

- [ ] **Step 6: Encode responsive hero files**

Normalize the hero to `1800x1200`, preserving the full composition:

```bash
ffmpeg -y -i /private/tmp/ezhik-journey-assets/hero-coast.png \
  -vf "scale=1800:1200:force_original_aspect_ratio=decrease,pad=1800:1200:(ow-iw)/2:(oh-ih)/2:color=0xF4EBD4" \
  /private/tmp/ezhik-journey-assets/hero-coast-normalized.png
```

Create WebP:

```bash
for width in 480 768 1200 1800; do
  ffmpeg -y -i /private/tmp/ezhik-journey-assets/hero-coast-normalized.png \
    -vf "scale=${width}:-2" -c:v libwebp -quality 84 \
    "assets/journey/hero-coast-${width}.webp"
done
```

Create AVIF:

```bash
for width in 480 768 1200 1800; do
  ffmpeg -y -i /private/tmp/ezhik-journey-assets/hero-coast-normalized.png \
    -vf "scale=${width}:-2" -c:v libaom-av1 -crf 34 -still-picture 1 \
    "assets/journey/hero-coast-${width}.avif"
done
```

- [ ] **Step 7: Add lightweight SVG assets**

Create `assets/journey/paper-grain.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">
  <filter id="paper">
    <feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="3" seed="17"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="table" tableValues="0 .045"/></feComponentTransfer>
  </filter>
  <rect width="420" height="420" fill="#f4ebd4"/>
  <rect width="420" height="420" filter="url(#paper)" opacity=".7"/>
</svg>
```

Create `assets/journey/paw-print.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <g fill="#9c8155">
    <ellipse cx="24" cy="31" rx="10" ry="8" transform="rotate(-12 24 31)"/>
    <ellipse cx="12" cy="20" rx="4" ry="6" transform="rotate(-24 12 20)"/>
    <ellipse cx="22" cy="14" rx="4" ry="6" transform="rotate(-8 22 14)"/>
    <ellipse cx="33" cy="16" rx="4" ry="6" transform="rotate(12 33 16)"/>
    <ellipse cx="39" cy="26" rx="4" ry="6" transform="rotate(26 39 26)"/>
  </g>
</svg>
```

Create `assets/journey/compass.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <g fill="none" stroke="#6f6046" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="80" cy="80" r="54" stroke-width="2"/>
    <circle cx="80" cy="80" r="7" stroke-width="2"/>
    <path d="M80 18 91 69 80 80 69 69Z" fill="#b49a69" stroke-width="1.5"/>
    <path d="m80 142-11-51 11-11 11 11Z" stroke-width="1.5"/>
    <path d="m18 80 51-11 11 11-11 11Z" stroke-width="1.5"/>
    <path d="m142 80-51 11-11-11 11-11Z" stroke-width="1.5"/>
    <path d="M44 44 116 116M116 44 44 116" stroke-width="1" opacity=".55"/>
  </g>
  <g fill="#5d513c" font-family="Georgia,serif" font-size="13" text-anchor="middle">
    <text x="80" y="12">N</text><text x="80" y="158">S</text>
    <text x="8" y="84">W</text><text x="152" y="84">E</text>
  </g>
</svg>
```

- [ ] **Step 8: Verify size budget and tests**

Run:

```bash
du -ch assets/journey/hero-coast-1800.avif assets/journey/hero-coast-1800.webp | tail -1
node --test tests/ui-contract.test.js
npm run build
```

Expected: the 1800 px AVIF plus WebP total is below 650 KB, the asset test passes, and all files appear under `dist/assets/journey/`.

- [ ] **Step 9: Commit**

```bash
git add assets/journey tests/ui-contract.test.js
git commit -m "Add watercolor assets for living book homepage"
```

---

### Task 3: Rebuild the header and hero as one illustrated page

**Files:**
- Modify: `index.html:34-122`
- Modify: `styles/homepage-book.css`
- Test: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes: `body.home-page`, `--book-*`, `hero-coast-*`, `paw-print.svg`, existing button IDs.
- Produces: `.book-brand-mark`, `.book-hero-picture`, `.book-route--hero`; keeps `#heroTitle`, `#chooseStoryButton`, `#openGeneratorButton`, `#navTopButton`.

- [ ] **Step 1: Write the failing hero contract**

Add:

```js
test("faithful homepage hero keeps actions and watercolor structure", () => {
  const html = read("index.html");
  assert.match(html, /class=["'][^"']*book-brand-mark/);
  assert.match(html, /class=["'][^"']*book-hero-picture/);
  assert.match(html, /hero-coast-1800\.avif/);
  assert.match(html, /class=["'][^"']*book-route--hero/);
  ["chooseStoryButton", "openGeneratorButton"].forEach((id) => {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  });
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/ui-contract.test.js
```

Expected: FAIL because the book-specific hero classes are absent.

- [ ] **Step 3: Add the brand vignette and responsive hero picture**

Inside `#navTopButton`, before the text, add:

```html
<picture class="book-brand-picture">
  <source type="image/avif" srcset="assets/journey/landmarks/heroes.avif" />
  <img
    class="book-brand-mark"
    src="assets/journey/landmarks/heroes.webp"
    alt=""
    width="56"
    height="56"
  />
</picture>
```

Replace the existing hero `<picture>` with:

```html
<picture class="book-hero-picture">
  <source
    type="image/avif"
    srcset="
      assets/journey/hero-coast-480.avif 480w,
      assets/journey/hero-coast-768.avif 768w,
      assets/journey/hero-coast-1200.avif 1200w,
      assets/journey/hero-coast-1800.avif 1800w
    "
    sizes="(max-width: 720px) 100vw, (max-width: 1100px) 58vw, 900px"
  />
  <source
    type="image/webp"
    srcset="
      assets/journey/hero-coast-480.webp 480w,
      assets/journey/hero-coast-768.webp 768w,
      assets/journey/hero-coast-1200.webp 1200w,
      assets/journey/hero-coast-1800.webp 1800w
    "
    sizes="(max-width: 720px) 100vw, (max-width: 1100px) 58vw, 900px"
  />
  <img
    class="hero-illustration"
    src="assets/journey/hero-coast-1200.webp"
    alt="Ежонок и Лисёнок смотрят на море и маяк с высокого берега"
    width="1800"
    height="1200"
    fetchpriority="high"
    decoding="async"
  />
</picture>
```

Keep the existing hero container background set to `assets/hero-friends.png` so it remains a visual fallback.

- [ ] **Step 4: Replace the decorative trail markup**

Replace `.journey-trail--hero` contents with:

```html
<div class="book-route book-route--hero journey-trail journey-trail--hero" aria-hidden="true">
  <svg viewBox="0 0 1200 110" preserveAspectRatio="none">
    <path d="M0 58 C120 20 220 96 348 53 S575 34 700 65 930 88 1200 35" />
  </svg>
  <img src="assets/journey/paw-print.svg" alt="" />
  <img src="assets/journey/paw-print.svg" alt="" />
  <img src="assets/journey/paw-print.svg" alt="" />
</div>
```

- [ ] **Step 5: Implement the faithful hero styles**

Add rules scoped under `.home-page`:

```css
.home-page .site-nav {
  border-bottom-color: rgba(91, 75, 48, 0.13);
  background: rgba(244, 235, 212, 0.9);
  box-shadow: none;
  backdrop-filter: blur(12px);
}

.home-page .book-brand-mark {
  width: 54px;
  height: 54px;
  margin-right: 0.55rem;
  object-fit: cover;
  border-radius: 50%;
  mix-blend-mode: multiply;
}

.home-page .book-brand-picture {
  display: contents;
}

.home-page .journey-hero {
  grid-template-columns: minmax(390px, 0.76fr) minmax(560px, 1.24fr);
  gap: 0;
  width: min(100%, 1500px);
  min-height: 690px;
  padding: clamp(3rem, 7vw, 6.5rem) clamp(1.5rem, 5vw, 4.5rem) 6rem;
  overflow: visible;
}

.home-page .journey-hero__copy {
  z-index: 3;
  max-width: 610px;
}

.home-page .journey-hero h1 {
  max-width: 650px;
  color: var(--book-ink);
  font-size: clamp(4.6rem, 6.8vw, 7rem);
  line-height: 0.88;
}

.home-page .journey-hero__art {
  width: 112%;
  margin-left: -12%;
  overflow: visible;
  border-radius: 0;
  background: url("../assets/hero-friends.png") center / contain no-repeat;
  -webkit-mask-image: radial-gradient(ellipse 73% 68% at 58% 52%, #000 64%, transparent 100%);
  mask-image: radial-gradient(ellipse 73% 68% at 58% 52%, #000 64%, transparent 100%);
}

.home-page .journey-hero__art::after {
  display: none;
}

.home-page .book-hero-picture,
.home-page .book-hero-picture img {
  display: block;
  width: 100%;
  height: auto;
  mix-blend-mode: multiply;
}

.home-page .hero-actions .primary {
  background: var(--book-moss);
}

.home-page .hero-actions .secondary {
  border-style: dashed;
  border-color: var(--book-gold);
  background: rgba(251, 245, 230, 0.56);
}

.home-page .journey-hero__quiet-actions {
  display: none;
}

.home-page .book-route {
  position: absolute;
  pointer-events: none;
}

.home-page .book-route svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.home-page .book-route path {
  fill: none;
  stroke: var(--book-gold);
  stroke-width: 2;
  stroke-dasharray: 7 7;
  vector-effect: non-scaling-stroke;
}

.home-page .book-route--hero {
  right: 2rem;
  bottom: 1rem;
  left: 2rem;
  z-index: 2;
  height: 105px;
  border: 0;
  transform: none;
}

.home-page .book-route--hero img {
  position: absolute;
  width: 34px;
  height: 34px;
  opacity: 0.72;
}

.home-page .book-route--hero img:nth-of-type(1) { left: 10%; top: 30%; transform: rotate(-18deg); }
.home-page .book-route--hero img:nth-of-type(2) { left: 39%; top: 43%; transform: rotate(12deg); }
.home-page .book-route--hero img:nth-of-type(3) { left: 72%; top: 52%; transform: rotate(-10deg); }
```

- [ ] **Step 6: Verify at desktop and mobile**

Run the site:

```bash
npm run build
python3 -m http.server 8031 --directory dist
```

At 1440 px verify: no oval, no hard image edge, headline is at most three lines, action IDs still work, hero route is visible. At 390 px verify: illustration appears above the copy and no horizontal overflow exists.

- [ ] **Step 7: Run tests and commit**

```bash
npm test
git add index.html styles/homepage-book.css tests/ui-contract.test.js
git commit -m "Rebuild homepage hero as watercolor book spread"
```

---

### Task 4: Convert homepage stories to horizontal book cards

**Files:**
- Modify: `index.html:124-143`
- Modify: `js/app.js:1084-1129`
- Modify: `js/app.js:1191-1197`
- Modify: `styles/homepage-book.css`
- Test: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes: `story.source`, `story.age`, `story.time`, `story.tags`, existing `data-read`, `data-like`, `data-delete-story`.
- Produces: `options.sequence`, `.story-card__book-meta`, `.story-card__sequence`, `.story-card__arrow`; library rendering remains unchanged because it does not pass `sequence`.

- [ ] **Step 1: Write the failing story-card contract**

Add:

```js
test("homepage story cards expose book metadata and exact source labels", () => {
  const source = read("js/app.js");
  assert.match(source, /options\.sequence/);
  assert.match(source, /story-card__book-meta/);
  assert.match(source, /story-card__sequence/);
  assert.match(source, /story-card__arrow/);
  assert.match(source, />Моя история</);
  assert.match(source, />История от автора</);
  assert.match(source, /renderStoryCard\(story,\s*\{\s*sequence:\s*index\s*\+\s*1\s*\}\)/);
  assert.match(read("index.html"), /class=["'][^"']*book-route--stories/);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/ui-contract.test.js
```

Expected: FAIL on `options.sequence`.

- [ ] **Step 3: Add homepage-only card metadata**

At the beginning of `renderStoryCard` add:

```js
const homepageSequence = Number.isInteger(options.sequence) ? options.sequence : null;
const sequenceLabel = homepageSequence
  ? String(homepageSequence).padStart(2, "0")
  : "";
const primaryTagKey = story.tags?.find((tag) => moodLabels[tag]) || "";
const primaryTag = moodLabels[primaryTagKey] || story.mood || "история";
```

Keep the exact source mapping:

```js
const sourceBadge = story.source === "user"
  ? `<span class="story-source-badge story-source-badge--user"><span class="story-source-badge__icon" aria-hidden="true">✎</span><span>Моя история</span></span>`
  : `<span class="story-source-badge story-source-badge--author"><span class="story-source-badge__icon" aria-hidden="true">✦</span><span>История от автора</span></span>`;
```

After `illustrateButton`, add exact home/library fragments:

```js
const homepageMeta = homepageSequence
  ? `
  <div class="story-card__book-meta">
    <span class="story-card__sequence">№ ${sequenceLabel}</span>
    <span aria-hidden="true">•</span>
    <span>${escapeHtml(story.time)}</span>
  </div>
`
  : "";
const standardMeta = homepageSequence
  ? ""
  : `
    <p class="story-place"><span aria-hidden="true">⌖</span> ${escapeHtml(story.journeyPlaceLabel || "Неизведанная тропа")}</p>
    <div class="story-meta">
      <span class="pill">${escapeHtml(story.age)} лет</span>
      <span class="pill">${escapeHtml(story.time)}</span>
      ${renderLikeButton(story, "compact")}
    </div>
  `;
const cardFooter = homepageSequence
  ? `
  <div class="story-card__source-row">
    ${sourceBadge}
    ${renderLikeButton(story, "compact")}
  </div>
  <div class="story-card__book-footer">
    <span>${escapeHtml(story.age)} лет</span>
    <span aria-hidden="true">•</span>
    <span>${escapeHtml(primaryTag)}</span>
    <a
      class="story-card__arrow"
      href="/stories/${encodeURIComponent(story.id)}"
      data-read="${escapeAttribute(story.id)}"
      aria-label="Читать историю «${escapeAttribute(story.title)}»"
    >→</a>
  </div>
`
  : `
  <div class="card-footer">
    <div class="card-actions">
      <button class="button primary" data-read="${escapeAttribute(story.id)}" type="button">Читать</button>
      ${illustrateButton}
      ${deleteButton}
    </div>
    ${sourceBadge}
  </div>
  `;
```

Replace the current `.story-content` block in the returned template with:

```js
<div class="story-content">
  ${homepageMeta}
  <h3><a class="story-title-link" href="/stories/${encodeURIComponent(story.id)}" data-read="${escapeAttribute(story.id)}">${escapeHtml(story.title)}</a></h3>
  ${standardMeta}
  <p>${escapeHtml(story.description)}</p>
  ${cardFooter}
</div>
```

Do not remove `data-like`, `data-delete-story`, `data-illustrate-story`, `data-story-card`, or the title link.

- [ ] **Step 4: Pass sequence only from the homepage renderer**

Change:

```js
storyList.innerHTML = visibleStories.map((story) => renderStoryCard(story)).join("");
```

to:

```js
storyList.innerHTML = visibleStories
  .map((story, index) => renderStoryCard(story, { sequence: index + 1 }))
  .join("");
```

Leave `renderLibrary()` calling `renderStoryCard(story, { canDelete: true })`.

- [ ] **Step 5: Continue the route after the story cards**

Immediately after `#storyList`, add:

```html
<div class="book-route book-route--stories" aria-hidden="true">
  <svg viewBox="0 0 1200 95" preserveAspectRatio="none">
    <path d="M0 52 C170 98 300 4 470 46 S760 92 905 38 1070 18 1200 58" />
  </svg>
  <img src="assets/journey/paw-print.svg" alt="" />
  <img src="assets/journey/paw-print.svg" alt="" />
  <img src="assets/journey/paw-print.svg" alt="" />
</div>
```

- [ ] **Step 6: Add horizontal card styles scoped to the homepage list**

```css
.home-page .stories-section {
  position: relative;
  width: min(100%, 1500px);
  padding-top: 1rem;
  padding-bottom: 7rem;
}

.home-page .stories-section .story-list {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.1rem;
  max-width: none;
}

.home-page .stories-section .story-card {
  display: grid;
  grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr);
  min-height: 230px;
  padding: 0.55rem;
  overflow: hidden;
  border: 1px solid var(--book-line);
  border-radius: 12px;
  background: rgba(251, 245, 230, 0.82);
  box-shadow: var(--book-shadow);
}

.home-page .stories-section .story-art {
  height: 100%;
  min-height: 215px;
  aspect-ratio: auto;
  border: 0;
  border-radius: 8px;
}

.home-page .stories-section .story-content {
  min-width: 0;
  padding: 0.55rem 0.7rem 0.45rem 0.9rem;
}

.home-page .story-card__book-meta,
.home-page .story-card__book-footer {
  display: flex;
  gap: 0.55rem;
  align-items: center;
  color: var(--book-ink);
  font: 0.66rem/1.3 var(--font-meta);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.home-page .story-card__source-row {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.home-page .stories-section .story-content h3 {
  margin: 0.65rem 0;
  font-size: clamp(1.55rem, 2vw, 2.05rem);
  line-height: 0.98;
}

.home-page .stories-section .story-content > p:not(.story-place) {
  min-height: 4.2em;
  font-size: 0.78rem;
  -webkit-line-clamp: 3;
}

.home-page .story-card__book-footer {
  margin-top: auto;
}

.home-page .story-card__arrow {
  display: grid;
  width: 36px;
  height: 36px;
  margin-left: auto;
  place-items: center;
  color: var(--book-ink);
  font: 1.55rem/1 var(--font-display);
  text-decoration: none;
}

.home-page .stories-section .story-source-badge {
  border: 0;
  background: transparent;
  color: var(--book-moss);
  white-space: normal;
}

.home-page .book-route--stories {
  right: clamp(1rem, 5vw, 4rem);
  bottom: 0;
  left: clamp(1rem, 5vw, 4rem);
  height: 95px;
}

.home-page .book-route--stories img {
  position: absolute;
  width: 30px;
  height: 30px;
  opacity: 0.66;
}

.home-page .book-route--stories img:nth-of-type(1) { left: 18%; top: 53%; transform: rotate(14deg); }
.home-page .book-route--stories img:nth-of-type(2) { left: 56%; top: 34%; transform: rotate(-12deg); }
.home-page .book-route--stories img:nth-of-type(3) { left: 84%; top: 42%; transform: rotate(18deg); }
```

- [ ] **Step 7: Verify interaction and responsive card geometry**

At 1440 px verify three cards per row and no text overflow. Click empty card space, title, arrow and like separately. At 768 px verify horizontal scrolling with visible next-card edge. At 390 px verify one vertical card per row.

- [ ] **Step 8: Run tests and commit**

```bash
npm test
git add index.html js/app.js styles/homepage-book.css tests/ui-contract.test.js
git commit -m "Restyle homepage stories as book cards"
```

---

### Task 5: Build the panoramic interactive journey map

**Files:**
- Modify: `index.html:144-157`
- Modify: `js/app.js:1199-1257`
- Modify: `styles/homepage-book.css`
- Test: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes: `journeyPlaces`, `journeyService.getDiscoveries()`, `#journeyPlaces`, `#journeyKeepsakes`.
- Produces: `#journeyLandmarks`, `#journeyCurrentHeroes`, `.journey-map__compass`, CSS custom property `--journey-progress` in range `0..1`.

- [ ] **Step 1: Write the failing panoramic-map contract**

Add:

```js
test("homepage journey map exposes watercolor landmarks and live position", () => {
  const html = read("index.html");
  const source = read("js/app.js");
  ["journeyLandmarks", "journeyCurrentHeroes"].forEach((id) => {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  });
  assert.match(html, /class=["'][^"']*journey-map__compass/);
  assert.match(source, /--journey-progress/);
  assert.match(source, /discoveredStoryIds/);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/ui-contract.test.js
```

Expected: FAIL because `journeyLandmarks` is missing.

- [ ] **Step 3: Add static decorative layers without replacing live controls**

Inside `#journeyMap`, after `.journey-map__intro` and before `#journeyPlaces`, add:

```html
<div class="journey-landmarks" id="journeyLandmarks" aria-hidden="true">
  <picture><source type="image/avif" srcset="assets/journey/landmarks/forest.avif" /><img class="journey-landmark journey-landmark--forest" src="assets/journey/landmarks/forest.webp" alt="" loading="lazy" /></picture>
  <picture><source type="image/avif" srcset="assets/journey/landmarks/mountains.avif" /><img class="journey-landmark journey-landmark--mountains" src="assets/journey/landmarks/mountains.webp" alt="" loading="lazy" /></picture>
  <picture><source type="image/avif" srcset="assets/journey/landmarks/boat.avif" /><img class="journey-landmark journey-landmark--boat" src="assets/journey/landmarks/boat.webp" alt="" loading="lazy" /></picture>
  <picture><source type="image/avif" srcset="assets/journey/landmarks/lighthouse.avif" /><img class="journey-landmark journey-landmark--lighthouse" src="assets/journey/landmarks/lighthouse.webp" alt="" loading="lazy" /></picture>
  <picture><source type="image/avif" srcset="assets/journey/landmarks/village.avif" /><img class="journey-landmark journey-landmark--village" src="assets/journey/landmarks/village.webp" alt="" loading="lazy" /></picture>
  <picture>
    <source type="image/avif" srcset="assets/journey/landmarks/heroes.avif" />
    <img
      class="journey-current-heroes"
      id="journeyCurrentHeroes"
      src="assets/journey/landmarks/heroes.webp"
      alt=""
      loading="lazy"
    />
  </picture>
  <img class="journey-map__compass" src="assets/journey/compass.svg" alt="" loading="lazy" />
</div>
<svg class="journey-map__route" viewBox="0 0 1200 270" preserveAspectRatio="none" aria-hidden="true">
  <path d="M30 170 C155 70 230 245 350 145 S545 50 650 155 835 250 925 112 1090 70 1170 145" />
</svg>
```

Keep `#journeyPlaces` and `#journeyKeepsakes` unchanged in the DOM.

- [ ] **Step 4: Calculate the live map position**

In `renderJourney`, after `discoveredStoryIds`, add:

```js
const furthestDiscoveredIndex = journeyPlaces.reduce((furthest, place, index) => {
  return discoveredStoryIds.has(place.storyId) ? index : furthest;
}, -1);
const journeyProgress = furthestDiscoveredIndex < 0
  ? 0
  : furthestDiscoveredIndex / Math.max(journeyPlaces.length - 1, 1);

journeyMap?.style.setProperty("--journey-progress", journeyProgress.toFixed(3));
```

This computation does not alter storage and always produces a value from `0` to `1`.

- [ ] **Step 5: Implement the panoramic map styles**

```css
.home-page .journey-map {
  position: relative;
  display: grid;
  grid-template-columns: minmax(230px, 0.35fr) minmax(0, 1.65fr);
  min-height: 500px;
  width: min(100%, 1500px);
  margin: clamp(4rem, 7vw, 7rem) auto;
  padding: 2rem clamp(1.5rem, 5vw, 4.5rem);
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.home-page .journey-map::before {
  display: none;
}

.home-page .journey-map__intro {
  grid-column: 1;
  align-self: center;
}

.home-page .journey-map__route {
  position: absolute;
  right: 5%;
  bottom: 3.5rem;
  left: 25%;
  z-index: 1;
  width: 70%;
  height: 290px;
}

.home-page .journey-map__route path {
  fill: none;
  stroke: var(--book-gold);
  stroke-width: 2.2;
  stroke-dasharray: 7 7;
  vector-effect: non-scaling-stroke;
}

.home-page .journey-landmarks {
  position: absolute;
  inset: 4rem 3% 0 24%;
  z-index: 0;
  pointer-events: none;
}

.home-page .journey-landmarks picture {
  display: contents;
}

.home-page .journey-landmark,
.home-page .journey-current-heroes {
  position: absolute;
  width: clamp(110px, 12vw, 190px);
  mix-blend-mode: multiply;
  -webkit-mask-image: radial-gradient(ellipse, #000 55%, transparent 78%);
  mask-image: radial-gradient(ellipse, #000 55%, transparent 78%);
}

.home-page .journey-landmark--forest { left: 0; bottom: 22%; }
.home-page .journey-landmark--mountains { left: 22%; bottom: 0; }
.home-page .journey-landmark--boat { left: 43%; top: 12%; width: clamp(80px, 8vw, 125px); }
.home-page .journey-landmark--lighthouse { right: 1%; top: 0; }
.home-page .journey-landmark--village { right: 8%; bottom: 0; }

.home-page .journey-current-heroes {
  left: calc(7% + var(--journey-progress, 0) * 72%);
  top: 14%;
  width: clamp(100px, 9vw, 145px);
  transform: translateX(-50%);
  transition: left 420ms ease;
}

.home-page .journey-map__compass {
  position: absolute;
  right: 0;
  bottom: 8%;
  width: clamp(90px, 9vw, 145px);
  opacity: 0.82;
}

.home-page .journey-places {
  grid-column: 2;
  z-index: 3;
  min-height: 360px;
  padding: 1rem 3rem;
}

.home-page .journey-places::before {
  display: none;
}

.home-page .journey-place__mark {
  background: rgba(251, 245, 230, 0.86);
  border-color: var(--book-gold);
  box-shadow: 0 6px 16px rgba(76, 61, 37, 0.1);
}

.home-page .journey-keepsakes {
  grid-column: 1 / -1;
  width: min(760px, 100%);
  margin: 1rem auto 0;
  padding: 0.8rem 0;
  border: 0;
  border-top: 1px solid var(--book-line);
  border-radius: 0;
  background: transparent;
}
```

- [ ] **Step 6: Verify empty and discovered states**

In a fresh profile verify progress `0` and the empty keepsake message. Complete one story and verify the heroes marker moves, one place switches to `Исследовано`, and one keepsake appears without changing the map geometry.

- [ ] **Step 7: Run tests and commit**

```bash
npm test
git add index.html js/app.js styles/homepage-book.css tests/ui-contract.test.js
git commit -m "Build panoramic interactive journey map"
```

---

### Task 6: Unify games, reading values, pricing and project sections

**Files:**
- Modify: `styles/homepage-book.css`
- Test: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes: existing IDs `#games`, `#why-read`, `#pricing`, `#about` and all current click handlers.
- Produces: a quieter lower-page book layout; no HTML or JavaScript contract changes.

- [ ] **Step 1: Write the lower-section preservation test**

Add:

```js
test("homepage book layout preserves and restyles lower-section functionality", () => {
  const html = read("index.html");
  const css = read("styles/homepage-book.css");
  ["games", "why-read", "pricing", "about"].forEach((id) => {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  });
  assert.match(html, /href=["']\/games\/memory["']/);
  assert.match(html, /href=["']\/games\/endless-flight["']/);
  assert.match(html, /data-start-checkout/);
  assert.match(html, /href=["']about\.html["']/);
  assert.match(css, /\.home-page\s+:where\(\.games-clearing,\s*\.reading-values,\s*\.pricing-section\)/);
  assert.match(css, /\.home-page\s+\.game-pass/);
  assert.match(css, /\.home-page\s+\.pricing-card/);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/ui-contract.test.js
```

Expected: FAIL because the book-specific lower-section CSS selectors are absent. Existing HTML assertions must remain green.

- [ ] **Step 3: Add book-style separators and quieter surfaces**

Add:

```css
.home-page :where(.games-clearing, .reading-values, .pricing-section) {
  border: 0;
  border-top: 1px solid var(--book-line);
  border-bottom: 1px solid var(--book-line);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.home-page .games-clearing {
  position: relative;
  width: min(100%, 1320px);
}

.home-page .game-pass {
  border-color: var(--book-line);
  border-radius: 10px;
  background: rgba(251, 245, 230, 0.72);
  box-shadow: 0 6px 18px rgba(76, 61, 37, 0.07);
}

.home-page .game-pass--flight {
  background:
    linear-gradient(145deg, rgba(175, 200, 197, 0.34), rgba(251, 245, 230, 0.78));
}

.home-page .reading-values {
  width: min(100%, 1320px);
}

.home-page .value-item {
  position: relative;
  padding-inline: 1rem;
}

.home-page .value-item + .value-item::before {
  position: absolute;
  top: 8%;
  bottom: 8%;
  left: 0;
  width: 1px;
  background: var(--book-line);
  content: "";
}

.home-page .pricing-section {
  width: min(100%, 1180px);
}

.home-page .pricing-card {
  border-color: var(--book-line);
  border-radius: 10px;
  background: rgba(251, 245, 230, 0.64);
  box-shadow: none;
}

.home-page .about-section {
  border-top: 1px solid var(--book-line);
}

.home-page .character-card {
  border-color: var(--book-line);
  border-radius: 8px;
  background: rgba(251, 245, 230, 0.48);
}
```

- [ ] **Step 4: Verify all preserved interactions**

Click both games, return to the homepage, click `Тарифы`, click `Для родителей`, open `about.html`, and invoke the checkout button while unauthenticated. Verify the same routes and status messages as before.

- [ ] **Step 5: Run tests and commit**

```bash
npm test
git add styles/homepage-book.css tests/ui-contract.test.js
git commit -m "Unify homepage sections with book styling"
```

---

### Task 7: Complete responsive, accessibility and reduced-motion behavior

**Files:**
- Modify: `styles/homepage-book.css`
- Modify: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes: all classes from Tasks 1–6.
- Produces: verified layouts at 390, 768, 1024 and 1440 px; no horizontal overflow; keyboard focus and reduced motion.

- [ ] **Step 1: Add a CSS contract for required breakpoints and reduced motion**

Add:

```js
test("homepage book theme defines responsive and reduced-motion fallbacks", () => {
  const css = read("styles/homepage-book.css");
  ["1100px", "768px", "520px"].forEach((breakpoint) => {
    assert.match(css, new RegExp(`@media\\s*\\(max-width:\\s*${breakpoint.replace(".", "\\.")}\\)`));
  });
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /scroll-snap-type/);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/ui-contract.test.js
```

Expected: FAIL until all breakpoint blocks exist.

- [ ] **Step 3: Add tablet and mobile rules**

Append:

```css
@media (max-width: 1100px) {
  .home-page .journey-hero {
    grid-template-columns: minmax(310px, 0.85fr) minmax(430px, 1.15fr);
    min-height: 620px;
  }

  .home-page .journey-hero h1 {
    font-size: clamp(3.8rem, 7vw, 5.4rem);
  }

  .home-page .stories-section .story-list {
    display: grid;
    grid-auto-columns: minmax(430px, 72vw);
    grid-auto-flow: column;
    grid-template-columns: none;
    overflow-x: auto;
    padding-bottom: 1rem;
    scroll-snap-type: x mandatory;
  }

  .home-page .stories-section .story-card {
    scroll-snap-align: start;
  }
}

@media (max-width: 768px) {
  .home-page .journey-hero {
    grid-template-columns: 1fr;
    padding-top: 1rem;
  }

  .home-page .journey-hero__art {
    order: -1;
    width: 116%;
    margin: 0 -8% -10%;
  }

  .home-page .journey-hero__copy {
    width: min(100%, 560px);
    margin-inline: auto;
    text-align: center;
  }

  .home-page .hero-actions,
  .home-page .journey-hero__quiet-actions {
    justify-content: center;
  }

  .home-page .journey-map {
    grid-template-columns: 1fr;
    min-height: 760px;
  }

  .home-page .journey-map__intro,
  .home-page .journey-places {
    grid-column: 1;
  }

  .home-page .journey-landmarks,
  .home-page .journey-map__route {
    opacity: 0.52;
  }

  .home-page .value-item + .value-item::before {
    display: none;
  }
}

@media (max-width: 520px) {
  .home-page .book-brand-mark {
    width: 44px;
    height: 44px;
  }

  .home-page .journey-hero h1 {
    font-size: clamp(3.15rem, 15vw, 4.2rem);
  }

  .home-page .book-route--hero {
    right: 0.5rem;
    left: 0.5rem;
  }

  .home-page .stories-section .story-list {
    display: grid;
    grid-auto-flow: row;
    grid-template-columns: 1fr;
    overflow: visible;
  }

  .home-page .stories-section .story-card {
    grid-template-columns: 1fr;
  }

  .home-page .stories-section .story-art {
    min-height: 210px;
    aspect-ratio: 4 / 3;
  }

  .home-page .journey-map {
    min-height: 980px;
  }

  .home-page .journey-places {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-page .journey-current-heroes,
  .home-page .story-card,
  .home-page .game-pass {
    transition: none;
  }
}
```

- [ ] **Step 4: Verify keyboard and overflow**

For each viewport 390, 768, 1024 and 1440 px:

```js
({
  viewport: window.innerWidth,
  horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
  activeElement: document.activeElement?.id || document.activeElement?.className || ""
})
```

Expected: `horizontalOverflow` is `false`. Tab through navigation, hero actions, filters, cards, map points, game links and checkout; each focus indicator remains visible.

- [ ] **Step 5: Verify reduced motion**

Enable `prefers-reduced-motion: reduce`. Complete a story and rerender the map. Expected: the marker changes position without animation, and no decorative element moves continuously.

- [ ] **Step 6: Run full verification and commit**

```bash
npm run verify
git add styles/homepage-book.css tests/ui-contract.test.js
git commit -m "Finish responsive living book homepage"
```

---

### Task 8: Final visual comparison, regression pass and PR update

**Files:**
- Verify: all files changed in Tasks 1–7
- Reference: `/Users/a1234/Downloads/Живая книга путешествий.png`

**Interfaces:**
- Consumes: complete implementation.
- Produces: updated draft PR on `codex/living-travel-book` with passing Vercel preview.

- [ ] **Step 1: Run the complete automated suite**

```bash
npm run verify
git diff --check
```

Expected: 24 or more tests PASS, static build succeeds, and `git diff --check` prints nothing.

- [ ] **Step 2: Start the production build locally**

```bash
python3 -m http.server 8031 --directory dist
```

- [ ] **Step 3: Perform desktop visual comparison**

At 1440×1000 compare the homepage against the concept and verify:

- hero art dissolves into paper with no oval or hard edge;
- headline, actions and panorama have the same left/right balance;
- three horizontal cards appear in one row;
- source marks are readable and exact;
- dotted route and paws visually connect hero, stories and map;
- map is panoramic, not a rounded widget;
- lower sections remain quieter than hero/cards/map.

Save a screenshot for review.

- [ ] **Step 4: Perform functional browser regression**

Verify:

1. `Истории` opens `/stories`.
2. `Тарифы` reaches `/#pricing` on the first click.
3. `Для родителей` reaches `/#why-read` below the sticky header.
4. Every filter rerenders cards with correct source labels.
5. Card body, title and arrow open the intended story.
6. Like does not open the story accidentally.
7. One completed story moves map progress and adds a keepsake.
8. «Мемори» opens `/games/memory`.
9. «Бесконечный полёт» opens `/games/endless-flight`.
10. `about.html`, `/create` and `/library` keep their existing layouts.

- [ ] **Step 5: Inspect repository scope**

```bash
git status --short
git diff --stat db551b1..HEAD
```

Expected: only planned homepage, asset, test, spec and plan files are tracked. Existing experimental untracked files remain untracked.

- [ ] **Step 6: Push the branch and wait for checks**

```bash
git push origin codex/living-travel-book
gh pr checks 1 --watch --interval 10
```

Expected: `Vercel` and `Vercel Preview Comments` PASS.

- [ ] **Step 7: Hand off the preview**

Provide:

- PR URL: `https://github.com/isakovalex-dev/hedgehog-fox-stories/pull/1`
- the updated Vercel preview URL from the check;
- test count;
- the 1440 px comparison screenshot;
- a concise list of preserved functional flows.
