# Supabase Schema

## profiles

Stores public and account-level user profile data.

Fields:

- `id`
- `email`
- `created_at`

Notes:

- `id` should match Supabase Auth user id.
- Row-level security should allow users to read and update only their own profile unless public profile fields are added later.

## stories

Stores story metadata.

Fields:

- `id`
- `user_id`
- `title`
- `age_group`
- `mood`
- `lesson`
- `visibility`
- `created_at`
- `updated_at`

Notes:

- `user_id` is nullable for built-in public stories or system stories.
- `visibility` can be `public`, `private`, or `unlisted`.

## story_pages

Stores story page content and illustration references.

Fields:

- `id`
- `story_id`
- `page_number`
- `text`
- `scene_tag`
- `image_url`
- `image_prompt`

Notes:

- `page_number` should be unique per `story_id`.
- `scene_tag` maps generated text to a prepared illustration scene.

## story_likes

Stores user likes for stories.

Fields:

- `id`
- `story_id`
- `user_id`
- `created_at`

Constraints:

- unique `(story_id, user_id)`.

Notes:

- public story like counts can be calculated from this table;
- private story likes can be hidden or limited to the owner.

## subscriptions

Stores payment and subscription state.

Fields:

- `id`
- `user_id`
- `status`
- `provider`
- `provider_subscription_id`
- `current_period_start`
- `current_period_end`
- `created_at`
- `updated_at`

Notes:

- `status` can be `free`, `trial`, `active`, `expired`, `cancelled`, or provider-specific states mapped to app states.
- `provider` can be `yookassa` later.

## generation_usage

Stores generation usage per billing period.

Fields:

- `id`
- `user_id`
- `period_start`
- `period_end`
- `generations_used`
- `generation_limit`

Constraints:

- unique `(user_id, period_start, period_end)`.

Notes:

- backend must check this table before calling the AI provider;
- usage should reset per billing period.
