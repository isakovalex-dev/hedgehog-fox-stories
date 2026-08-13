# Атомарное завершение генерации иллюстрации — план реализации

> **Для агентных исполнителей:** использовать `superpowers:subagent-driven-development` для реализации задач с чекбоксами и независимым review после каждой.

**Цель:** Исключить удаление оплаченной иллюстрации при потере ответа RPC и перезапись более новой иллюстрации при конкурентной генерации.

**Архитектура:** Новая server-only Supabase RPC атомарно делает CAS-обновление `story_pages.image_url` и завершает image-резерв. Vercel загружает объект перед RPC; очистка выполняется только до начала финализации либо после подтверждённого отказа базы. Потерянный ответ означает неизвестный результат без удаления объекта или освобождения резерва.

**Технологии:** PostgreSQL/Supabase migrations, Vercel Node.js Functions, Node built-in test runner, Docker-local Supabase только для существующего runtime-gate.

## Глобальные ограничения

- Работать только в `/Users/a1234/Documents/ezhik-i-lisenok/.worktrees/security-remediation` на `codex/security-remediation`.
- Не добавлять зависимости, Redis, очередь, worker или managed service.
- Новую миграцию создавать только `/opt/homebrew/bin/supabase migration new atomic_image_finalization`; timestamp не придумывать.
- Не использовать `--linked`, project ref, удалённые SQL-команды, пароли, ключи, paid-provider запросы, staging или production.
- `SECURITY DEFINER` функция обязана иметь `set search_path = public, pg_temp`; execute отозван у `PUBLIC`, `anon`, `authenticated` и выдан только `service_role`.
- Порядок блокировок: счётчик использования, затем резерв. Ссылку страницы менять только через `IS NOT DISTINCT FROM` внутри новой RPC.
- Публичная ошибка остаётся `internal_error`; секреты, SQL-коды и тела upstream-ответов не выдавать и не логировать.
- Каждый production-code change делать TDD: RED, минимальный GREEN, релевантный полный набор тестов.
- Нестабильный local Docker не заменять удалённой БД; runtime-gate не считать пройденным без свежего вывода.

## Файлы

| Файл | Назначение |
| --- | --- |
| `supabase/migrations/<CLI timestamp>_atomic_image_finalization.sql` | RPC, её транзакция и ACL. |
| `tests/atomic-image-finalization-contract.test.js` | Статический SQL-контракт. |
| `tests/supabase-security.sql` | Runtime SQL-сценарии. |
| `api/_ai-usage.js` | `finalizeImageUsage(input)`. |
| `api/generate-story-illustration.js` | Вызов RPC и безопасная очистка. |
| `tests/ai-usage.test.js` | RPC-helper contract. |
| `tests/generate-story-illustration.test.js` | Регрессии обработчика. |
| `docs/supabase-operations.md`, `SECURITY-AUDIT.md` | Release-gate и статус. |
| `tests/security-documentation.test.js` | Контракт документации. |

### Задача 1: Защищённая атомарная RPC финализации иллюстрации

**Файлы:** создать CLI-миграцию и `tests/atomic-image-finalization-contract.test.js`; изменить `tests/supabase-security.sql`.

**Интерфейс:**

```sql
public.finalize_image_generation(
  p_reservation_id uuid,
  p_page_id uuid,
  p_expected_image_url text,
  p_new_image_url text
) returns jsonb
```

Успех: `{ completed: true, idempotency_replayed: boolean, usage: object }`. Отказ: `{ completed: false, code: 'reservation_expired' | 'page_changed' | 'reservation_terminal' | 'page_not_owned', usage: object }`. При успехе ссылка и списание фиксируются одной транзакцией; при отказе новая ссылка не фиксируется, резерв освобождён один раз.

- [ ] **Шаг 1: Написать RED-тест миграции**

Создать `tests/atomic-image-finalization-contract.test.js`:

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const dir = path.join(__dirname, "..", "supabase", "migrations");

function readMigration() {
  const names = fs.readdirSync(dir).filter((name) => /^\d+_atomic_image_finalization\.sql$/.test(name));
  assert.equal(names.length, 1, "exactly one CLI-created atomic finalization migration exists");
  return fs.readFileSync(path.join(dir, names[0]), "utf8");
}

test("image finalizer is server-only and uses an owner-bound CAS", () => {
  const sql = readMigration();
  assert.match(sql, /public\.finalize_image_generation[\s\S]*p_reservation_id\s+uuid[\s\S]*p_page_id\s+uuid[\s\S]*p_expected_image_url\s+text[\s\S]*p_new_image_url\s+text/is);
  assert.match(sql, /security\s+definer\s+set\s+search_path\s*=\s*public,\s*pg_temp/is);
  assert.match(sql, /from\s+public,\s+anon,\s+authenticated/is);
  assert.match(sql, /finalize_image_generation\(uuid,\s*uuid,\s*text,\s*text\)\s+to\s+service_role/is);
  assert.match(sql, /ai_usage_counters[\s\S]*for\s+update[\s\S]*ai_generation_reservations[\s\S]*for\s+update/is);
  assert.match(sql, /join\s+public\.stories[\s\S]*user_id\s*=\s*v_reservation\.user_id/is);
  assert.match(sql, /image_url\s+is\s+not\s+distinct\s+from\s+p_expected_image_url/is);
  assert.match(sql, /'idempotency_replayed',\s*true/is);
  assert.match(sql, /'page_changed'|storage:\/\/story-illustrations\//is);
});
```

- [ ] **Шаг 2: Подтвердить RED**

```bash
node --test tests/atomic-image-finalization-contract.test.js
```

Ожидание: ошибка `exactly one CLI-created atomic finalization migration exists`.

- [ ] **Шаг 3: Создать миграцию CLI и реализовать функцию**

```bash
/opt/homebrew/bin/supabase migration new atomic_image_finalization
rg --files supabase/migrations | rg '/[0-9]+_atomic_image_finalization\.sql$'
```

В созданном файле создать функцию с `security definer set search_path = public, pg_temp`. Сначала прочитать резерв, затем заблокировать `public.ai_usage_counters ... for update`, и только после этого повторно заблокировать `public.ai_generation_reservations ... for update`. Если статус `completed`, вернуть `completed: true, idempotency_replayed: true` без изменения счётчика. Если резерв не `reserved`, вернуть `reservation_terminal`.

Для истёкшего резерва, отсутствующей/чужой страницы и CAS-конфликта выполнить `reserved → released` и `reserved_count = greatest(0, reserved_count - 1)` ровно один раз, вернуть соответственно `reservation_expired`, `page_not_owned` либо `page_changed`. Перед CAS заблокировать `story_pages` через join с `stories` и проверить `stories.user_id = v_reservation.user_id`. Проверить `p_new_image_url` регулярным выражением `^storage://story-illustrations/<user-id>/.+\\.webp$`. Обновить страницу только так:

```sql
update public.story_pages
   set image_url = p_new_image_url
 where id = v_page.id
   and image_url is not distinct from p_expected_image_url;
```

Только при обновлённой строке выполнить `reserved → completed`, уменьшить `reserved_count`, увеличить `used_count` и вернуть `completed: true, idempotency_replayed: false`. В конце миграции выполнить:

```sql
revoke all on function public.finalize_image_generation(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.finalize_image_generation(uuid, uuid, text, text)
  to service_role;
```

- [ ] **Шаг 4: Добавить runtime SQL-контракт**

До `set local role authenticated` в `tests/supabase-security.sql` создать активного пользователя, страницу с `old-ref`, image-резерв и WebP Storage-ссылки пользователя. Проверить: успешный вызов меняет ссылку и расходует ровно кредит; повтор возвращает `idempotency_replayed` и не меняет `used_count`; заранее заменённая более новая ссылка даёт `page_changed` и остаётся без перезаписи; истёкший резерв даёт `reservation_expired` без ссылки и утечки `reserved_count`. В блоке роли `authenticated` добавить `pg_temp.expect_error` для вызова `public.finalize_image_generation(...)`.

- [ ] **Шаг 5: GREEN и коммит**

```bash
node --test tests/atomic-image-finalization-contract.test.js
git diff --check
git add supabase/migrations tests/atomic-image-finalization-contract.test.js tests/supabase-security.sql
git commit -m "feat: atomically finalize image usage"
```

Ожидание: первые две команды завершаются с кодом 0. Не применять миграцию к удалённой БД.

### Задача 2: Перевести Vercel-обработчик на атомарный финализатор

**Файлы:** изменить `api/_ai-usage.js`, `api/generate-story-illustration.js`, `tests/ai-usage.test.js`, `tests/generate-story-illustration.test.js`.

**Интерфейс helper:**

```js
finalizeImageUsage({ reservationId, pageId, expectedImageUrl, newImageUrl })
```

Он вызывает `/rest/v1/rpc/finalize_image_generation` с `service_role` и ровно этим телом:

```js
{
  p_reservation_id: reservationId,
  p_page_id: pageId,
  p_expected_image_url: expectedImageUrl,
  p_new_image_url: newImageUrl
}
```

- [ ] **Шаг 1: Написать RED-тесты**

В `tests/ai-usage.test.js` добавить тест, который подменяет `fetch`, вызывает `finalizeImageUsage` и проверяет: единственный URL — `/rest/v1/rpc/finalize_image_generation`, `apikey` — `SERVICE_KEY`, JSON body в точности равен интерфейсу выше.

В `tests/generate-story-illustration.test.js` добавить три теста:

1. После Storage POST успешный finalizer RPC отдаёт 200 и usage; `/rest/v1/story_pages?id=` не вызывается.
2. `{ completed: false, code: "page_changed" }` удаляет только свежезагруженный object path и не вызывает `release_ai_usage`.
3. Два finalizer RPC ответа 500 с `{ message: "finalizer-secret" }` дают статическую 500, не вызывают Storage DELETE и `release_ai_usage`, а ответ не содержит `finalizer-secret`.

- [ ] **Шаг 2: Подтвердить RED**

```bash
node --test tests/ai-usage.test.js tests/generate-story-illustration.test.js
```

Ожидание: новые тесты падают, потому что helper и atomic маршрут отсутствуют, а обработчик по-прежнему PATCHит страницу и вызывает `complete_ai_usage`.

- [ ] **Шаг 3: Реализовать helper и цепочку финализации**

В `api/_ai-usage.js` добавить `finalizeImageUsage`: UUID проверить `assertUuid`, обе ссылки привести `String`, вызвать `callServiceRpc("finalize_image_generation", body)`, не-object payload превратить в `internal_error`. Export добавить рядом с `completeAiUsage`; старый helper сохранить.

В `api/generate-story-illustration.js` заменить импорт `completeAiUsage` на `finalizeImageUsage`. Удалить `saveImageReference`, `pageLinkAttempted`, `pageIdToRestore`, `previousImageReference` и REST-восстановление ссылки. Ввести `finalizationState` со значениями `not_started`, `started`, `rejected`, `unknown`, `completed`.

После Storage POST вызвать finalizer с `reservationId`, `page.id`, `page.image_url`, `storageReference`. При исключении повторить идентичный RPC один раз. Второе исключение: `unknown` и статическая ошибка. `completed: false`: `rejected` и статическая ошибка. `completed: true`: `completed` и `reservationCompleted = true`.

В `catch` удалить объект только для `not_started` и `rejected`; `releaseAiUsage` вызвать только для `not_started`. Для `unknown` не удалять и не освобождать. Логировать только `finalizationState`, без URL, ключа, SQL-кода или тела RPC.

- [ ] **Шаг 4: GREEN и полный Node-регресс**

```bash
node --test tests/ai-usage.test.js tests/generate-story-illustration.test.js
node --check api/_ai-usage.js
node --check api/generate-story-illustration.js
node --test tests/*.test.js
```

Ожидание: все команды с кодом 0; тесты полностью подменяют fetch.

- [ ] **Шаг 5: Коммит**

```bash
git add api/_ai-usage.js api/generate-story-illustration.js tests/ai-usage.test.js tests/generate-story-illustration.test.js
git commit -m "fix: atomically finalize story illustrations"
```

### Задача 3: Зафиксировать release-gate и итоговый статус

**Файлы:** изменить `docs/supabase-operations.md`, `SECURITY-AUDIT.md`, `tests/security-documentation.test.js`.

- [ ] **Шаг 1: Написать RED-проверку документации**

Добавить в `tests/security-documentation.test.js` тест, который читает оба документа и проверяет регулярными выражениями `supabase/migrations/`, `atomic image finalization|атомарн.*финализ`, `tests/supabase-security.sql`, `tests/supabase-concurrent-reservation.sh` и `pending non-production verification|ожидает.*непрод`.

- [ ] **Шаг 2: Подтвердить RED**

```bash
node --test tests/security-documentation.test.js
```

Ожидание: падение, так как runbook ссылается только на старую миграцию и не описывает атомарный финализатор.

- [ ] **Шаг 3: Обновить runbook и аудит без ложного прохождения gate**

В `docs/supabase-operations.md` указать применение всех timestamp-миграций из `supabase/migrations/`, включая `*_atomic_image_finalization.sql`. После SQL contract и concurrency добавить обязательное сохранение вывода успешной финализации, `idempotency_replayed`, `reservation_expired` и `page_changed`. При нестабильном Docker gate не повышается и удалённый проект не используется как замена.

В `SECURITY-AUDIT.md` добавить две записи: «ссылка страницы и списание в одной транзакции» и «CAS не перезаписывает более новую иллюстрацию». Для обеих указать `implemented, pending non-production verification`; SQL runtime, concurrency, staging и production остаются release-blocker.

- [ ] **Шаг 4: Финальная статическая проверка**

```bash
node --test tests/security-documentation.test.js
node --test tests/*.test.js
npm run build
git diff --check
```

Ожидание: все команды с кодом 0. Runtime SQL/advisors запускать только если local stack действительно готов; иначе зафиксировать точную ошибку как незакрытый gate.

- [ ] **Шаг 5: Коммит**

```bash
git add docs/supabase-operations.md SECURITY-AUDIT.md tests/security-documentation.test.js
git commit -m "docs: gate atomic image finalization rollout"
```

## Самопроверка плана

- [x] RPC, ACL, CAS, идемпотентность и cleanup-state покрыты задачами 1–2.
- [x] Runbook и достоверные release-gate покрыты задачей 3.
- [x] Везде использованы одинаковые сигнатуры `finalize_image_generation` и `finalizeImageUsage`.
- [x] Для production-кода предусмотрены RED, GREEN и проверочные команды.
- [x] План не требует staging, production, удалённых SQL-команд или учётных данных.
