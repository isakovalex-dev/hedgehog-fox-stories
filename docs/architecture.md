# Architecture

## Current state

The site is a static one-page application published through GitHub Pages. It uses plain HTML, CSS, and JavaScript without backend, npm, build tools, or frontend frameworks.

Main files:

- `index.html` defines the page structure, hero block, story list, filters, and reader container.
- `styles.css` keeps the watercolor visual style, cards, filters, reader slides, and responsive layout.
- `js/app.js` controls the interface: rendering cards, opening stories, progress bar, filters, reader mode, and UI events.
- `assets/` stores static illustrations for the hero, story cards, and reader slides.
- `docs/` stores future architecture notes.

The visual behavior remains intentionally simple:

- story cards are rendered from JavaScript data;
- filters work on tags;
- reading mode uses vertical slides and scroll snap;
- likes are stored locally;
- no backend request is required to open the site.

## Why localStorage is used now

`localStorage` is enough for the MVP because the project is still static and must work on GitHub Pages without a server. It is used for:

- liked story ids;
- anonymous and fallback user stories;
- anonymous and fallback mock subscription state;
- anonymous and fallback generation usage.

This keeps the public site usable while backend, authentication, payments, and AI generation are designed separately.

Limitations:

- data is stored only in the user's browser;
- data is not shared between devices;
- likes are local counters, not public counters;
- anonymous/fallback subscription state is only mock state and cannot be trusted.

## JavaScript services

The app now uses small browser services attached to `window` instead of ES modules. This is deliberate: ordinary script files work both on GitHub Pages and when the user opens `index.html` through `file://`.

### `storageService`

File: `js/storageService.js`

Responsibilities:

- safe JSON reads from `localStorage`;
- safe JSON writes to `localStorage`;
- safe item removal;
- fallback values if storage is unavailable or JSON is invalid.

Public functions:

- `getJSON(key, defaultValue)`
- `setJSON(key, value)`
- `removeItem(key)`

### `storyService`

File: `js/storyService.js`

Responsibilities:

- built-in story data;
- user story storage in `localStorage`;
- story normalization;
- story lookup by id;
- reader-page preparation.

Public functions:

- `getBuiltInStories()`
- `getUserStories()`
- `getAllStories()`
- `getStoryById(storyId)`
- `saveUserStory(story)`
- `deleteUserStory(storyId)`
- `prepareStoryForReader(story)`

### `likeService`

File: `js/likeService.js`

Responsibilities:

- liked story ids in `localStorage`;
- one local like per story;
- like toggling;
- displayed like count calculation.

Public functions:

- `getLikedStories()`
- `isStoryLiked(storyId)`
- `toggleStoryLike(storyId)`
- `getStoryLikeCount(story)`

### `subscriptionService`

File: `js/subscriptionService.js`

Responsibilities:

- subscription status for anonymous and authenticated users;
- generation usage for anonymous and authenticated users;
- Supabase-backed limits when the user is signed in;
- `localStorage` fallback when the user is anonymous or Supabase is unavailable.

Supported statuses:

- `free`
- `trial`
- `active`
- `expired`

MVP rules:

- `free` / `Бесплатный`: 1 generated story per 30-day period;
- `trial` / `Пробный`: 3 generated stories, recommended future period 7 days;
- `active` / `Семейный`: 20 generated stories per 30-day period;
- `expired` / `Истёк`: generation disabled, saved stories remain available.

Public functions:

- `getSubscriptionState()`
- `setSubscriptionState(status)`
- `getGenerationUsage()`
- `canGenerateStory()`
- `incrementGenerationUsage()`
- `activateMockSubscription()`
- `initializeSubscription()`
- `getStorageState()`

## Subscription and generation usage layer

Authenticated users use Supabase for generation limits.

Tables:

- `subscriptions`
- `generation_usage`

Current flow:

1. The frontend restores Supabase Auth.
2. `subscriptionService.initializeSubscription()` checks whether the user is authenticated.
3. If authenticated, `supabaseService.fetchSubscriptionBundle()` reads or creates a `subscriptions` row.
4. It also reads or creates the current-period `generation_usage` row.
5. The generator calls `canGenerateStory()` before creating a mock story.
6. If the limit is reached, generation is blocked and the subscription panel is shown.
7. If the story is saved successfully, `incrementGenerationUsage()` updates the usage counter.
8. Activating the mock subscription sets `subscriptions.status = active` and updates the usage limit to 20.

Fallback behavior:

- anonymous users use `localStorage`;
- if Supabase is unavailable, authenticated users temporarily fall back to `localStorage`;
- the UI shows a warning that cloud subscription limits are unavailable.

This is still MVP logic. Production AI generation should move the final limit check and usage increment to a backend endpoint so the user cannot bypass limits from the browser.

### `analyticsService`

File: `js/analyticsService.js`

Responsibilities:

- universal event tracking;
- sending events to Yandex Metrika if `window.ym` and a counter id are configured;
- console fallback if Metrika is absent.

Public function:

- `trackEvent(eventName, params = {})`

Tracked event names:

- `story_opened`
- `story_finished`
- `story_liked`
- `story_unliked`
- `generator_opened`
- `story_generated_mock`
- `library_opened`
- `subscription_screen_opened`
- `subscription_button_clicked`

## How the UI depends on services

`js/app.js` is the only file that directly manipulates the DOM.

Dependencies:

- story cards and reader mode use `storyService`;
- like buttons use `likeService`;
- story open, finish, like, and unlike events use `analyticsService`;
- future generator and library screens should use `storyService`, `subscriptionService`, and `analyticsService`;
- direct `localStorage` calls should stay inside services.

## Replacing localStorage with Supabase later

The current service boundaries make backend migration straightforward:

- `storyService` can replace local user stories with Supabase `stories` and `story_pages` queries;
- `likeService` can replace local liked ids with backend like endpoints and Supabase `story_likes`;
- `subscriptionService` can replace mock state with backend subscription endpoints and Supabase `subscriptions`;
- `analyticsService` can keep its interface and add server-side analytics events if needed;
- `storageService` can remain for UI preferences and optimistic temporary state.

The important rule for the next stage: frontend should call service functions, not direct backend APIs scattered across UI code.
