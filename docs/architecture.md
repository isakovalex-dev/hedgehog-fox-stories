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
- mock user stories;
- mock subscription state;
- mock generation usage.

This keeps the public site usable while backend, authentication, payments, and AI generation are designed separately.

Limitations:

- data is stored only in the user's browser;
- data is not shared between devices;
- likes are local counters, not public counters;
- subscription state is only mock state and cannot be trusted.

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

- mock subscription status;
- mock generation usage;
- MVP generation limits.

Supported statuses:

- `free`
- `trial`
- `active`
- `expired`

MVP rules:

- `free`: 1 generated story;
- `trial`: 3 generated stories;
- `active`: 20 generated stories per month;
- `expired`: generation disabled.

Public functions:

- `getSubscriptionState()`
- `setSubscriptionState(status)`
- `getGenerationUsage()`
- `canGenerateStory()`
- `incrementGenerationUsage()`
- `activateMockSubscription()`

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
