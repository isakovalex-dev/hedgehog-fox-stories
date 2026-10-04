# Бесконечное путешествие в лабиринте — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в «Лабиринт добрых тропинок» бесконечную последовательность детерминированно сгенерированных акварельных глав.

**Architecture:** `js/labyrinth-engine.js` генерирует полноценный динамический level object из номера главы и хранит его в состоянии игры, чтобы существующие туман, события и движение использовали одну матрицу. `js/labyrinth-game.js` добавляет отдельный режим и локальный прогресс, сохраняя классические `easy`, `medium`, `hard` без изменения их потока. Ровная песчаная дорожка остаётся SVG-слоем, построенным из той же матрицы, поэтому случайная логика не может разойтись с визуальной тропой.

**Tech Stack:** статический HTML/CSS/vanilla JavaScript, UMD-модуль, `node:test`, Playwright; без новых runtime-зависимостей и серверных endpoints.

**Spec:** `docs/superpowers/specs/2026-10-02-endless-labyrinth-journey-design.md`

## Global Constraints

- Не менять данные и поведение статичных `easy`, `medium`, `hard`.
- Не использовать `Math.random()`; глава с одним номером обязана повторяться байт-в-байт на одном устройстве.
- Новые карты содержат только ортогональные дорожки; все допустимые ходы должны совпадать с native SVG-путём.
- В каждой главе есть одна входная задачка, одна модальная подсказка на середине маршрута и одна награда только в `G`.
- Использовать существующие три background PNG и их `gridBounds`; не генерировать ассеты на каждый уровень.
- Обычный прогресс остаётся в `hedgehogFoxLabyrinthProgress`; новый ключ — `hedgehogFoxLabyrinthEndlessProgress`.
- Сохранить keyboard/WASD/русскую раскладку, крестовину, tap, swipe, туман, 44 × 44 controls, модальный focus trap и fallback изображения.

## Review Focus

- Некорректный номер главы (`0`, отрицательный, дробный, строка) нормализуется к положительному целому и не приводит к пустой карте — Task 1.
- Две генерации одной главы дают идентичный map/events/prize, а соседние главы не получают один id — Task 1.
- Динамический объект уровня проходит через `createState`, `getEncounter`, `getEncounterAt` и `move`, а не вызывает ошибку поиска id в `LEVELS` — Task 1.
- Повреждённый `hedgehogFoxLabyrinthEndlessProgress` запускает первую главу без ошибки и не затрагивает старый прогресс — Task 2.
- Переход из endless обратно к обычному уровню очищает dynamic level и не сохраняет «пройдено» для статичных карт — Task 2.

---

### Task 1: Детерминированный генератор динамической главы

**Files:**
- Modify: `js/labyrinth-engine.js`
- Modify: `tests/labyrinth-engine.test.js`

**Interfaces:**
- Consumes: существующие `LEVELS`, `STEPS`, `revealNearby()`, `findMarker()`.
- Produces: `createEndlessLevel(chapter: unknown): Level`, где `Level` имеет существующую форму уровня; расширенные `createState(levelRef, hero)`, `getEncounter(levelRef, id)` и `getEncounterAt(levelRef, position)` принимают `string | Level`.

- [ ] **Step 1: Написать падающие тесты для генерации главы и совместимости dynamic level**

  В `tests/labyrinth-engine.test.js` добавить helpers `routeToGoal(level)` и `assertEndlessLevel(level)`. Добавить тесты:

  ```js
  test("creates deterministic, reachable orthogonal endless chapters", () => {
    const first = createEndlessLevel(12);
    assert.deepEqual(createEndlessLevel(12), first);
    assert.notEqual(createEndlessLevel(13).id, first.id);
    assert.notDeepEqual(createEndlessLevel(13).map, first.map);
    assert.match(first.id, /^endless-12$/);
    assertEndlessLevel(first);
  });

  test("normalizes unsafe endless chapter numbers and runs dynamic encounters", () => {
    const level = createEndlessLevel(-3.8);
    assert.equal(level.id, "endless-1");
    let state = createState(level, "fox");
    assert.equal(getEncounter(level, state.pendingEncounter).row, state.position.row);
    state = completeEncounter(state, state.pendingEncounter);
    assert.deepEqual(move(state, "up").level, level);
  });
  ```

  `assertEndlessLevel` проверяет прямоугольность, ровно один `S`/`G`, достижимость BFS только cardinal steps, ровно два encounters, entry на `S`, ticket на клетке маршрута и отсутствие prize до `G`.

- [ ] **Step 2: Запустить модульные тесты и подтвердить ожидаемое падение**

  Run: `node --test tests/labyrinth-engine.test.js`

  Expected: FAIL с отсутствующей функцией `createEndlessLevel`.

- [ ] **Step 3: Реализовать resolver и seeded PRNG в `js/labyrinth-engine.js`**

  Добавить внутренние функции `normalizeEndlessChapter(chapter)`, `createSeededRandom(seed)`, `buildPerfectMaze(roomColumns, roomRows, random)`, `routeBetween(map, start, goal)` и `resolveLevel(levelRef)`.

  `normalizeEndlessChapter` возвращает `Math.max(1, Math.floor(Number(chapter) || 1))`. PRNG принимает 32-bit integer и возвращает число `[0, 1)`. `buildPerfectMaze` создаёт DFS-maze из нечётных комнат и раскрывает соединения исключительно по четырём направлениям. Не экспортировать внутренние helpers.

- [ ] **Step 4: Реализовать `createEndlessLevel(chapter)` и совместимость состояния**

  Добавить экспорт `createEndlessLevel(chapter)`. Он:

  - нормализует номер и строит id `endless-${chapter}`;
  - выбирает theme index `(chapter - 1) % 3` и размеры: глава 1 — 5 × 4, 2 — 6 × 5, 3 — 7 × 6, далее forest — 6 × 5, mystery/mountain — 7 × 6;
  - перебирает до 24 seed-variants, выбирает дальнюю верхне-правую комнату и принимает путь длиной не меньше `roomRows + roomColumns + 4`;
  - возвращает существующие `art` и `gridBounds` соответствующей темы, `displayTitle: "Бесконечная глава ${chapter}"`, локальные summary/prize и два unique encounter id с номером главы;
  - помещает entry puzzle на `S`, а ticket в середину `routeBetween(S, G)`; ticket всегда имеет `kind: "ticket"`, поэтому на телефоне достаточно одной понятной кнопки;
  - создаёт prize только как значение level object, без присвоения его до прихода в `G`.

  `createState` кладёт resolved level в `state.level`; `move` использует `state.level`; `getEncounter` и `getEncounterAt` всегда вызывают `resolveLevel`, сохраняя строковые вызовы старых тестов.

- [ ] **Step 5: Запустить полный модульный файл и подтвердить проход**

  Run: `node --test tests/labyrinth-engine.test.js`

  Expected: PASS; прежние 11 тестов и новые генераторные тесты зелёные.

- [ ] **Step 6: Закоммитить движок и тесты**

  ```bash
  git add js/labyrinth-engine.js tests/labyrinth-engine.test.js
  git commit -m "feat: generate endless labyrinth chapters"
  ```

### Task 2: Режим, прогресс и переход следующей главы

**Files:**
- Modify: `js/labyrinth-game.js`
- Modify: `tests/labyrinth.spec.mjs`

**Interfaces:**
- Consumes: `engine.createEndlessLevel(chapter)`, dynamic-compatible `engine.createState(levelRef, hero)`, existing render/controls.
- Produces: режим `classic | endless`, `readEndlessProgress()`, `saveEndlessProgress()`, `beginEndlessChapter(chapter)` и DOM hooks `[data-endless-choice]`, `[data-endless-chapter]`, `[data-mode="endless"]`.

- [ ] **Step 1: Написать падающие browser-тесты нового режима**

  В `tests/labyrinth.spec.mjs` добавить `createRequire(import.meta.url)` и загрузить движок для расчёта correct answer и route динамической главы. Добавить helpers `chooseEndlessTrail(page)` и `completeEndlessChapter(page, chapter)`.

  Добавить тесты:

  ```js
  test("starts the endless journey from a book-style fourth choice", async ({ page }) => {
    await page.goto("/labyrinth.html");
    await page.locator('[data-hero-choice="hedgehog"]').click();
    await page.locator('[data-endless-choice]').click();
    await page.getByRole("button", { name: "Начать путешествие" }).click();
    await expect(page.locator('[data-screen="play"]')).toHaveAttribute("data-mode", "endless");
    await expect(page.locator('[data-endless-chapter]')).toHaveText("1");
  });

  test("continues from an endless treasure into the next generated chapter", async ({ page }) => {
    await completeEndlessChapter(page, 1);
    await page.getByRole("button", { name: "Следующая глава" }).click();
    await expect(page.locator('[data-screen="play"]')).toHaveAttribute("data-level", "endless-2");
  });
  ```

  Добавить три точных сценария: `"recovers from corrupted endless progress without changing classic progress"`, `"keeps endless card and physical phone controls usable on 375px"` и `"returns to a classic level without retaining the endless dynamic map"`. Первый пишет в `hedgehogFoxLabyrinthEndlessProgress` невалидный JSON и ожидает chapter 1; второй делает swipe и tap в главе 1; третий выбирает endless, возвращается к уровням, выбирает `easy` и ожидает `data-level="easy"`/`data-mode="classic"`.

- [ ] **Step 2: Запустить browser-тесты и подтвердить ожидаемое падение**

  Run: `npx playwright test tests/labyrinth.spec.mjs --grep "endless" --reporter=line`

  Expected: FAIL из-за отсутствующих endless choice и DOM attributes.

- [ ] **Step 3: Добавить отдельное локальное хранилище и state mode**

  В `js/labyrinth-game.js` добавить `readEndlessProgress()` и `saveEndlessProgress()` для ключа `hedgehogFoxLabyrinthEndlessProgress`; оба должны возвращать/принимать объект `{ highestChapter }`, клэмпить нечисловые значения к `0` и молча переносить ошибки browser storage.

  Расширить UI state полями `mode`, `endlessChapter`, `activeLevel`, `endlessProgress`. `currentLevel()` возвращает `activeLevel` при endless, иначе статичный `engine.getLevel(levelId)`. `activeEncounter()` передаёт в движок `currentLevel()`, а не только `levelId`.

- [ ] **Step 4: Добавить карточку, запуск и финальный переход**

  В `renderLevelSelection()` добавить после обычной сетки `<button data-endless-choice>` с текстом «Бесконечное путешествие», подписью «Новая карта после каждого сундука» и print/stamp `[data-endless-best]`. Выбранная endless карточка должна показывать primary action «Начать путешествие» или «Продолжить с главы N + 1».

  Добавить `beginEndlessChapter(chapter)`: он создаёт `engine.createEndlessLevel(chapter)`, задаёт `mode: "endless"`, `activeLevel`, `endlessChapter`, затем использует общую инициализацию игры. Обычный выбор уровня возвращает `mode: "classic"` и очищает `activeLevel`.

  В `screenAttributes`, HUD и heading добавить `data-mode` и `[data-endless-chapter]` для endless. В `finishTreasure()` обновлять `highestChapter` только для endless; в `renderCompletion()` показывать «Глава N пройдена!» и кнопку `data-action="next-endless"` с точным текстом «Следующая глава». Обработчик `next-endless` запускает `N + 1`; классическая кнопка следующего уровня не меняется.

- [ ] **Step 5: Запустить новые и существующие browser-тесты**

  Run: `npx playwright test tests/labyrinth.spec.mjs --reporter=dot --workers=4`

  Expected: PASS; статичные уровни, dialogs, touch, map fallback и новые endless scenarios зелёные.

- [ ] **Step 6: Закоммитить UI и browser-тесты**

  ```bash
  git add js/labyrinth-game.js tests/labyrinth.spec.mjs
  git commit -m "feat: add endless labyrinth journey"
  ```

### Task 3: Книжная карточка режима и адаптивная передача стиля

**Files:**
- Modify: `labyrinth.css`
- Modify: `labyrinth.html`
- Test: `tests/labyrinth.spec.mjs`

**Interfaces:**
- Consumes: DOM hooks `[data-endless-choice]`, `[data-endless-best]`, `[data-endless-chapter]` из Task 2.
- Produces: responsive `.labyrinth-endless-choice` / `.labyrinth-endless-choice__stamp` styling and fresh cache-bust query strings.

- [ ] **Step 1: Написать падающий mobile browser-тест карточки**

  В существующем 375 px scenario добавить точные ожидания: endless card видима, primary action не выходит за viewport, stamp отображает `Открыта глава 1` после сохранённой первой главы, а оба action controls имеют минимум 44 × 44 px.

- [ ] **Step 2: Запустить тест и подтвердить ожидаемое падение**

  Run: `npx playwright test tests/labyrinth.spec.mjs --grep "endless card and physical phone" --reporter=line`

  Expected: FAIL на отсутствующем stamp/class или мобильных границах.

- [ ] **Step 3: Реализовать сдержанную акварельную карточку в `labyrinth.css`**

  Добавить `.labyrinth-endless-choice` как полношириную paper-card под фиксированными уровнями: слева небольшой существующий forest background, сверху тонкая пунктирная travel-line, справа бумажная печать `.labyrinth-endless-choice__stamp`. Не использовать яркие новые градиенты или другую типографику; кнопка сохраняет существующие moss/honey tokens.

  В `@media (max-width: 760px)` карточка перестраивается в один читаемый столбец, stamp не вылезает за край, а action и control остаются не меньше 44 px. Не изменять стили статичных level cards.

- [ ] **Step 4: Обновить cache-bust и выполнить mobile browser-тест**

  В `labyrinth.html` обновить версии `labyrinth.css`, `labyrinth-engine.js` и `labyrinth-game.js` одним новым суффиксом. Затем выполнить:

  Run: `npx playwright test tests/labyrinth.spec.mjs --grep "endless card and physical phone" --reporter=line`

  Expected: PASS.

- [ ] **Step 5: Закоммитить стили и HTML**

  ```bash
  git add labyrinth.css labyrinth.html tests/labyrinth.spec.mjs
  git commit -m "style: present endless journey as a storybook card"
  ```

### Task 4: Сквозная проверка и визуальная приёмка

**Files:**
- Verify: `js/labyrinth-engine.js`, `js/labyrinth-game.js`, `labyrinth.css`, `labyrinth.html`, `tests/labyrinth-engine.test.js`, `tests/labyrinth.spec.mjs`

**Interfaces:**
- Consumes: реализованные engine/UI/style contracts из Tasks 1–3.
- Produces: проверенную сборку и локальный preview без изменения production-сайта.

- [ ] **Step 1: Выполнить целевые проверки**

  Run: `node --test tests/labyrinth-engine.test.js`

  Expected: PASS с классическими и endless generator tests.

  Run: `npx playwright test tests/labyrinth.spec.mjs --reporter=dot --workers=4`

  Expected: PASS со всеми statics/endless/touch/modal flows.

  Run: `npm run build`

  Expected: PASS и существующие три PNG доступны из `dist`.

  Run: `git diff --check`

  Expected: без вывода.

- [ ] **Step 2: Проверить реальный пользовательский поток в desktop и 375 px**

  Открыть `labyrinth.html` в локальном preview. На desktop: выбрать endless card, решить entry, пройти до ticket и сундука, убедиться, что «Следующая глава» открывает другой id. На 375 px: выполнить один touch swipe и один tap по соседней клетке; проверить, что герой остаётся на песчаной дорожке, controls/hud не перекрывают карту и нет горизонтальной прокрутки.

- [ ] **Step 3: Сверить репозиторий и подготовить передачу**

  Run: `git status --short`

  Expected: нет случайных source-изменений; допускается только ранее существовавшая неотслеживаемая папка `artifacts/`.

  Передать коммиты, результаты 2 целевых test suites, build, local preview URL и отдельно отметить, что production/main не менялся.

## Self-Review

- **Покрытие спецификации:** Task 1 реализует deterministic generator, exact wave, dynamic contract, туман-compatible matrix/events/prize; Task 2 реализует режим, storage, UI state и переходы; Task 3 передаёт акварельный стиль и mobile presentation; Task 4 проверяет весь детский поток.
- **Step scan:** каждый task начинается с red test, затем ожидаемого red run, одного определённого implementation шага, green run и commit. Нет placeholder steps.
- **Type consistency:** `createEndlessLevel(chapter)`, `createState(levelRef, hero)`, `getEncounter(levelRef, id)`, `getEncounterAt(levelRef, position)`, `beginEndlessChapter(chapter)`, `mode`, `activeLevel`, `endlessChapter` названы одинаково во всех tasks.
- **Review Focus:** все пять рисков имеют прямой тест в Task 1 или Task 2; мобильная geometry проверяется в Task 3/4.
- **Пропорция:** четыре задачи соответствуют независимым deliverables: движок, игровой поток, представление, сквозная приёмка.
