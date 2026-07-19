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
IMAGE_MODEL=<existing Vercel value>
IMAGE_SIZE=<existing Vercel value>
IMAGE_QUALITY=<existing Vercel value>
SUPABASE_SECRET_KEY=<Supabase secret key>
\`\`\`

\`OPENAI_IMAGE_API_KEY\` and \`SUPABASE_SECRET_KEY\` are server secrets. Do not put
them in \`js/config.js\`, a Git commit, browser DevTools, or a chat message.

The secret Supabase key is in Supabase Dashboard -> Settings -> API Keys. Prefer
the current Secret key (\`sb_secret_...\`). The backend also supports the older
\`SUPABASE_SERVICE_ROLE_KEY\` name during a transition, but new setup should use
\`SUPABASE_SECRET_KEY\`.

## Economic illustration style

The default `style_only` mode sends **no image references** to OpenAI. It uses
the versioned textual passport in `assets/illustration-style-profile.json`.
The passport records the paper, watercolor technique, palette, linework,
recurring heroes, composition rules and negative constraints inferred from the
project artwork. It is followed by the changing page event and visual brief.

This is the primary cost-saving measure: the 14 source illustrations inform the
passport once, but are not charged as image inputs on each generated page. The
public "Перерисовать" action always remains in `style_only`, so it creates a
new scene from the current page text without sending the project artwork again.

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

The source files remain listed in the passport together with their SHA-256
hashes and roles (`style`, `character`, `composition`, `optional`). Their names
are not treated as content identifiers.

### Optional non-default modes

These backend modes are reserved for future editor tooling and are never chosen
automatically:

- `with_references` sends no more than two explicitly selected allow-listed
  reference images. It is appropriate only for a specific hero, object or
  composition that cannot be described accurately in text.
- `iteration` sends just the current page illustration and a required change
  instruction. It does not resend the source style references.

### Update the passport after changing artwork

Run this from the repository root:

```bash
node scripts/update-illustration-style-profile.js
```

If a source file changed, the command refuses to update hashes silently. Review
the visual rules in `assets/illustration-style-profile.json`, then deliberately
update hashes and the profile version:

```bash
node scripts/update-illustration-style-profile.js --force
```

The script makes no paid API calls and does not send source images anywhere.

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

Vercel logs include the generation mode, style profile id/version, hashes of
non-default references, a prompt SHA-256, provider request ID and returned usage
when available. Full story text and API keys are not stored in logs.

If Vercel logs \`illustration_succeeded\` but the page still shows no image,
redeploy this endpoint update. It returns the short-lived link through
\`/api/get-story-illustration-url\`; the browser no longer depends solely on a
direct Supabase Storage signing request.

## Fallback behavior

If OpenAI, Vercel, or Storage is unavailable, the story remains saved but no
unrelated built-in artwork is substituted for that page. A failed illustration
does not consume an extra story-generation limit.
