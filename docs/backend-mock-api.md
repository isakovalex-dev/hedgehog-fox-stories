# Backend Mock API

## Purpose

This is the deployed backend endpoint for story generation.

Current behavior:

- keeps AI keys only in Vercel environment variables;
- validates the Supabase access token and the generation limit on the server;
- calls an OpenAI-compatible AI provider when it is enabled, with a validated mock fallback;
- saves the story, its pages, and generation usage through the atomic Supabase RPC when available;
- returns only the data needed by the browser, without a user id or raw provider/Supabase error details.

## Endpoint

```text
POST /api/generate-story
```

File:

```text
api/generate-story.js
```

Target runtime:

```text
Vercel Node serverless function
```

Deployed backend API:

```text
https://hedgehog-fox-stories.vercel.app/api/generate-story
```

The project intentionally has no `package.json`, npm dependencies, or build step. AI
credentials stay in Vercel environment variables; payment activation remains deferred
until the legal payment setup is ready.

## AI adapter and fallback

The backend includes an OpenAI-compatible adapter. It uses validated mock generation
when the AI integration is disabled or the provider cannot return a safe, valid story.

Vercel environment variables:

```text
AI_GENERATION_ENABLED=false
AI_API_BASE_URL=
AI_API_KEY=
AI_MODEL=
```

When `AI_GENERATION_ENABLED` is not exactly `true`, the endpoint uses mock generation.
The current production deployment has been verified with AI generation enabled. The
provider configuration and API key must never be committed to this repository.

When AI generation is enabled:

- the backend calls `POST {AI_API_BASE_URL}/chat/completions`;
- the frontend still does not see the API key;
- the AI response must be valid JSON;
- backend validation still runs before saving the story;
- if AI generation fails, the endpoint falls back to mock and returns `meta.aiFallbackReason`.

## Request body

```json
{
  "topic": "потерянная ракушка",
  "ageGroup": "5-7",
  "mood": "bedtime",
  "lesson": "друзья помогают друг другу",
  "pageCount": 3
}
```

Supported values:

- `ageGroup`: `5-7` or `8-10`;
- `mood`: `bedtime`, `adventure`, `friendship`, `bravery`;
- `pageCount`: 1-5.

## Response body

```json
{
  "story": {
    "id": "backend-mock-123",
    "title": "Ежонок, Лисёнок и Потерянная ракушка",
    "ageGroup": "5-7",
    "mood": "перед сном",
    "lesson": "друзья помогают друг другу",
    "pages": [
      {
        "pageNumber": 1,
        "text": "Текст страницы",
        "sceneTag": "cozy_house",
        "imagePrompt": "Описание будущей иллюстрации"
      }
    ]
  },
  "meta": {
    "mode": "mock",
    "aiProvider": "disabled",
    "savedToDatabase": false,
    "authChecked": false,
    "usageLimitChecked": false
  }
}
```

## Local smoke test

From the project root:

```bash
cd /Users/a1234/Documents/ezhik-i-lisenok
/Users/a1234/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check api/generate-story.js
```

The function is written as a serverless handler, so local HTTP execution should be done later through a Vercel local dev setup or a small test harness.

## Frontend integration

The browser generator now tries this endpoint first when `window.HFConfig.GENERATION_API_ENABLED` is `true`.

Frontend config:

```js
GENERATION_API_ENABLED: true,
GENERATION_API_URL: "/api/generate-story"
```

Fallback behavior:

- anonymous users keep using the existing browser mock generator;
- if `/api/generate-story` returns `404`, `5xx`, times out, or cannot be reached, the frontend uses the existing browser mock generator;
- if the backend returns a validation error such as an unsafe topic, the frontend shows the backend message and does not bypass it with browser mock generation;
- generated stories are still saved through the existing `storyService.saveUserStory()` flow.

Authenticated backend checks:

- the frontend sends `Authorization: Bearer <Supabase access token>`;
- the backend validates the token through Supabase Auth;
- the backend reads or creates `subscriptions`;
- the backend reads or creates the active `generation_usage` row;
- the backend blocks generation when `generations_used >= generation_limit`;
- the backend saves generated stories to `stories` and `story_pages`;
- the backend increments `generation_usage` after a successful save;
- the frontend does not save or increment Supabase usage again for `backend mock` responses;
- browser mock fallback still increments local usage on the frontend.

## Operational next steps

1. Periodically review the AI fallback rate after 5-10 normal child-safe generations.
2. Before enabling payments, complete the legal payment setup and the YooKassa
   production checklist in `docs/launch-checklist.md`.
