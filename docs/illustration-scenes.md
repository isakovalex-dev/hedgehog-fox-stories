# Illustration Scenes

## Why use a scene library first

The first AI generation version should not create 5 new images for every story.

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

## Future image generation

Later, image generation can be added for paid users or selected stories.

Requirements before that step:

- backend-only image API calls;
- strict prompt validation;
- monthly generation limits;
- content safety checks;
- caching generated images;
- storage through Supabase Storage or another asset storage layer.
