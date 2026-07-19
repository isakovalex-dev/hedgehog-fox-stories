# AI Story Illustrations

## Scope

The image-generation release creates one landscape illustration for every page
of an authenticated user's AI-generated story. Each request includes the exact
page text and its page-specific scene description, so the illustration follows
the event described in that page rather than only the general mood.

The site creates pages one at a time, shows progress, keeps story text available
if the image provider is slow or fails, and avoids a second charge when an
already saved page is requested again.

## Storage setup

Run this file in Supabase SQL Editor:

\`\`\`text
docs/supabase-story-illustrations-storage.sql
\`\`\`

It creates a private \`story-illustrations\` bucket. The Vercel backend uploads
objects using a Supabase server secret. The site requests a short-lived signed
URL from the Vercel backend only after that backend verifies the signed-in story
owner. This works even if an older bucket is missing its browser-side Storage
policy, while the SQL policy remains useful as defence in depth.

## Vercel environment variables

Set these in Production and Preview after the SQL succeeds:

\`\`\`text
IMAGE_GENERATION_ENABLED=true
OPENAI_IMAGE_API_KEY=<OpenAI API key>
IMAGE_MODEL=gpt-image-1
IMAGE_SIZE=1536x1024
IMAGE_QUALITY=low
SUPABASE_SECRET_KEY=<Supabase secret key>
\`\`\`

\`OPENAI_IMAGE_API_KEY\` and \`SUPABASE_SECRET_KEY\` are server secrets. Do not put
them in \`js/config.js\`, a Git commit, browser DevTools, or a chat message.

The secret Supabase key is in Supabase Dashboard -> Settings -> API Keys. Prefer
the current Secret key (\`sb_secret_...\`). The backend also supports the older
\`SUPABASE_SERVICE_ROLE_KEY\` name during a transition, but new setup should use
\`SUPABASE_SECRET_KEY\`.

## Consistent illustration style

The backend combines fourteen existing illustrations into one reduced contact
sheet and sends that single sheet to the OpenAI Image Edits endpoint. The sheet
retains the shared palette, paper texture, linework and hero design without
asking the model to preserve a full-size prior scene. The current page text is
the source of truth for the new composition.

Main story illustrations:

- \`assets/stories/sea-bench.png\` for the recurring heroes and light coastal palette;
- \`assets/stories/rustling-grass.png\` for evening watercolor texture;
- \`assets/stories/hedgehog-bravery.png\` for forest foliage and the heroes' proportions;
- \`assets/stories/star-for-friend.png\` for delicate night colors and paper edges;
- \`assets/stories/lost-cloud.png\` for soft airy skies and open compositions;
- \`assets/stories/warm-wind-map.png\` for warm earth tones and travel details.

Page scenes from the existing web slides:

- \`assets/slides-web/hedgehog-bravery-1.jpg\`;
- \`assets/slides-web/hedgehog-bravery-3.jpg\`;
- \`assets/slides-web/lost-cloud-1.jpg\`;
- \`assets/slides-web/lost-cloud-3.jpg\`;
- \`assets/slides-web/rustling-grass-1.jpg\`;
- \`assets/slides-web/sea-bench-1.jpg\`;
- \`assets/slides-web/star-for-friend-1.jpg\`;
- \`assets/slides-web/warm-wind-map-1.jpg\`.

Together they form \`assets/illustration-style-sheet.jpg\`. The endpoint submits
this one file through the standard multipart \`image\` field. The model receives
a style guide rather than fourteen separate scene canvases, reducing accidental
reuse of a bench, forest clearing, clouds or character pose from an old story.

All sources are public artwork from the project. The sheet is sent only from
the Vercel backend to OpenAI, never from the visitor's browser.

## Style reference reliability

The Vercel Function bundles \`assets/illustration-style-sheet.jpg\` and reads it
locally before calling OpenAI. If an old deployment does not contain the file,
it retries the public site URL once.

## Verification

1. Sign in on \`https://ezhik-i-lisenok.ru\`.
2. Create a three-page story with illustrations enabled.
3. Wait for the page-by-page illustration progress and completion message.
4. Confirm that the card and every reader page show the matching illustration.
5. In Supabase Storage, confirm the object path uses this shape:

\`\`\`text
<user-id>/<story-id>/page-1.webp
\`\`\`

6. Sign out and confirm that a page illustration is not reachable through an
   old signed link after its one-hour expiry.

If Vercel logs \`illustration_succeeded\` but the page still shows no image,
redeploy this endpoint update. It returns the short-lived link through
\`/api/get-story-illustration-url\`; the browser no longer depends solely on a
direct Supabase Storage signing request.

## Fallback behavior

If OpenAI, Vercel, or Storage is unavailable, the story remains saved but no
unrelated built-in artwork is substituted for that page. A failed illustration
does not consume an extra story-generation limit.
