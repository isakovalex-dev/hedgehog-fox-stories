# «Живая книга путешествий» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перевести весь сайт «Ёжик и Лисёнок» на визуальную систему «Живая книга путешествий», добавить маршрут, места и памятные находки, сохранив текущие тексты, маршруты, генерацию, оплату, авторизацию, библиотеку, чтение и игры.

**Architecture:** Существующая статическая архитектура и DOM-контракты `id`/`data-*` остаются основой. Новый визуальный слой подключается после `styles.css` через два изолированных файла, а новая логика путешествия добавляется отдельным сервисом без изменения формата сохранённых пользовательских сказок. Переход выполняется вертикальными срезами: каждый этап собирается, тестируется и может быть принят независимо.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, Node.js built-in test runner, текущий статический build-скрипт, текущие Supabase/OpenAI-compatible интеграции без изменений.

## Global Constraints

- Сохранить все существующие пользовательские сценарии, маршруты, тексты историй, формы, тариф, авторизацию, библиотеку и игры.
- В production-каталоге должны оставаться две игры: «Мемори» (`/games/memory`) и «Бесконечный полёт» (`/games/endless-flight`).
- Обе production-игры должны быть доступны с главной страницы и из общей навигации; редизайн не должен менять их правила, управление, сохранённые результаты и игровые состояния.
- Не переименовывать существующие `id`, `data-*`, URL-маршруты и глобальные `window.HF*` интерфейсы без отдельного совместимого перехода.
- Не менять API-контракты Supabase, оплаты и генерации иллюстраций.
- Не добавлять UI-фреймворк, CSS-фреймворк, сборщик или runtime-зависимость.
- Основная палитра: `#F7F2E5`, `#526658`, `#C86F42`, `#BCD4D2`, `#403B34`, `#E8DCC2`.
- Заголовки: `Cormorant Infant`; основной текст и интерфейс: `Nunito`; метаданные: `PT Mono`.
- Основной визуальный материал — существующие акварельные иллюстрации; новые декоративные элементы должны быть CSS/SVG, а не тяжёлыми растровыми изображениями.
- Маршрут и памятные находки не должны превращаться в соревновательную механику: без очков, серий входов, рейтингов и наказаний.
- Памятные находки хранятся локально и не требуют миграции базы данных.
- Все анимации должны отключаться через `prefers-reduced-motion: reduce`.
- Минимальный размер интерактивной области на мобильном — `44 × 44 px`.
- Существующие незакоммиченные изменения и новые файлы пользователя нельзя удалять, перезаписывать или включать в несвязанные коммиты.

---

## File Structure

### Новые файлы

- `styles/journey-tokens.css` — палитра, типографика, интервалы, радиусы, тени, focus-ring и базовые визуальные токены.
- `styles/journey-theme.css` — компоненты и адаптивные правила новой темы, подключаемые после текущего `styles.css`.
- `js/journeyService.js` — локальное хранение прочитанных историй и памятных находок.
- `js/staticNavigation.js` — открытие и закрытие мобильного меню на самостоятельных HTML-страницах, где не загружается `js/app.js`.
- `tests/ui-contract.test.js` — защита обязательных DOM-контрактов и порядка подключения скриптов.
- `tests/journey-service.test.js` — unit-тесты нового сервиса путешествия.
- `tests/story-journey-metadata.test.js` — проверка мест и находок у встроенных историй.
- `tests/games-contract.test.js` — защита двух production-маршрутов, карточек игр и обязательных DOM-контрактов.
- `docs/visual/journey-art-direction.md` — короткий паспорт визуального стиля для будущих иллюстраций.

### Изменяемые файлы

- `package.json` — единая команда тестов.
- `scripts/build-static.mjs` — копирование каталога `styles` в `dist`.
- `index.html` — новая оболочка, hero, маршрут, места и панель находок при сохранении всех рабочих `id`/`data-*`.
- `about.html` — единая навигация, правильные пропорции рисунков, сокращённая иерархия без потери текста.
- `privacy.html`, `requisites.html`, `terms.html`, `404.html` — общая тема и навигационная оболочка.
- `styles.css` — только точечное исправление текущего критического бага изображений; новые правила сюда не наращивать.
- `script.js` — подключение `js/journeyService.js` перед `js/app.js`.
- `js/storyService.js` — нормализованные `journeyPlace` и `keepsake`.
- `js/analyticsService.js` — события выбора места и получения памятной находки.
- `js/app.js` — рендер маршрута, открытие истории из места и фиксация завершённой истории.
- `manifest.webmanifest` — согласование `theme_color` и `background_color`.
- `vercel.json` — сохранение rewrite для «Бесконечного полёта» и SPA-маршрута «Мемори».
- `about.html` inline analytics — оставить текущие события без изменения названий.

### Файлы, поведение которых не меняется

- `api/*.js`
- `js/supabaseService.js`
- `js/subscriptionService.js`
- `js/likeService.js`
- `js/storageService.js`
- `js/memoryGame.js`
- `js/miniGames.js`
- `src/games/endless-flight/*.js`

Production-игры:

| Игра | Маршрут | HTML | Логика | Хранение результата |
|---|---|---|---|---|
| Мемори | `/games/memory` | секция `#memoryGameSection` в `index.html` | `js/memoryGame.js` | текущее состояние приложения |
| Бесконечный полёт | `/games/endless-flight` | `endless-flight.html` | `src/games/endless-flight/*.js` | текущий `StorageManager.js` |

Игровые экраны получают общую палитру оболочки; внутренние механики и селекторы не редактируются. Найденные в рабочем дереве `forest-catcher.html`, `forest-catcher.css`, `js/forestCatcherGame.js`, `js/catchGame.js` и `flight.html` считаются экспериментальными и не входят в production-редизайн без отдельного решения пользователя.

---

### Task 1: Зафиксировать функциональные и DOM-контракты

**Files:**
- Create: `tests/ui-contract.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: текущие `index.html`, `about.html`, `script.js`, `js/app.js`.
- Produces: команда `npm test`, которая обнаруживает потерянные `id`, `data-*` и неправильный порядок сервисов.

- [ ] **Step 1: Написать контрактный тест**

Создать `tests/ui-contract.test.js`:

```js
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.join(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("index keeps all application DOM contracts", () => {
  const html = read("index.html");
  const requiredIds = [
    "mainContent",
    "navTopButton",
    "navMenuButton",
    "siteNavMenu",
    "navLoginButton",
    "navStoriesButton",
    "navMemoryButton",
    "navGeneratorButton",
    "navLibraryButton",
    "navAboutButton",
    "chooseStoryButton",
    "readFirstButton",
    "openGeneratorButton",
    "openLibraryButton",
    "openAboutButton",
    "stories",
    "storyList",
    "filters",
    "pricing",
    "generator",
    "generatorForm",
    "generationStatus",
    "generationWaitPanel",
    "subscriptionScreen",
    "library",
    "libraryList",
    "reader",
    "slides",
    "readingProgress",
    "memoryGameSection",
    "generationExperience"
  ];

  requiredIds.forEach((id) => {
    assert.match(html, new RegExp(`id=["']${id}["']`), `Missing #${id}`);
  });
});

test("index keeps delegated data contracts", () => {
  const html = read("index.html");
  [
    "data-filter",
    "data-start-checkout",
    "data-auth-action",
    "data-password-toggle",
    "data-open-memory"
  ].forEach((attribute) => assert.match(html, new RegExp(attribute)));
});

test("journey service loads after storage and before app", () => {
  const source = read("script.js");
  const storageIndex = source.indexOf("js/storageService.js");
  const journeyIndex = source.indexOf("js/journeyService.js");
  const appIndex = source.indexOf("js/app.js");

  assert.ok(storageIndex >= 0);
  assert.ok(journeyIndex > storageIndex);
  assert.ok(appIndex > journeyIndex);
});

test("about page keeps analytics hooks and one h1", () => {
  const html = read("about.html");
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /data-about-read-stories/);
  assert.match(html, /data-about-create-story/);
});
```

- [ ] **Step 2: Добавить единую тестовую команду**

В `package.json` заменить раздел `scripts`:

```json
{
  "scripts": {
    "build": "node scripts/build-static.mjs",
    "test": "node --test tests/*.test.js",
    "verify": "npm test && npm run build"
  }
}
```

- [ ] **Step 3: Запустить тест и подтвердить ожидаемый первый сбой**

Run:

```bash
npm test
```

Expected: существующие тесты проходят, а тест порядка скриптов падает, потому что `js/journeyService.js` ещё не подключён.

- [ ] **Step 4: Зафиксировать только тестовый каркас**

```bash
git add package.json tests/ui-contract.test.js
git commit -m "test: protect visual migration contracts"
```

---

### Task 2: Ввести дизайн-токены и безопасный CSS-слой

**Files:**
- Create: `styles/journey-tokens.css`
- Create: `styles/journey-theme.css`
- Modify: `scripts/build-static.mjs`
- Modify: `index.html`
- Modify: `about.html`
- Modify: `privacy.html`
- Modify: `requisites.html`
- Modify: `terms.html`
- Modify: `404.html`
- Modify: `manifest.webmanifest`

**Interfaces:**
- Consumes: текущий `styles.css`.
- Produces: CSS custom properties `--journey-*` и общий класс `<body class="journey-theme ...">`.

- [ ] **Step 1: Создать токены**

Создать `styles/journey-tokens.css`:

```css
:root {
  --journey-paper: #f7f2e5;
  --journey-paper-deep: #e8dcc2;
  --journey-pine: #526658;
  --journey-pine-dark: #3f5147;
  --journey-fox: #c86f42;
  --journey-lake: #bcd4d2;
  --journey-ink: #403b34;
  --journey-muted: #6f685f;
  --journey-white: #fffdf7;
  --journey-line: rgba(64, 59, 52, 0.18);
  --journey-line-soft: rgba(64, 59, 52, 0.1);
  --journey-focus: #2f6f68;
  --journey-shadow: 0 14px 36px rgba(64, 59, 52, 0.1);
  --journey-shadow-soft: 0 7px 20px rgba(64, 59, 52, 0.07);
  --journey-radius-small: 8px;
  --journey-radius-medium: 18px;
  --journey-radius-large: 30px;
  --journey-content: 1200px;
  --journey-reading: 72ch;
  --journey-space-1: 0.5rem;
  --journey-space-2: 0.75rem;
  --journey-space-3: 1rem;
  --journey-space-4: 1.5rem;
  --journey-space-5: 2rem;
  --journey-space-6: 3rem;
  --journey-space-7: 4.5rem;
  --font-display: "Cormorant Infant", Georgia, serif;
  --font-body: "Nunito", Arial, sans-serif;
  --font-meta: "PT Mono", "SFMono-Regular", Consolas, monospace;
}

.journey-theme {
  color: var(--journey-ink);
  background: var(--journey-paper);
  font-family: var(--font-body);
}

.journey-theme :where(h1, h2, h3, .nav-brand) {
  font-family: var(--font-display);
}

.journey-theme :where(button, a, input, select, textarea):focus-visible {
  outline: 3px solid var(--journey-focus);
  outline-offset: 3px;
}

.journey-meta {
  font-family: var(--font-meta);
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
```

- [ ] **Step 2: Создать пустой тематический слой с базовыми гарантиями**

Создать `styles/journey-theme.css`:

```css
.journey-theme *,
.journey-theme *::before,
.journey-theme *::after {
  box-sizing: border-box;
}

.journey-theme img {
  max-width: 100%;
}

.journey-theme .button,
.journey-theme .nav-action,
.journey-theme .filter-button {
  min-height: 44px;
}

@media (prefers-reduced-motion: reduce) {
  .journey-theme *,
  .journey-theme *::before,
  .journey-theme *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Научить build копировать каталог стилей**

В `scripts/build-static.mjs` изменить:

```js
const publicDirectories = ["assets", "js", "public", "src", "styles"];
```

- [ ] **Step 4: Подключить шрифты и тему на всех HTML-страницах**

На каждой общей странице после `styles.css` добавить:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Cormorant+Infant:wght@500;600;700&family=Nunito:wght@400;600;700;800&family=PT+Mono&display=swap"
  rel="stylesheet"
/>
<link rel="stylesheet" href="/styles/journey-tokens.css?v=1" />
<link rel="stylesheet" href="/styles/journey-theme.css?v=1" />
```

Добавить `journey-theme` к существующему `body.className`, не удаляя классы `about-page`, `legal-page` и игровые классы.

- [ ] **Step 5: Обновить PWA-цвета**

В `manifest.webmanifest` установить:

```json
"background_color": "#F7F2E5",
"theme_color": "#526658"
```

- [ ] **Step 6: Проверить сборку и контракты**

Run:

```bash
npm run verify
```

Expected: build создаёт `dist/styles/journey-tokens.css` и `dist/styles/journey-theme.css`; тест порядка скриптов пока остаётся единственным ожидаемым падением.

- [ ] **Step 7: Commit**

```bash
git add styles/journey-tokens.css styles/journey-theme.css scripts/build-static.mjs index.html about.html privacy.html requisites.html terms.html 404.html manifest.webmanifest
git commit -m "feat: add living travel book design foundation"
```

---

### Task 3: Описать единый художественный стиль и инвентарь ассетов

**Files:**
- Create: `docs/visual/journey-art-direction.md`

**Interfaces:**
- Consumes: `assets/illustration-style-profile.json`, `assets/hero-friends.png`, `assets/stories/*.png`, `assets/slides-web/*.jpg`.
- Produces: обязательные правила для любых будущих сгенерированных иллюстраций.

- [ ] **Step 1: Создать паспорт**

Записать в `docs/visual/journey-art-direction.md`:

```markdown
# Художественное направление «Живая книга путешествий»

## Герои

- Ежонок и Лисёнок сохраняют текущие пропорции, возраст и мягкую акварельную прорисовку.
- Ежонок ниже и компактнее Лисёнка; Лисёнок стройнее, с заметным светлым кончиком хвоста.
- Эмоции читаются по позе и взгляду, без гротескной мимики.

## Среда

- Бумага светлая, тёплая, без сильной жёлтой тонировки.
- Края акварели растворяются в фоне; запрещены прямоугольные фоторамки внутри сюжетных иллюстраций.
- Пространства мира: лес, поляна, домик, море, звёздная горка.
- Повторяемые предметы памяти: лист, ракушка, перо, звезда.

## Палитра

- Бумага `#F7F2E5`
- Хвоя `#526658`
- Лисий акцент `#C86F42`
- Озёрный туман `#BCD4D2`
- Чернила `#403B34`
- Старая бумага `#E8DCC2`

## Композиция

- Один главный эмоциональный центр.
- Персонажи не обрезаются по лицу, лапам и хвосту.
- Для hero оставлять спокойное негативное пространство под текст.
- Иллюстрации карточек создаются в 3:2; рукописи автора показываются в исходном 4:3 или 3:4.

## Запреты

- 3D, пластик, глянцевая мультяшность, неон, фотореализм.
- Случайные аксессуары и одежда, меняющиеся от картинки к картинке.
- Текст внутри сгенерированных изображений.
- Чужие узнаваемые франшизы и стили конкретных живущих художников.
```

- [ ] **Step 2: Зафиксировать повторное использование текущих ассетов**

В том же документе добавить таблицу:

| Зона | Ассет |
|---|---|
| Главный hero | `assets/optimized/hero-friends-1200.avif` + PNG fallback |
| Карточки | `assets/optimized/<story>-*.avif` |
| Чтение | `assets/slides-web/<story>-<page>.jpg` |
| Об авторе | `assets/about/sketch-*.jpg` без изменения пропорций |
| Маршрут | CSS-линия + inline SVG следов и находок |

- [ ] **Step 3: Commit**

```bash
git add docs/visual/journey-art-direction.md
git commit -m "docs: define living travel book art direction"
```

---

### Task 4: Перестроить header и hero без изменения поведения

**Files:**
- Modify: `index.html`
- Modify: `styles/journey-theme.css`
- Test: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes: существующие кнопки `#nav*`, `#chooseStoryButton`, `#openGeneratorButton`, `#readFirstButton`, `#openLibraryButton`, `#openAboutButton`.
- Produces: hero «Добрые истории для тихих вечеров» и единый header при тех же JS-селекторах.

- [ ] **Step 1: Дополнить контракт hero**

В `tests/ui-contract.test.js` добавить:

```js
test("living book hero preserves action hooks", () => {
  const html = read("index.html");
  assert.match(html, /class=["'][^"']*journey-hero/);
  assert.match(html, /id=["']chooseStoryButton["']/);
  assert.match(html, /id=["']openGeneratorButton["']/);
  assert.match(html, /class=["'][^"']*hero-illustration/);
});
```

- [ ] **Step 2: Проверить падение**

Run:

```bash
node --test tests/ui-contract.test.js
```

Expected: FAIL — `.journey-hero` ещё отсутствует.

- [ ] **Step 3: Обновить hero, сохранив рабочие элементы**

В `index.html` оставить существующие `picture`, `source`, `img` и идентификаторы кнопок. Новая структура:

```html
<section class="hero journey-hero" id="top" aria-labelledby="heroTitle">
  <div class="hero-content journey-hero__copy">
    <p class="journey-meta">Семейная библиотека сказок</p>
    <h1 id="heroTitle">Добрые истории<br />для тихих вечеров</h1>
    <p class="subtitle">
      Читайте готовые приключения Ежонка и Лисёнка или создайте новую сказку специально для ребёнка.
    </p>
    <div class="hero-actions">
      <button class="button primary" id="chooseStoryButton" type="button">Выбрать историю</button>
      <button class="button secondary" id="openGeneratorButton" type="button">Создать свою</button>
    </div>
    <div class="journey-hero__quiet-actions" aria-label="Дополнительные действия">
      <button id="readFirstButton" type="button">Читать первую</button>
      <button id="openLibraryButton" type="button">Моя библиотека</button>
      <button id="openAboutButton" type="button">О проекте</button>
    </div>
  </div>
  <div class="hero-friends journey-hero__art">
    <!-- сохранить существующий picture целиком -->
  </div>
  <div class="journey-trail journey-trail--hero" aria-hidden="true">
    <span class="journey-trail__paw"></span>
    <span class="journey-trail__paw"></span>
    <span class="journey-trail__paw"></span>
  </div>
</section>
```

- [ ] **Step 4: Оформить header и hero**

Добавить в `styles/journey-theme.css` полноценные правила для:

- `.site-nav`, `.nav-brand`, `.nav-menu`, `.nav-link`, `.nav-action`;
- `.journey-hero`, `.journey-hero__copy`, `.journey-hero__art`;
- `.journey-trail` и трёх следов;
- desktop `minmax(320px, .72fr) minmax(520px, 1.28fr)`;
- mobile `display:flex; flex-direction:column;`, иллюстрация первой;
- кнопок шириной `100%` на экране до `720px`.

Hero должен иметь `min-height: min(760px, calc(100svh - 70px))`, но на мобильном — `min-height:auto`.

- [ ] **Step 5: Проверить маршруты hero вручную**

Run:

```bash
npm run verify
python3 -m http.server 8031 --directory dist
```

Проверить:

- `http://localhost:8031/`
- «Выбрать историю» → `/stories`
- «Создать свою» → `/create`
- «Моя библиотека» → `/library`
- Back/Forward восстанавливают нужный экран.

- [ ] **Step 6: Commit**

```bash
git add index.html styles/journey-theme.css tests/ui-contract.test.js
git commit -m "feat: redesign header and hero as living travel book"
```

---

### Task 5: Перевести каталог историй на книжные карточки

**Files:**
- Modify: `js/app.js`
- Modify: `styles/journey-theme.css`
- Test: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes: `renderStoryCard(story, options)`, `data-read`, `data-like`, `data-delete-story`, `data-illustrate-story`.
- Produces: те же действия в новой карточке; `journeyPlace` и `keepsake` только отображаются.

- [ ] **Step 1: Добавить тест обязательных действий карточки**

В `tests/ui-contract.test.js` добавить:

```js
test("story renderer keeps all delegated actions", () => {
  const source = read("js/app.js");
  [
    "data-story-card",
    "data-read",
    "data-like",
    "data-delete-story",
    "data-illustrate-story"
  ].forEach((attribute) => assert.match(source, new RegExp(attribute)));
});
```

- [ ] **Step 2: Обновить только HTML-шаблон `renderStoryCard`**

Сохранить существующие кнопки и условия, но добавить семантические обёртки:

```html
<article class="story-card journey-story-card" ...>
  <div class="story-art journey-story-card__art" ...>...</div>
  <div class="story-content journey-story-card__content">
    <div class="journey-story-card__location journey-meta">...</div>
    <h3>...</h3>
    <div class="story-meta">...</div>
    <p>...</p>
    <div class="card-footer">...</div>
  </div>
</article>
```

Использовать безопасные значения:

```js
const journeyPlaceLabel = story.journeyPlaceLabel || "По дороге";
```

- [ ] **Step 3: Переформулировать фильтры по ситуации, сохранив `data-filter`**

Только видимые подписи:

| Текущее значение | Новая подпись | `data-filter` |
|---|---|---|
| Все | Все истории | `all` |
| 5–7 лет | 5–7 лет | `5-7` |
| 8–10 лет | 8–10 лет | `8-10` |
| Перед сном | Перед сном | `bedtime` |
| Про дружбу | Когда нужен друг | `friendship` |
| Про смелость | Когда немного страшно | `bravery` |

- [ ] **Step 4: Добавить CSS книжных карточек**

Карточки:

- изображение 3:2, `height:auto`, `object-fit:cover`;
- фон `rgba(255, 253, 247, .72)`;
- радиус `var(--journey-radius-small)`, без чрезмерных «пузырей»;
- desktop 3 колонки, tablet 2, mobile горизонтальный scroll-snap;
- кнопки и лайк не должны перекрываться;
- заголовок не фиксировать по высоте.

- [ ] **Step 5: Проверить лайки, чтение, удаление и иллюстрации**

Run:

```bash
npm run verify
```

В браузере проверить одну встроенную и одну пользовательскую историю:

- лайк меняет `aria-pressed`;
- «Читать» открывает reader;
- «Удалить» остаётся только в библиотеке;
- «Нарисовать иллюстрации» остаётся только у подходящей Supabase-истории.

- [ ] **Step 6: Commit**

```bash
git add js/app.js index.html styles/journey-theme.css tests/ui-contract.test.js
git commit -m "feat: restyle story catalogue as travel book"
```

---

### Task 6: Добавить места и памятные находки в данные историй

**Files:**
- Modify: `js/storyService.js`
- Create: `tests/story-journey-metadata.test.js`

**Interfaces:**
- Consumes: существующий `normalizeStory(story, source)`.
- Produces: у каждой истории строки `journeyPlace`, `journeyPlaceLabel`, `keepsake`; существующий shape остаётся обратно совместимым.

- [ ] **Step 1: Написать тест метаданных**

Создать `tests/story-journey-metadata.test.js` с fake `window` и проверить:

```js
assert.deepEqual(
  service.getBuiltInStories().map(({ id, journeyPlace, keepsake }) => ({
    id,
    journeyPlace,
    keepsake
  })),
  [
    { id: "lost-cloud", journeyPlace: "starry-hill", keepsake: "star" },
    { id: "sea-bench", journeyPlace: "sea", keepsake: "shell" },
    { id: "hedgehog-bravery", journeyPlace: "forest", keepsake: "leaf" },
    { id: "warm-wind-map", journeyPlace: "meadow", keepsake: "feather" },
    { id: "rustling-grass", journeyPlace: "meadow", keepsake: "leaf" },
    { id: "star-for-friend", journeyPlace: "starry-hill", keepsake: "star" }
  ]
);
```

- [ ] **Step 2: Запустить тест и подтвердить падение**

```bash
node --test tests/story-journey-metadata.test.js
```

Expected: FAIL — поля отсутствуют.

- [ ] **Step 3: Добавить справочник мест**

В `js/storyService.js`:

```js
const JOURNEY_PLACES = {
  forest: "Лес",
  meadow: "Поляна",
  cottage: "Домик",
  sea: "Море",
  "starry-hill": "Звёздная горка"
};

function inferJourneyPlace(story) {
  if (story.journeyPlace && JOURNEY_PLACES[story.journeyPlace]) return story.journeyPlace;
  if (story.tags?.includes("bedtime")) return "starry-hill";
  if (story.tags?.includes("bravery")) return "forest";
  if (story.tags?.includes("friendship")) return "meadow";
  return "cottage";
}

function inferKeepsake(story, journeyPlace) {
  if (["leaf", "shell", "star", "feather"].includes(story.keepsake)) return story.keepsake;
  return {
    forest: "leaf",
    meadow: "feather",
    cottage: "feather",
    sea: "shell",
    "starry-hill": "star"
  }[journeyPlace];
}
```

- [ ] **Step 4: Проставить точные значения встроенным историям**

Добавить к шести объектам значения из теста. В `normalizeStory` вычислять:

```js
const journeyPlace = inferJourneyPlace({ ...story, tags });
```

И возвращать:

```js
journeyPlace,
journeyPlaceLabel: JOURNEY_PLACES[journeyPlace],
keepsake: inferKeepsake(story, journeyPlace),
```

- [ ] **Step 5: Запустить тесты**

```bash
npm test
```

Expected: PASS, кроме ещё не реализованного порядка `journeyService`.

- [ ] **Step 6: Commit**

```bash
git add js/storyService.js tests/story-journey-metadata.test.js
git commit -m "feat: add journey places to story metadata"
```

---

### Task 7: Реализовать локальный сервис памятных находок

**Files:**
- Create: `js/journeyService.js`
- Create: `tests/journey-service.test.js`
- Modify: `script.js`

**Interfaces:**
- Consumes: `window.HFStorageService`.
- Produces: `window.HFJourneyService.getDiscoveries()`, `markDiscovered(story)`, `isDiscovered(storyId)`, `clearDiscoveries()`.

- [ ] **Step 1: Написать тест**

Создать `tests/journey-service.test.js`:

```js
"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

function loadService(initialValue = []) {
  let savedValue = initialValue;
  global.window = {
    HFStorageService: {
      getJSON: () => savedValue,
      setJSON: (_key, value) => {
        savedValue = value;
        return true;
      },
      removeItem: () => {
        savedValue = [];
        return true;
      }
    }
  };

  const modulePath = path.join(__dirname, "..", "js", "journeyService.js");
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);

  return {
    service: window.HFJourneyService,
    readSaved: () => savedValue
  };
}

test("journey starts empty and stores one normalized discovery", () => {
  const { service, readSaved } = loadService();
  const story = {
    id: "sea-bench",
    journeyPlace: "sea",
    keepsake: "shell",
    title: "Скамейка на краю моря",
    slides: ["Лишнее поле не должно сохраняться"]
  };

  const first = service.markDiscovered(story);
  const second = service.markDiscovered(story);

  assert.equal(first.storyId, "sea-bench");
  assert.deepEqual(second, first);
  assert.equal(readSaved().length, 1);
  assert.deepEqual(Object.keys(readSaved()[0]).sort(), [
    "discoveredAt",
    "keepsake",
    "place",
    "storyId"
  ]);
  assert.equal(service.isDiscovered("sea-bench"), true);
});

test("journey treats malformed storage as empty", () => {
  const { service } = loadService({ unexpected: true });
  assert.deepEqual(service.getDiscoveries(), []);
});

test("journey can clear local discoveries", () => {
  const { service } = loadService([
    {
      storyId: "lost-cloud",
      place: "starry-hill",
      keepsake: "star",
      discoveredAt: "2026-07-28T00:00:00.000Z"
    }
  ]);

  assert.equal(service.clearDiscoveries(), true);
  assert.deepEqual(service.getDiscoveries(), []);
});
```

- [ ] **Step 2: Реализовать сервис**

Создать `js/journeyService.js`:

```js
(function (window) {
  "use strict";

  const STORAGE_KEY = "hedgehogFoxJourneyDiscoveriesV1";
  const storage = window.HFStorageService;

  function getDiscoveries() {
    const items = storage.getJSON(STORAGE_KEY, []);
    return Array.isArray(items) ? items.filter((item) => item && item.storyId) : [];
  }

  function markDiscovered(story) {
    if (!story?.id) return null;
    const current = getDiscoveries();
    const existing = current.find((item) => item.storyId === story.id);
    if (existing) return existing;

    const discovery = {
      storyId: String(story.id),
      place: String(story.journeyPlace || "cottage"),
      keepsake: String(story.keepsake || "feather"),
      discoveredAt: new Date().toISOString()
    };

    storage.setJSON(STORAGE_KEY, [...current, discovery]);
    return discovery;
  }

  function isDiscovered(storyId) {
    return getDiscoveries().some((item) => item.storyId === storyId);
  }

  function clearDiscoveries() {
    return storage.removeItem(STORAGE_KEY);
  }

  window.HFJourneyService = {
    getDiscoveries,
    markDiscovered,
    isDiscovered,
    clearDiscoveries
  };
})(window);
```

- [ ] **Step 3: Подключить сервис**

В `script.js` добавить:

```js
"js/journeyService.js?v=1",
```

сразу после `js/storageService.js` и до `js/app.js`.

- [ ] **Step 4: Запустить все тесты**

```bash
npm test
```

Expected: PASS, включая контракт порядка скриптов.

- [ ] **Step 5: Commit**

```bash
git add js/journeyService.js tests/journey-service.test.js script.js
git commit -m "feat: store gentle journey discoveries"
```

---

### Task 8: Добавить маршрут, места и коллекцию на главную

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `js/analyticsService.js`
- Modify: `styles/journey-theme.css`
- Test: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes: `HFStoryService.getBuiltInStories()`, `HFJourneyService.getDiscoveries()`, существующий `openStory(storyId)`.
- Produces: `#journeyMap`, `#journeyPlaces`, `#journeyKeepsakes`, клики `data-journey-story`.

- [ ] **Step 1: Добавить DOM-контракт маршрута в тест**

```js
test("homepage exposes accessible journey map", () => {
  const html = read("index.html");
  ["journeyMap", "journeyPlaces", "journeyKeepsakes"].forEach((id) => {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  });
  assert.match(html, /aria-labelledby=["']journeyTitle["']/);
});
```

- [ ] **Step 2: Добавить секцию после списка новых историй**

Структура:

```html
<section class="journey-map" id="journeyMap" aria-labelledby="journeyTitle">
  <div class="journey-map__intro">
    <p class="journey-meta">Мир историй</p>
    <h2 id="journeyTitle">Карта маленьких открытий</h2>
    <p>Каждая прочитанная история оставляет на карте тёплое воспоминание.</p>
  </div>
  <div class="journey-places" id="journeyPlaces" aria-label="Места путешествия"></div>
  <aside class="journey-keepsakes" aria-labelledby="keepsakesTitle">
    <h3 id="keepsakesTitle">Наши памятные находки</h3>
    <div id="journeyKeepsakes" aria-live="polite"></div>
  </aside>
</section>
```

- [ ] **Step 3: Добавить рендер мест**

В начале `js/app.js` рядом с остальными сервисами и DOM-ссылками добавить:

```js
const journeyService = window.HFJourneyService;
const journeyMap = document.querySelector("#journeyMap");
const journeyPlacesElement = document.querySelector("#journeyPlaces");
const journeyKeepsakesElement = document.querySelector("#journeyKeepsakes");
```

Затем определить пять мест:

```js
const journeyPlaces = [
  { id: "forest", label: "Лес", storyId: "hedgehog-bravery" },
  { id: "meadow", label: "Поляна", storyId: "warm-wind-map" },
  { id: "cottage", label: "Домик", storyId: "lost-cloud" },
  { id: "sea", label: "Море", storyId: "sea-bench" },
  { id: "starry-hill", label: "Звёздная горка", storyId: "star-for-friend" }
];
```

`renderJourney()` создаёт кнопки с `data-journey-story`, видимой подписью и `aria-label="Открыть историю: <title>"`. Открытые места получают класс `is-discovered`; закрытые остаются кликабельными и не маскируются замком.

- [ ] **Step 4: Добавить безопасный делегированный обработчик**

```js
journeyMap?.addEventListener("click", (event) => {
  const place = event.target.closest("[data-journey-story]");
  if (!place) return;
  trackEvent(EVENTS.JOURNEY_PLACE_OPENED, {
    place: place.dataset.journeyPlace,
    storyId: place.dataset.journeyStory
  });
  openStory(place.dataset.journeyStory);
});
```

- [ ] **Step 5: Добавить события аналитики**

В `EVENTS`:

```js
JOURNEY_PLACE_OPENED: "journey_place_opened",
JOURNEY_KEEPSAKE_FOUND: "journey_keepsake_found",
```

- [ ] **Step 6: Оформить маршрут**

CSS-требования:

- маршрут строится обычным grid, не canvas;
- desktop: пять мест вдоль мягкой SVG/CSS-линии;
- mobile: вертикальная тропинка;
- следы `aria-hidden`;
- открытые места меняют только цвет кольца, без confetti;
- находки — inline SVG `leaf`, `shell`, `star`, `feather`;
- пустое состояние: «Прочитайте первую историю — и здесь появится памятная находка».

- [ ] **Step 7: Проверить**

```bash
npm run verify
```

В браузере проверить клавиатурой все пять мест и возврат Back.

- [ ] **Step 8: Commit**

```bash
git add index.html js/app.js js/analyticsService.js styles/journey-theme.css tests/ui-contract.test.js
git commit -m "feat: add map of small discoveries"
```

---

### Task 9: Связать завершение чтения с находкой

**Files:**
- Modify: `js/app.js`
- Modify: `styles/journey-theme.css`
- Test: `tests/journey-service.test.js`

**Interfaces:**
- Consumes: `updateProgress()`, `activeStory`, `HFJourneyService.markDiscovered`.
- Produces: одна находка при достижении `98%`, обновлённая карта и ненавязчивый блок на финальном экране.

- [ ] **Step 1: Ввести отдельную функцию завершения**

В `js/app.js`:

```js
function completeActiveStory() {
  if (!activeStory || activeStoryFinishedTracked) return null;
  activeStoryFinishedTracked = true;
  const wasDiscovered = journeyService.isDiscovered(activeStory.id);
  const discovery = journeyService.markDiscovered(activeStory);

  trackEvent(EVENTS.STORY_FINISHED, {
    storyId: activeStory.id,
    title: activeStory.title,
    source: activeStory.source
  });

  if (discovery && !wasDiscovered) {
    trackEvent(EVENTS.JOURNEY_KEEPSAKE_FOUND, {
      storyId: activeStory.id,
      place: discovery.place,
      keepsake: discovery.keepsake
    });
  }

  renderJourney();
  return discovery;
}
```

- [ ] **Step 2: Заменить тело условия в `updateProgress`**

```js
if (activeStory && progress >= 98) completeActiveStory();
```

- [ ] **Step 3: Добавить финальную подпись без блокирующей модалки**

В end slide:

```html
<div class="reader-discovery" role="status">
  История сохранится на вашей карте после завершения чтения.
</div>
```

После завершения текст обновляется на:

```text
На карте осталось новое воспоминание: <название находки>.
```

Словарь:

```js
const keepsakeLabels = {
  leaf: "лесной лист",
  shell: "морская ракушка",
  star: "маленькая звезда",
  feather: "лёгкое перо"
};
```

- [ ] **Step 4: Проверить идемпотентность**

Открыть одну историю дважды и дочитать до конца. В `localStorage.hedgehogFoxJourneyDiscoveriesV1` должна быть одна запись с этим `storyId`.

- [ ] **Step 5: Запустить тесты**

```bash
npm run verify
```

- [ ] **Step 6: Commit**

```bash
git add js/app.js styles/journey-theme.css tests/journey-service.test.js
git commit -m "feat: award keepsakes after completed stories"
```

---

### Task 10: Перевести reader, генератор, библиотеку и тариф на общую тему

**Files:**
- Modify: `styles/journey-theme.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: все текущие DOM-контракты функциональных секций.
- Produces: единая визуальная тема без изменения JavaScript.

- [ ] **Step 1: Оформить reader как спокойный книжный разворот**

Сохранить структуру `.reader`, `.slides`, `.slide`, `.slide-card`, `.slide-navigation`.

Требования:

- текст `max-width: 66ch`;
- иллюстрация сохраняет `height:auto`;
- номер страницы использует `var(--font-meta)`;
- навигация остаётся видимой и не перекрывает текст;
- progress bar использует `--journey-pine`;
- на мобильном одна колонка, иллюстрация над текстом;
- существующие кнопки «Перерисовать», лайк и Back остаются доступны.

- [ ] **Step 2: Оформить генератор как страницу мастерской**

Не менять поля и порядок формы. Визуально:

- слева «Запись для новой сказки»;
- справа тариф и состояние генерации;
- `fieldset`/поля получают бумажную подложку;
- ошибки и предупреждения сохраняют текущий текст и `aria-live`;
- CTA «Создать историю» остаётся самым заметным.

- [ ] **Step 3: Оформить библиотеку как личную полку**

- поиск и сортировка сверху;
- пустое состояние содержит существующую кнопку;
- авторизация остаётся отдельным спокойным блоком;
- пользовательские и авторские карточки сохраняют badges.

- [ ] **Step 4: Оформить тариф без изменения оплаты**

- цена и список преимуществ остаются;
- все `[data-start-checkout]` сохраняются;
- `[data-payment-status]` остаётся `aria-live`;
- не добавлять ложные скидки, таймеры и срочность.

- [ ] **Step 5: Проверить функциональную матрицу**

| Сценарий | Ожидание |
|---|---|
| Создание сказки | форма отправляется, статус появляется |
| Лимит генераций | показывается текущий warning |
| Оплата | checkout вызывается прежней кнопкой |
| Вход/регистрация | формы и password-toggle работают |
| Поиск библиотеки | список фильтруется |
| Сортировка | порядок меняется |
| Чтение | next/previous и progress работают |
| Перерисовка | кнопки и статусы сохраняются |

- [ ] **Step 6: Commit**

```bash
git add index.html styles/journey-theme.css
git commit -m "feat: unify reader creator library and pricing theme"
```

---

### Task 11: Перестроить «Об авторе» и исправить пропорции рисунков

**Files:**
- Create: `js/staticNavigation.js`
- Modify: `about.html`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `styles/journey-theme.css`
- Test: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes: текущий текст `about.html`, `[data-about-read-stories]`, `[data-about-create-story]`.
- Produces: короткая мастерская автора с исходными пропорциями изображений.

- [ ] **Step 1: Добавить тест пропорций**

```js
test("about illustrations explicitly reset intrinsic height", () => {
  const css = read("styles.css") + read("styles/journey-theme.css");
  assert.match(
    css,
    /\.about-page[\s\S]*\.(?:note-sketch|draft-image)[\s\S]*height:\s*auto/
  );
});
```

- [ ] **Step 2: Срочно исправить растяжение в конце `styles.css`**

```css
.about-page .note-sketch,
.about-page .sketch-thumb img,
.about-page .draft-image,
.about-page .future-sketch img {
  height: auto;
}
```

- [ ] **Step 3: Задать правильные пропорции в теме**

```css
.about-page .note-sketch,
.about-page .draft-image {
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

.about-page .sketch-thumb img,
.about-page .future-sketch img {
  aspect-ratio: 3 / 4;
  object-fit: cover;
}
```

- [ ] **Step 4: Сократить визуальные контейнеры без удаления текста**

Сгруппировать существующий текст в пять смысловых блоков:

1. Автор и происхождение проекта.
2. Для кого создаются сказки.
3. Ежонок и Лисёнок.
4. Как появляется история.
5. Что будет дальше.

Четыре шага оставить настоящей последовательностью. Убрать декоративную нумерацию у несвязанных блоков и оставить её только в процессе.

- [ ] **Step 5: Удалить скрытую полную копию about из `index.html`**

Сохранить только `.home-project` и ссылку `href="/about.html"`. Удалить скрытые `.about-hero`, `.workshop-layout`, `.process-block`, `.drafts-block`, `.future-block` из главной.

Перед удалением подтвердить, что `document.querySelectorAll("[data-about-*]")` допускает пустой список на главной.

- [ ] **Step 6: Унифицировать навигацию**

В `about.html` использовать те же видимые пункты и те же `#navMenuButton`/`#siteNavMenu`, что на главной. Создать `js/staticNavigation.js`:

```js
(function (document) {
  "use strict";

  const button = document.querySelector("#navMenuButton");
  const menu = document.querySelector("#siteNavMenu");
  if (!button || !menu) return;

  function setOpen(open) {
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    menu.classList.toggle("open", open);
  }

  button.addEventListener("click", () => {
    setOpen(button.getAttribute("aria-expanded") !== "true");
  });

  menu.addEventListener("click", (event) => {
    if (event.target.closest("a, button")) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
})(document);
```

Подключить его внизу `about.html`:

```html
<script src="/js/staticNavigation.js?v=1"></script>
```

Этот файл не подключать на `index.html`, потому что там меню уже управляется `js/app.js`.

- [ ] **Step 7: Проверить desktop и mobile**

На `1440×900` и `390×844`:

- нет горизонтального scroll;
- высота любого рисунка соответствует 4:3 или 3:4;
- лицо/фигура героя не обрезаны;
- CTA имеют минимум 44 px;
- страница содержит ровно один `h1`.

- [ ] **Step 8: Commit**

```bash
git add about.html index.html styles.css styles/journey-theme.css js/staticNavigation.js tests/ui-contract.test.js
git commit -m "fix: rebuild author workshop with correct artwork ratios"
```

---

### Task 12: Сохранить две production-игры и применить общую оболочку

**Files:**
- Create: `tests/games-contract.test.js`
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `vercel.json`
- Modify: `privacy.html`
- Modify: `requisites.html`
- Modify: `terms.html`
- Modify: `404.html`
- Modify: `endless-flight.html`
- Modify: `src/games/endless-flight/styles.css`
- Modify: `styles/journey-theme.css`

**Interfaces:**
- Consumes: `#memoryGameSection`, `#memoryGame`, `js/memoryGame.js`, `/games/memory`, `endless-flight.html`, `src/games/endless-flight/*.js`, `/games/endless-flight`.
- Produces: видимая секция `#games` с двумя карточками, стабильные маршруты обеих игр и узнаваемая оболочка без изменения gameplay.

- [ ] **Step 1: Написать контрактный тест двух игр**

Создать `tests/games-contract.test.js`:

```js
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("homepage exposes exactly the two production games", () => {
  const html = read("index.html");
  assert.match(html, /id=["']games["']/);
  assert.match(html, /href=["']\/games\/memory["']/);
  assert.match(html, /href=["']\/games\/endless-flight["']/);
  assert.match(html, />\s*Мемори\s*</);
  assert.match(html, />\s*Бесконечный полёт\s*</);
  assert.doesNotMatch(html, /data-production-game=["']forest-catcher["']/);
});

test("memory keeps its SPA route and DOM contracts", () => {
  const html = read("index.html");
  const app = read("js/app.js");
  assert.match(html, /id=["']memoryGameSection["']/);
  assert.match(html, /id=["']memoryGame["']/);
  assert.match(app, /path === "\/games\/memory"/);
});

test("endless flight keeps its page and rewrite", () => {
  const html = read("endless-flight.html");
  const vercel = JSON.parse(read("vercel.json"));
  assert.match(html, /id=["']gameCanvas["']/);
  assert.match(html, /id=["']playButton["']/);
  assert.ok(
    vercel.rewrites.some(
      (item) =>
        item.source === "/games/endless-flight" &&
        item.destination === "/endless-flight.html"
    )
  );
});
```

- [ ] **Step 2: Добавить на главную секцию ровно с двумя карточками**

Разместить перед блоком «О проекте»:

```html
<section class="games-section" id="games" aria-labelledby="gamesTitle">
  <div class="section-heading">
    <p class="journey-meta">Небольшая остановка в пути</p>
    <h2 id="gamesTitle">Поиграем вместе</h2>
    <p>Две спокойные игры с героями любимых историй.</p>
  </div>
  <div class="games-grid">
    <article class="game-entry game-entry--memory">
      <div class="game-entry__copy">
        <h3>Мемори</h3>
        <p>Открывайте карточки и находите пары с героями и местами из сказок.</p>
        <a class="button primary" href="/games/memory" data-open-memory>Играть в мемори</a>
      </div>
    </article>
    <article class="game-entry game-entry--flight">
      <div class="game-entry__copy">
        <h3>Бесконечный полёт</h3>
        <p>Летите вместе с Ежонком и Лисёнком, собирайте звёзды и обходите препятствия.</p>
        <a class="button secondary" href="/games/endless-flight">Отправиться в полёт</a>
      </div>
    </article>
  </div>
</section>
```

Не добавлять третью карточку и не подмешивать экспериментальные игры.

- [ ] **Step 3: Сделать обе игры доступными из навигации**

В desktop- и mobile-меню добавить группу «Игры» с двумя обычными ссылками:

```html
<a class="nav-link" id="navMemoryButton" href="/games/memory">Мемори</a>
<a class="nav-link" href="/games/endless-flight">Бесконечный полёт</a>
```

Сохранить `#navMemoryButton`, потому что `js/app.js` использует его для SPA-навигации и активного состояния. Ссылка на полёт остаётся обычной навигацией на самостоятельную страницу.

- [ ] **Step 4: Оформить карточки и оболочки игр**

Менять только:

- цвета кнопок и overlay;
- шрифты;
- фон оболочки;
- ссылки возврата;
- focus-visible;
- карточки двух игр на главной.

Не менять canvas, физику, таймеры, localStorage-ключи, управление и игровые состояния. В «Бесконечном полёте» сохранить все `id`, используемые `EndlessFlightGame.js`: `gameCanvas`, `playButton`, `pauseButton`, `resumeButton`, `restartButton`, `playAgainButton`, HUD и экраны результата.

- [ ] **Step 5: Legal и 404**

- единый header/footer;
- ширина текста `72ch`;
- `h1` на каждой странице;
- заметные ссылки возврата;
- текущий юридический текст не редактировать.

- [ ] **Step 6: Проверить обе игры**

```bash
npm test
npm run build
```

Вручную:

- мемори: пара, несовпадение, победа, restart;
- мемори: Back/Forward между `/games/memory` и `/stories`;
- бесконечный полёт: старт, пауза, restart, game over, повторная игра;
- бесконечный полёт: лучший результат сохраняется после reload;
- ссылки с главной открывают правильную игру;
- mobile-меню содержит обе игры.

- [ ] **Step 7: Commit**

```bash
git add index.html js/app.js vercel.json privacy.html requisites.html terms.html 404.html endless-flight.html src/games/endless-flight/styles.css styles/journey-theme.css tests/games-contract.test.js
git commit -m "feat: preserve memory and endless flight games"
```

---

### Task 13: Адаптивность, доступность и финальная регрессия

**Files:**
- Modify: `styles/journey-theme.css`
- Modify: `tests/ui-contract.test.js`
- Modify: `docs/launch-checklist.md`

**Interfaces:**
- Consumes: вся новая тема.
- Produces: проверенный релиз-кандидат без изменения бизнес-логики.

- [ ] **Step 1: Добавить статические a11y-проверки**

Проверить тестом:

- один `h1` на route-level странице;
- все `img` имеют `alt` (пустой разрешён только для декоративных);
- все form inputs имеют `label`;
- кнопки имеют текст или `aria-label`;
- `#journeyKeepsakes` использует `aria-live="polite"`;
- `prefers-reduced-motion` присутствует в CSS.

- [ ] **Step 2: Проверить responsive breakpoints**

Обязательные размеры:

- `390×844`
- `768×1024`
- `1024×768`
- `1440×900`

Для каждого:

- `document.documentElement.scrollWidth === innerWidth`;
- header не перекрывает content;
- CTA не меньше 44 px;
- текст не шире 72ch;
- route читается в логическом порядке;
- карточки не обрезают кнопки.

- [ ] **Step 3: Проверить клавиатуру**

Только клавиатурой пройти:

1. Skip-link.
2. Меню.
3. Hero CTA.
4. Фильтры.
5. Карточку истории.
6. Reader next/previous.
7. Возврат.
8. Маршрут.
9. Генератор.
10. Авторизацию.
11. Ссылку на «Мемори».
12. Ссылку на «Бесконечный полёт».

Focus-ring должен быть виден на каждом шаге.

- [ ] **Step 4: Проверить сохранение функционала**

Run:

```bash
npm run verify
```

Expected:

- все Node tests PASS;
- `dist` собран;
- новые стили и `journeyService.js` присутствуют;
- API-файлы не изменены.

- [ ] **Step 5: Проверить опубликованные маршруты локально**

```bash
python3 -m http.server 8031 --directory dist
```

Проверить:

- `/`
- `/stories`
- `/stories/lost-cloud`
- `/create`
- `/library`
- `/games/memory`
- `/games/endless-flight`
- `/about.html`
- `/privacy.html`
- `/terms.html`
- `/requisites.html`
- неизвестный URL через Vercel preview.

- [ ] **Step 6: Дополнить launch checklist**

В `docs/launch-checklist.md` добавить раздел:

```markdown
## Визуальная система «Живая книга путешествий»

- [ ] Проверены 390, 768, 1024 и 1440 px.
- [ ] Все рисунки «Об авторе» сохраняют 4:3 или 3:4.
- [ ] Маршрут доступен клавиатурой.
- [ ] Повторное чтение не дублирует памятную находку.
- [ ] Отключение localStorage не ломает чтение.
- [ ] `prefers-reduced-motion` отключает декоративное движение.
- [ ] Генератор, оплата, вход, библиотека и лайки прошли smoke-test.
- [ ] «Мемори» доступно по `/games/memory`: пары, победа и restart работают.
- [ ] «Бесконечный полёт» доступен по `/games/endless-flight`: старт, пауза, результат и restart работают.
- [ ] Обе игры видны на главной и в мобильной навигации.
```

- [ ] **Step 7: Финальный commit**

```bash
git add styles/journey-theme.css tests/ui-contract.test.js docs/launch-checklist.md
git commit -m "test: verify living travel book migration"
```

---

## Rollout Strategy

1. Выполнить Tasks 1–4 и проверить новый фундамент без маршрута.
2. Выполнить Task 5 и выпустить визуально обновлённый каталог как первый безопасный срез.
3. Выполнить Tasks 6–9 и выпустить маршрут с локальными находками.
4. Выполнить Tasks 10–12 и завершить перенос вторичных экранов.
5. Выполнить Task 13 перед production deployment.

Откат визуальной темы выполняется удалением двух `<link>` на `journey-*.css`; функциональная разметка и JavaScript продолжают работать. Откат памятных находок выполняется удалением вызова `completeActiveStory()` и секции `#journeyMap`; существующие истории и пользовательские данные не затрагиваются.

## Definition of Done

- Палитра, типографика и акварельная подача едины на всех страницах.
- Hero соответствует «Живой книге путешествий».
- Главная содержит доступный маршрут из пяти мест.
- После завершённого чтения появляется одна памятная находка без дублей.
- Текущие истории и пользовательские сказки отображаются без миграции данных.
- Генератор, тариф, оплата, авторизация, библиотека, лайки, reader и игры работают как до редизайна.
- На главной и в навигации представлены обе production-игры: «Мемори» и «Бесконечный полёт».
- Маршруты `/games/memory` и `/games/endless-flight` проходят автоматическую и ручную проверку.
- `about.html` не растягивает и не искажает изображения.
- Все тесты и build проходят.
- На 390, 768, 1024 и 1440 px нет горизонтального overflow.
- При `prefers-reduced-motion` декоративные движения отключены.
