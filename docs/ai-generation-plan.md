# AI Generation Plan

## Goal

The generator should create short, calm, child-safe stories for children aged 5-10. The permanent heroes are always Hedgehog and Little Fox.

The first backend version should generate text only. Images should use a prepared scene library through `sceneTag`; per-page image generation can be added later.

## Story constraints

- Up to 5 pages per story.
- Main heroes: Hedgehog and Little Fox.
- Language: simple Russian for children aged 5-10.
- Tone: kind, safe, calm, warm.
- Themes: friendship, courage, care, curiosity, bedtime, nature.
- No scary, violent, manipulative, adult, or unsafe content.
- Each page should be short enough for vertical reader slides.

## API response format

The model must return JSON only:

```json
{
  "title": "Название истории",
  "ageGroup": "5-7",
  "mood": "перед сном",
  "lesson": "дружба",
  "pages": [
    {
      "pageNumber": 1,
      "text": "Текст страницы",
      "sceneTag": "forest_day",
      "imagePrompt": "Описание иллюстрации на будущее"
    }
  ]
}
```

## Backend validation

The backend must validate the model response before saving or returning it:

- JSON is valid and parseable;
- `title` is present and not too long;
- `ageGroup` is one of `5-7` or `8-10`;
- `pages` is an array with 1-5 pages;
- every page has `pageNumber`, `text`, and `sceneTag`;
- page text is not empty and not too long;
- scene tags are known or replaced with a safe fallback;
- unsafe content is rejected or regenerated.

## Scene tags instead of new images

At the first stage, the model should choose a `sceneTag` from the existing scene library. This is cheaper, faster, safer, and visually consistent.

Images can be generated later when:

- there is a stable paid plan;
- generation limits are enforced;
- prompts are validated by the backend;
- image costs are understood.

## Backend-only AI calls

The frontend must never call the AI API directly. API keys must stay on the backend in environment variables.

Backend AI adapter scaffold:

- file: `api/generate-story.js`;
- compatible endpoint: `POST {AI_API_BASE_URL}/chat/completions`;
- required env variables:
  - `AI_GENERATION_ENABLED`;
  - `AI_API_BASE_URL`;
  - `AI_API_KEY`;
  - `AI_MODEL`;
- default mode: mock generation remains active while `AI_GENERATION_ENABLED` is not `true`;
- if AI generation fails, the endpoint falls back to mock generation and records `meta.aiFallbackReason`;
- generated AI JSON is validated before saving to Supabase.

Frontend flow:

1. User opens generator.
2. Frontend checks mock or server subscription state.
3. Frontend sends a generation request to backend.
4. Backend calls the OpenAI-compatible API.
5. Backend validates JSON.
6. Backend saves the story.
7. Frontend renders the story through `storyService`.
