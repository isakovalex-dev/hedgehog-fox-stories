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

- authenticated users store their own likes in this table;
- anonymous users keep likes in `localStorage`;
- current RLS allows users to read, insert, and delete only their own likes;
- public shared like counts can be added later through a backend endpoint or a read policy designed for aggregate counts.

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

## payment_events

Stores a server-side audit record for each successful payment event.

Fields:

- `provider`
- `provider_payment_id`
- `event_type`
- `payment_status`
- `user_id`
- `plan`
- `amount`
- `currency`
- `paid_at`
- `created_at`

Constraints and access rules:

- unique `(provider, provider_payment_id)` prevents a repeated YooKassa webhook from
  extending the same tariff twice;
- RLS is enabled;
- browser roles have no access to payment events;
- only the backend service role executes the payment RPC.

SQL file:

```text
docs/supabase-yookassa-payment-setup.sql
```

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

## Retired RPC: create_generated_story_with_usage

`docs/supabase-rpc-generated-story.sql` is historical only and must not be
applied. The security-remediation migration revokes execution of this direct
finalizer from browser roles and service role. The supported path is:

1. service role calls `reserve_ai_usage` before any paid provider request;
2. service role calls `create_story_from_reservation` to save the story and
   consume the completed reservation atomically;
3. `get_current_usage` is the only audited usage RPC executable by an
   authenticated browser user.
