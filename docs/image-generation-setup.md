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
objects using a Supabase server secret. A signed URL is issued to the signed-in
owner only when the library is loaded.

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

The backend sends \`assets/stories/sea-bench.png\` from the public site to the
OpenAI Image Edits endpoint as a visual reference. It keeps the existing
watercolor paper, palette, pencil contour, and hero designs while the prompt
replaces the scene with the exact event of the current story page.

The default reference URL is:

\`\`\`text
https://ezhik-i-lisenok.ru/assets/stories/sea-bench.png
\`\`\`

You can replace it without a code change by adding this optional Vercel
variable in Production and Preview:

\`\`\`text
ILLUSTRATION_STYLE_REFERENCE_URL=https://ezhik-i-lisenok.ru/assets/stories/sea-bench.png
\`\`\`

Leave it unset to use the default above. This reference is public artwork from
the project; it is sent only from the Vercel backend to OpenAI, never from the
visitor's browser.

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

## Fallback behavior

If OpenAI, Vercel, or Storage is unavailable, the story remains saved and the
site uses a matching existing watercolor scene for the affected page. A failed
illustration does not consume an extra story-generation limit.
