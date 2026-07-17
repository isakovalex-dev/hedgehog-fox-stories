# Illustration Scenes

## Current illustration behavior

Generated stories are now illustrated immediately with the existing approved
watercolor library. The backend returns a `sceneTag` for every page, and the
frontend deterministically selects a matching file from `assets/slides-web/`.
The paired PNG in `assets/slides/` is used if the preferred JPG asset cannot
be loaded.

This means that a page is no longer text-only, while the visual language stays
consistent with the site and no extra image-service key, cost, or child-content
review path is introduced.

## Why the scene library comes first

The current text provider, DeepSeek, is used through its chat-completions API;
it does not create the image files for this project. Creating five brand-new
images per story would also make generation materially slower and more expensive.

Reasons:

- image generation is expensive;
- generation time becomes much slower;
- visual consistency is harder to control;
- child-safe image prompting needs extra review;
- a prepared scene library keeps the watercolor style stable.

The better first step is to generate text plus `sceneTag` values. The frontend then chooses an existing illustration by tag.

## Starter scene tags

- `sea_bench`
- `forest_day`
- `forest_night`
- `cozy_house`
- `starry_sky`
- `rainy_forest`
- `sunny_meadow`
- `river_bank`
- `autumn_path`
- `winter_forest`
- `warm_kitchen`
- `small_bridge`
- `hill_clouds`
- `mushroom_glade`
- `campfire_evening`

## Frontend behavior

Generated story pages should contain a `sceneTag`.

Example:

```json
{
  "pageNumber": 1,
  "text": "Ежонок и Лисёнок вышли на солнечную поляну.",
  "sceneTag": "sunny_meadow",
  "imagePrompt": "Watercolor illustration of Hedgehog and Little Fox on a sunny meadow"
}
```

The frontend should map `sceneTag` to an image path:

```js
const sceneImages = {
  sunny_meadow: "assets/scenes/sunny-meadow.png",
  forest_day: "assets/scenes/forest-day.png"
};
```

If the tag is unknown:

- use a safe fallback scene such as `forest_day`;
- keep the story readable even without an image;
- log the missing tag for future improvement.

## Future: unique AI illustrations

The first unique-image implementation is now prepared as one cover per story.
It stays disabled until the private Storage SQL and Vercel environment variables
in `docs/image-generation-setup.md` are configured.

Requirements before that step:

- backend-only image API calls;
- strict prompt validation;
- monthly generation limits;
- content safety checks;
- caching generated images;
- storage through Supabase Storage or another asset storage layer.

The implementation uses a separate image provider, never the browser. It saves
a private `storage://story-illustrations/...` reference in
`story_pages.image_url`; the client exchanges it for a short-lived signed URL
only for the authenticated owner. The image API key and Supabase Storage secret
must remain in Vercel environment variables.
