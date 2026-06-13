# Backend Mock API

## Purpose

This is the first backend scaffold for story generation. It does not call a real AI API and does not save data to Supabase yet.

The goal is to prepare the future endpoint contract safely:

- keep AI keys out of frontend files;
- validate generation input on the server;
- return a story in the same shape that future AI generation should use;
- keep GitHub Pages frontend behavior unchanged until a real backend is deployed.

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

Current deployed mock backend:

```text
https://hedgehog-fox-stories.vercel.app/api/generate-story
```

No `package.json`, npm dependencies, build step, real AI API, payment API, or service role key is required for this scaffold.

## AI adapter scaffold

The backend includes an OpenAI-compatible adapter, but it is disabled by default.

Vercel environment variables for later:

```text
AI_GENERATION_ENABLED=false
AI_API_BASE_URL=
AI_API_KEY=
AI_MODEL=
```

When `AI_GENERATION_ENABLED` is not exactly `true`, the endpoint keeps using mock generation.

When real AI is enabled later:

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

## Next steps

1. Deploy the static site and backend function together on a platform that supports `/api/*`, or keep GitHub Pages for the site and deploy the backend separately.
2. Add Supabase JWT verification from the `Authorization` header.
3. Move generation limit checks from frontend-only logic to backend logic.
4. Call an OpenAI-compatible API with a server-side environment variable.
5. Validate the AI JSON response.
6. Save `stories` and `story_pages`.
7. Replace mock text generation with validated OpenAI-compatible API output.
8. Wrap story persistence and usage increment in an atomic backend operation.
