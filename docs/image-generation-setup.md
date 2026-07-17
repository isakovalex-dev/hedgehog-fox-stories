# Unique AI Story Covers

## Scope

The first image-generation release creates one landscape cover for the first
page of an authenticated user's AI-generated story. The remaining pages keep
using the existing approved watercolor scene library.

This controls cost, keeps story text available if the image provider is slow or
fails, and avoids a second charge for retries after a cover has been saved.

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

## Verification

1. Sign in on \`https://ezhik-i-lisenok.ru\`.
2. Create a three-page story with illustrations enabled.
3. Wait for the text and cover message.
4. Confirm that the card and first reader page show the new cover.
5. In Supabase Storage, confirm the object path uses this shape:

\`\`\`text
<user-id>/<story-id>/cover.webp
\`\`\`

6. Sign out and confirm that the cover is not reachable through an old signed
   link after its one-hour expiry.

## Fallback behavior

If OpenAI, Vercel, or Storage is unavailable, the story remains saved and the
site uses a matching existing watercolor scene. A failed illustration does not
consume an extra story-generation limit.
