# Ортогональные карты лабиринта — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить три пейзажных маршрута на настоящие акварельные лабиринты с прямыми горизонтальными и вертикальными тропинками, по центру которых всегда идёт герой.

**Architecture:** `js/labyrinth-engine.js` будет единственным источником логических ортогональных карт и компактных границ визуальной сетки. `js/labyrinth-game.js` будет переводить клетку матрицы в процентную позицию по формуле, а не искать её в ручном списке точек. Три новых 4:3 иллюстрации содержат именно эти сетки; туман, герой, следы, события и сундук используют общую геометрию.

**Tech Stack:** статический HTML/CSS/vanilla JavaScript, UMD-модуль игры, Node.js `node:test`, Playwright, встроенная генерация иллюстраций.

**Spec:** `docs/superpowers/specs/2026-09-30-orthogonal-labyrinth-maps-design.md`

## Global Constraints

- Не добавлять runtime-зависимости или внешний серверный функционал.
- Не перезаписывать прежние фоновые PNG; создать новые versioned-файлы в `assets/labyrinth/storybook/`.
- Все дорожки на новых картах имеют только горизонтальные и вертикальные центральные оси; диагональные и извилистые пути запрещены.
- Награда уровня существует только в сундуке на `G`; входная задачка и билетик — подсказки, не собранные призы.
- Сохранить выбор обоих героев, туман, сердца, обязательные модальные окна, keyboard/WASD/русскую раскладку, экранную крестовину, тап соседней клетки и свайп.
- Сохранить доступность: элементы управления минимум 44×44 CSS-пикселей, видимый focus, trap фокуса в обязательном диалоге, адаптация от 375 px ширины.
- Работать в существующем изолированном worktree; не переносить изменения в основной checkout без отдельного разрешения.

## Review Focus

- Неровные строки матрицы, два старта или два сундука не должны создавать молча сломанную карту; это фиксирует Task 1.
- У каждого `S` должен быть достижимый `G` только через кардинальные переходы; это фиксирует Task 1.
- Завершённый билетик или задачка не должны выдавать приз до сундука; это фиксирует Task 1 и Task 3.
- Ошибка загрузки нового PNG должна показать карточку возврата к уровням, а не пустой лабиринт; это фиксирует Task 3.
- Один мобильный свайп, последний тап по скрытому `G` и фокус в модалке должны давать ровно ожидаемое действие; это фиксирует Task 3.

## File Structure

| Файл | Ответственность |
| --- | --- |
| `assets/labyrinth/storybook/forest-start-maze-v2.png` | фон «Лесного старта» с сеткой 11×11 |
| `assets/labyrinth/storybook/mystery-forest-maze-v2.png` | фон «Таинственного леса» с сеткой 13×13 |
| `assets/labyrinth/storybook/mountain-cave-maze-v2.png` | фон «Горной пещеры» с сеткой 15×15 |
| `js/labyrinth-engine.js` | данные глав, матрицы, события, финальная награда и чистые правила движения |
| `js/labyrinth-game.js` | `gridPoint()`, DOM-отрисовка карты, подсказок, финала и fallback при ошибке изображения |
| `labyrinth.css` | координаты от `--grid-x/--grid-y`, слой `<img>` карты и карточка ошибки загрузки |
| `labyrinth.html` | preload нового первого ассета и новая версия CSS/JS |
| `tests/labyrinth-engine.test.js` | проверка формы и достижимости матриц, семантики подсказок и приза |
| `tests/labyrinth.spec.mjs` | browser-проверка сеточных координат, управления, финала и asset fallback |

### Task 1: Ортогональная игровая модель и награда только в финале

**Files:**

- Modify: `js/labyrinth-engine.js:8-143, 207-289`
- Modify: `tests/labyrinth-engine.test.js:1-137`

**Interfaces:**

- Consumes: существующие `createState(levelId, hero)`, `move(state, direction)`, `completeEncounter(state, encounterId)`.
- Produces: `LEVELS` с `{ art, gridBounds, map, encounters, prize }`; состояние с `seenEncounters` и `prize`, где `prize` меняется только при переходе на `G`.
- Removes: `goalFindingId`, `findingId`, `findings`, `addFinding()` и терминологию «находка на тропинке» из игровой модели.

- [ ] **Step 1: Написать падающие тесты для новых карт и семантики подсказок**

  В `tests/labyrinth-engine.test.js` заменить старые ожидания названий/ассетов/трёх находок на:

  ```js
  const expectedLevels = [
    ["easy", "Лесной старт", "3–5 лет", "assets/labyrinth/storybook/forest-start-maze-v2.png", 11],
    ["medium", "Таинственный лес", "6–7 лет", "assets/labyrinth/storybook/mystery-forest-maze-v2.png", 13],
    ["hard", "Горная пещера", "8–10 лет", "assets/labyrinth/storybook/mountain-cave-maze-v2.png", 15]
  ];
  ```

  Добавить тесты `each orthogonal map is rectangular with one reachable start and goal` и `hints never become prizes before the final chest`. Первый проверяет одинаковую длину строк, один `S`, один `G`, корректные `gridBounds` (`0 <= left < right <= 100`, аналогично `top/bottom`) и BFS-достижимость `G` через четыре направления. Второй завершает оба encounter и утверждает `prize === null`, затем доводит героя до `G` и утверждает равенство `level.prize`.

- [ ] **Step 2: Запустить тесты и подтвердить ожидаемое падение**

  Run: `node --test tests/labyrinth-engine.test.js`

  Expected: FAIL на прежних названиях/ассетах и на ожидании промежуточных `findings`.

- [ ] **Step 3: Заменить данные глав в `LEVELS` на утверждённые ортогональные схемы**

  Использовать следующие матрицы без изменения символов `S`, `G`, `.`, `#`:

  ```js
  // easy, 11 × 11, S: 9:1, G: 1:9
  [
    "###########",
    "#####.###G#",
    "#####.###.#",
    "###.......#",
    "###.###.###",
    "###.....###",
    "#######.###",
    "#.......###",
    "#.#########",
    "#S....#####",
    "###########"
  ]

  // medium, 13 × 13, S: 11:1, G: 1:11
  [
    "#############",
    "###########G#",
    "###########.#",
    "#####.#####.#",
    "#####.#####.#",
    "###.......#.#",
    "###.#####.#.#",
    "###...###...#",
    "#####.#####.#",
    "#.....#####.#",
    "#.#########.#",
    "#S....#####.#",
    "#############"
  ]

  // hard, 15 × 15, S: 13:1, G: 1:13
  [
    "###############",
    "###########.#G#",
    "###########.#.#",
    "###########...#",
    "###########.###",
    "#########.....#",
    "#######.#####.#",
    "###.......###.#",
    "###.#.###.###.#",
    "###...###.....#",
    "###.#.#####.###",
    "#.....#####.###",
    "#.#########.###",
    "#S....#####.###",
    "###############"
  ]
  ```

  Использовать новые display-имена, ассеты и bounds:

  ```js
  easy:   { gridBounds: { left: 10, top: 8, right: 90, bottom: 92 } }
  medium: { gridBounds: { left: 8, top: 8, right: 92, bottom: 92 } }
  hard:   { gridBounds: { left: 7, top: 7, right: 93, bottom: 93 } }
  ```

  Задать входные события на `9:1`, `11:1`, `13:1`; билетики/развилки — на `3:7`, `5:5`, `7:7` соответственно. Сохранить возраст, сложность, дружелюбные вопросы и типы `puzzle`/`ticket`, но убрать `findingId`.

  В `createState()` оставить `seenEncounters: []`, удалить `findings`; использовать сообщение «У входа лежит записка.» В `completeEncounter()` обновлять только `pendingEncounter`, `seenEncounters` и сообщение. В `move()` устанавливать `prize: level.prize` только при `tile === "G"` и говорить «Сундук найден!». Существующие чистые интерфейсы движения не менять.

- [ ] **Step 4: Запустить модульные тесты и подтвердить проход**

  Run: `node --test tests/labyrinth-engine.test.js`

  Expected: PASS; все уровни имеют достижимый `G`, а до него `prize` равен `null`.

- [ ] **Step 5: Закоммитить игровую модель**

  ```bash
  git add js/labyrinth-engine.js tests/labyrinth-engine.test.js
  git commit -m "feat: define orthogonal labyrinth routes"
  ```

### Task 2: Создать и проверить три акварельные карты-сетки

**Files:**

- Create: `assets/labyrinth/storybook/forest-start-maze-v2.png`
- Create: `assets/labyrinth/storybook/mystery-forest-maze-v2.png`
- Create: `assets/labyrinth/storybook/mountain-cave-maze-v2.png`

**Interfaces:**

- Consumes: имена файлов, матрицы и `gridBounds` из Task 1.
- Produces: три самостоятельных 4:3 PNG, содержащие только фон карты; все интерактивные герои/текст/UI остаются HTML-слоями из Task 3.

- [ ] **Step 1: Сгенерировать карту «Лесной старт» встроенным image generation**

  Использовать приложенное пользователем изображение от 29 сентября только как **reference image**. В запросе указать use case `illustration-story`, asset type `children's maze-game map background`, композицию 4:3 и следующий обязательный смысл: «вид сверху под небольшим углом, акварель на тёплой бумаге, широкий песчаный лабиринт из прямых отрезков и углов 90°, регулярная сетка 11×11, стартовая тропинка внизу слева и золотой сундук вверху справа, лесные островки, грибы и брёвнышко». Указать ограничения: `no text, no labels, no numbers, no characters, no UI, no diagonal or curved paths, no watermark`.

- [ ] **Step 2: Сгенерировать «Таинственный лес» и «Горную пещеру» отдельными запросами**

  Для среднего уровня указать регулярную сетку 13×13, ручьи и один-два мостика только на прямых дорожках. Для сложного — сетку 15×15, скалы, лестницы, мосты, кристаллы и пещеру у верхнего правого сундука. В каждом запросе повторить запрет диагоналей, извилистых дорожек, текста и персонажей.

- [ ] **Step 3: Визуально принять только карты с корректной геометрией и перенести их в проект**

  Для каждого результата открыть изображение и проверить: 4:3; стартовая область снизу слева; сундук сверху справа; центры дорожек образуют равномерную сетку, не содержат диагоналей; нет UI-текста и нарисованного героя. При одном нарушении сделать целевую повторную генерацию, не пытаться маскировать проблему кодом.

  Скопировать только утверждённые PNG в три точных пути Task 2. Не изменять `forest-trail.png`, `river-valley.png` и `mountain-pass.png`.

- [ ] **Step 4: Проверить присутствие и пропорции ассетов**

  Run: `sips -g pixelWidth -g pixelHeight assets/labyrinth/storybook/forest-start-maze-v2.png assets/labyrinth/storybook/mystery-forest-maze-v2.png assets/labyrinth/storybook/mountain-cave-maze-v2.png`

  Expected: три существующих PNG с отношением ширины к высоте 4:3.

- [ ] **Step 5: Закоммитить иллюстрации отдельно**

  ```bash
  git add assets/labyrinth/storybook/forest-start-maze-v2.png
  git add assets/labyrinth/storybook/mystery-forest-maze-v2.png
  git add assets/labyrinth/storybook/mountain-cave-maze-v2.png
  git commit -m "feat: add orthogonal labyrinth illustrations"
  ```

### Task 3: Перевести DOM на расчёт сетки, обновить семантику подсказок и защитить загрузку карты

**Files:**

- Modify: `js/labyrinth-game.js:20-326, 430-560`
- Modify: `labyrinth.css:568-700, 900-950`
- Modify: `labyrinth.html:10-19`
- Modify: `tests/labyrinth.spec.mjs:1-244`

**Interfaces:**

- Consumes: `level.gridBounds`, `level.map`, `state.seenEncounters` и `state.prize` из Task 1; новые PNG из Task 2.
- Produces: `gridPoint(level, row, column) -> { x: number, y: number }`, DOM-атрибуты `data-grid-x`, `data-grid-y`, и `data-hint-count`; `renderMapLoadFailure()` для ошибочного ассета.

- [ ] **Step 1: Написать падающие browser-тесты для сетки, подсказок и asset fallback**

  В `tests/labyrinth.spec.mjs` заменить старые ожидания `Лесная тропинка`/`data-path-x`/`3/3` находок. Добавить:

  ```js
  test("uses one uniform orthogonal grid for every playable marker", async ({ page }) => {
    await openTrail(page, "hedgehog", "easy");
    const start = page.locator('#labyrinthBoard [data-row="9"][data-column="1"]');
    const east = page.locator('#labyrinthBoard [data-row="9"][data-column="2"]');
    const north = page.locator('#labyrinthBoard [data-row="8"][data-column="1"]');
    // x changes by a constant only horizontally; y changes by a constant only vertically.
  });
  ```

  Проверить, что маркеры имеют `data-grid-x/y`, не имеют `data-path-x/y`, и для start/east/north выполняется алгебра прямоугольной сетки. Добавить сценарий, в котором после решения входной задачи и билетика UI показывает счётчик «Подсказки», но не выдаёт приз; приз появляется только в диалоге сундука. Добавить `page.route()` с abort для `forest-start-maze-v2.png` и ожидание текста «Не удалось открыть карту» с кнопкой «К уровням». Сохранить существующие проверки свайпа, tap-through на скрытом `G`, Tab в модальном окне и 44×44 controls, обновив координаты/пути для новых матриц.

- [ ] **Step 2: Запустить browser-тесты и подтвердить ожидаемое падение**

  Run: `npm run test:e2e -- tests/labyrinth.spec.mjs`

  Expected: FAIL на отсутствующих новых ассетах, `data-grid-x/y`, новой семантике HUD и fallback.

- [ ] **Step 3: Реализовать общий расчёт позиции и использовать его во всех слоях карты**

  В `js/labyrinth-game.js` удалить `TRAIL_POINTS`, `trailPoint()` и `trailStyle()`. Добавить:

  ```js
  function gridPoint(level, row, column) {
    const { left, top, right, bottom } = level.gridBounds;
    const columns = level.map[0].length - 1;
    const rows = level.map.length - 1;
    return {
      x: Number((left + (column / columns) * (right - left)).toFixed(3)),
      y: Number((top + (row / rows) * (bottom - top)).toFixed(3))
    };
  }
  ```

  Добавить `gridStyle(point)` с `--grid-x`/`--grid-y`; вызвать его в `renderFog`, `renderFootprints`, `renderBoard` и позиции знака «Старт». В `renderBoard` отдавать `data-grid-x`/`data-grid-y`. В CSS заменить позиционирование `--path-x/--path-y` на `--grid-x/--grid-y`; не менять механику goal veil, yield tap и pointer-events.

- [ ] **Step 4: Отделить подсказки от награды и добавить fallback фоновой картинки**

  Удалить `FINDING_TOTAL` и `data-finding-count`. HUD выводит `data-hint-count="${game.seenEncounters.length}"` с текстом «Подсказки: X/Y». В encounter заменить заголовок «НАХОДКА НА ТРОПИНКЕ» на «ПОДСКАЗКА НА ТРОПИНКЕ». В treasure и completion показывать только `level.prize.title` / «Награда», без промежуточного счётчика предметов.

  Отрисовывать новый background отдельным декоративным `<img data-map-art alt="">` под слоями board/HUD. Добавить к UI-состоянию `mapAssetFailed: false`, сбрасывать его в `start()`, а capture listener на `error` для `[data-map-art]` должен переключать экран на `renderMapLoadFailure()`. Failure-экран показывает точный текст «Не удалось открыть карту» и кнопку `data-action="back-level"`; повторно повреждённый `<img>` в нём не отрисовывается. Обычный `.labyrinth-map-frame` сохраняет бумажную подложку за изображением.

  В `labyrinth.html` заменить preload на `forest-start-maze-v2.png` и обновить cache-bust одновременно у CSS и обоих JS-файлов.

- [ ] **Step 5: Запустить browser-тесты и подтвердить проход**

  Run: `npm run test:e2e -- tests/labyrinth.spec.mjs`

  Expected: PASS; тесты подтверждают прямую сетку, отсутствие промежуточного приза, туман/цель, свайп, Tap, модалки, mobile controls и error fallback.

- [ ] **Step 6: Закоммитить UI и тесты**

  ```bash
  git add js/labyrinth-game.js
  git add labyrinth.css
  git add labyrinth.html
  git add tests/labyrinth.spec.mjs
  git commit -m "feat: render labyrinths on a uniform grid"
  ```

### Task 4: Сквозная проверка и визуальная приёмка

**Files:**

- Verify: `js/labyrinth-engine.js`, `js/labyrinth-game.js`, `labyrinth.css`, `labyrinth.html`, `tests/labyrinth-engine.test.js`, `tests/labyrinth.spec.mjs`

**Interfaces:**

- Consumes: завершённые Task 1–3.
- Produces: проверенный локальный preview и доказательство, что карта работает на desktop и телефоне.

- [ ] **Step 1: Прогнать чистые, browser и build-проверки**

  Run: `node --test tests/labyrinth-engine.test.js`

  Expected: PASS.

  Run: `npm run test:e2e -- tests/labyrinth.spec.mjs`

  Expected: PASS.

  Run: `npm run build`

  Expected: PASS и обновлённая статическая сборка без отсутствующих ассетов.

  Run: `git diff --check`

  Expected: без вывода.

- [ ] **Step 2: Сделать визуальную проверку в двух viewports**

  Открыть `labyrinth.html` в локальном preview в desktop и при 375 px ширины. Для каждого уровня зафиксировать старт, прямой участок, поворот, развилку и подход к сундуку. Проверить визуально: герой и знак старта находятся в центре песчаной дороги; ни одна разрешённая клетка не лежит на камнях/траве; маршруты не имеют диагоналей; туман не закрывает HUD/controls; на телефоне нет горизонтальной прокрутки.

- [ ] **Step 3: Сверить состояние репозитория и подготовить краткую передачу**

  Run: `git status --short`

  Expected: нет случайных source-изменений; допускается только заранее известная папка `artifacts/` с визуальными доказательствами, если она уже была неотслеживаемой.

  В передаче назвать новые файлы ассетов, результаты тестов, URL локального preview и отдельно отметить, что production-сайт не менялся.

## Self-Review

- **Покрытие спецификации:** Task 1 реализует новые названия, маршруты, границы сетки, достижимость и финальную награду; Task 2 — три новые 4:3 иллюстрации; Task 3 — общую геометрию, подсказки, туман, доступность и fallback; Task 4 — desktop/mobile проверку и сборку.
- **Неоднозначности:** матрицы, координаты событий, bounds, имена ассетов, DOM-атрибуты и финальные тексты заданы явно. Художественный результат принимается только после визуального запрета диагоналей и персонажей внутри фона.
- **Типы и интерфейсы:** `gridPoint()` принимает `level`, `row`, `column` и возвращает числа; движок экспортирует прежние функции, но состояние больше не содержит `findings`.
- **Review Focus:** все пять перечисленных случаев имеют конкретные проверки в Task 1 или Task 3.
- **Пропорция:** четыре задачи соответствуют четырём независимым проверяемым результатам: логика, ассеты, UI, сквозная приёмка.
