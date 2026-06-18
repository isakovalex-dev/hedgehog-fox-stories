# Backend Plan

## Target architecture

The frontend can remain a static site on GitHub Pages. The backend should be added separately through serverless functions:

- Vercel Functions; or
- Netlify Functions.

Database and authentication:

- Supabase Auth for user accounts;
- Supabase Postgres for profiles, stories, pages, likes, subscriptions, and generation usage.

AI generation:

- AI API calls must happen only on the backend;
- OpenAI-compatible API keys must be stored only in backend environment variables;
- API keys must never be exposed in `index.html`, CSS, or frontend JavaScript.

Payments:

- payment creation should happen on the backend;
- payment webhooks should update Supabase subscription rows;
- frontend should only show checkout links returned by the backend.

## Future endpoints

### AI generation

- `POST /api/generate-story`

Creates a story generation request for the authenticated user. The backend checks subscription and usage limits, calls the AI provider, validates JSON, saves the story, increments usage, and returns the saved story.

Current scaffold:

- file: `api/generate-story.js`;
- runtime target: Vercel-style Node serverless function;
- current mode: mock by default, optional OpenAI-compatible adapter behind `AI_GENERATION_ENABLED=true`;
- current persistence: validates the Supabase JWT, checks generation limits, then tries `create_generated_story_with_usage` RPC to save `stories`, `story_pages`, and usage in one transaction;
- current persistence fallback: if the RPC is not installed yet, backend uses the older REST save plus usage increment path;
- current fallback: if AI is enabled but the provider fails or returns invalid JSON, backend saves a mock story and returns `meta.aiFallbackReason`;
- purpose: keep the endpoint contract stable before enabling a paid AI provider and payment flow.

### Stories

- `GET /api/stories`
- `POST /api/stories`
- `DELETE /api/stories/:id`

`GET /api/stories` returns public stories and the user's own stories.

`POST /api/stories` saves a user-created or AI-generated story.

`DELETE /api/stories/:id` deletes only stories owned by the current user.

### Likes and ratings

- `POST /api/stories/:id/like`
- `DELETE /api/stories/:id/like`
- `GET /api/stories/:id/likes`

Likes should be stored on the server instead of only in `localStorage`.

Recommended table: `story_likes`

Fields:

- `id`
- `story_id`
- `user_id`
- `created_at`

Constraints:

- unique constraint on `(story_id, user_id)` so one user can like one story only once.

Behavior:

- authenticated users store likes on the server;
- public stories show a shared total like counter;
- private user stories can store likes only for the owner or disable the public like counter;
- frontend can use optimistic UI, but server response is the source of truth.

### Subscription

- `GET /api/subscription`
- `POST /api/create-checkout`
- `POST /api/payment-webhook`

`GET /api/subscription` returns current user subscription and generation usage.

`POST /api/create-checkout` creates a payment session or payment link.

`POST /api/payment-webhook` receives payment provider events and updates Supabase.

Current payment scaffold:

- files: `api/create-checkout.js`, `api/payment-webhook.js`;
- default mode: disabled while `PAYMENTS_ENABLED` is not `true`;
- manual mode can return `PAYMENT_CHECKOUT_URL` for a temporary external payment link;
- YooKassa mode creates a redirect payment through YooKassa API;
- YooKassa webhook verifies the payment by requesting the current payment object from YooKassa API;
- successful YooKassa payments create an active `family` subscription row in Supabase through the service role key;
- webhook idempotency, expiration handling, refunds, and cancellation events are still pending.

## Security rules

- frontend must not contain AI keys, payment keys, or Supabase service role keys;
- generation limits must be checked on the backend;
- story ownership must be checked on every private story mutation;
- payment webhooks must verify provider events before changing subscriptions;
- localStorage can remain only for UI preferences and temporary optimistic state.
