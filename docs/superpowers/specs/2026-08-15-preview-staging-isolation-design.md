# Изолированный preview со staging Supabase — спецификация

## Цель

Развернуть ветку `codex/security-remediation` как Vercel Preview так, чтобы
браузер, серверные API и Storage работали только с Supabase staging-проектом
`opcnhhujyckmccvvpihc`. Preview не должен иметь возможности молча обратиться к
production-проекту `ynidvdesfolavhngubqv`.

## Границы

Входят в работу:

- сборочная конфигурация браузера;
- безопасная конфигурация серверных API для Preview;
- CSP для точных production- и staging-доменов Supabase;
- настройки Vercel Preview и проверка развёрнутого сайта;
- отключение платежей и реальной AI-генерации на Preview.

Не входят:

- production-деплой, promotion или изменение production-переменных;
- реальные платежи YooKassa;
- запросы к AI-провайдеру, создание историй или иллюстраций;
- изменение схемы staging-базы.

## Подход

### 1. Конфигурация браузера при сборке

`scripts/build-static.mjs` будет формировать `dist/js/config.js` из
переменных сборки `SUPABASE_URL` и `SUPABASE_ANON_KEY`.

- В Vercel Preview обе переменные обязательны. При отсутствии хотя бы одной
  сборка завершится ошибкой до публикации.
- Для Preview значениями будут URL и publishable key staging-проекта.
- В исходном `js/config.js` не останется рабочего production URL или ключа как
  fallback. Локальный запуск без конфигурации оставит Supabase отключённым.
- Публичный publishable key допустим в браузере. `SUPABASE_SECRET_KEY` никогда
  не передаётся в `dist` и не добавляется в `window.HFConfig`.

### 2. Относительные API-адреса

В браузерной конфигурации все API-адреса будут относительными:

- `/api/generate-story`
- `/api/generate-story-illustration`
- `/api/get-story-illustration-url`
- `/api/create-checkout`

Поэтому Preview вызывает только API того же Preview-домена, а production —
только API production-домена.

### 3. Серверные переменные и fail-closed поведение

Серверные обработчики, которые сейчас используют production Supabase как
fallback, будут требовать `SUPABASE_URL` и `SUPABASE_ANON_KEY` из окружения.
При отсутствии конфигурации они ответят статичной внутренней ошибкой и не
отправят запрос в production.

Для Vercel Preview задаются только следующие значения:

| Переменная | Назначение | Значение в Preview |
| --- | --- | --- |
| `SUPABASE_URL` | URL Supabase | URL staging-проекта |
| `SUPABASE_ANON_KEY` | публичный ключ API | publishable key staging |
| `SUPABASE_SECRET_KEY` | серверные RPC и Storage | secret key staging |
| `PAYMENTS_ENABLED` | включение YooKassa | `false` |

Ключи AI-провайдера и YooKassa в Preview не добавляются. Это намеренно: любые
запросы реальной генерации или оплаты должны завершиться безопасной ошибкой,
не создавая расходы и не обращаясь к внешним провайдерам.

### 4. CSP

Пока действует 48-часовой режим `Content-Security-Policy-Report-Only`,
`vercel.json` разрешает ровно два Supabase origin в `img-src` и `connect-src`:

- `https://ynidvdesfolavhngubqv.supabase.co` — production;
- `https://opcnhhujyckmccvvpihc.supabase.co` — staging.

Wildcard-домены и ослабление `script-src` не допускаются. В Preview браузерная
конфигурация фактически использует только staging origin; production origin
остаётся в политике лишь для существующего production-развёртывания.

### 5. Проверки

Перед публикацией добавляются автоматические проверки:

- Preview-сборка без публичных Supabase-переменных завершается ошибкой.
- Preview-сборка с staging-переменными создаёт `dist/js/config.js` только со
  staging URL, publishable key и относительными API-путями.
- Серверные обработчики не содержат рабочего production fallback.
- CSP содержит оба точных Supabase origin и не содержит wildcard или
  `unsafe-eval`.

После Vercel Preview-публикации выполняются безопасные проверки без AI и
платежей:

- главная страница, статические маршруты и защитные заголовки доступны;
- Preview-конфигурация указывает на staging;
- защищённые API без токена возвращают ожидаемую ошибку, не вызывая
  провайдеров;
- Vercel Logs проверяются на ошибки после smoke-проверок.

## Условия готовности

Работа готова к следующему решению только когда:

1. Полный локальный набор тестов и сборка проходят.
2. Vercel Preview использует staging-переменные, а не production.
3. Проверки Preview не обращаются к AI-провайдеру или YooKassa.
4. Production-домен, production-переменные и production Supabase не менялись.
5. Пользователь получает ссылку на Preview и краткий результат проверок.
