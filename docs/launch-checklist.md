# Public Launch Checklist

This checklist tracks what must be true before "Ежонок и Лисёнок" is treated as publicly launch-ready.

## Current Deployment

Public site:

```text
https://ezhik-i-lisenok.ru
```

Static hosting:

```text
GitHub Pages
```

Backend API:

```text
https://hedgehog-fox-stories.vercel.app
```

Backend hosting:

```text
Vercel Functions
```

## Ready

- [x] Custom domain points to GitHub Pages.
- [x] HTTPS is enabled for `https://ezhik-i-lisenok.ru`.
- [x] `www.ezhik-i-lisenok.ru` redirects to the root domain.
- [x] Static site opens on the public domain.
- [x] About page exists.
- [x] Supabase Auth is connected.
- [x] Password recovery flow exists.
- [x] User stories can be saved in Supabase.
- [x] Local fallback exists for unauthenticated users or Supabase failures.
- [x] Supabase likes are implemented.
- [x] Backend generation endpoint exists on Vercel.
- [x] Backend can use an OpenAI-compatible AI provider.
- [x] Backend has browser mock fallback.
- [x] Backend validates generated AI story output.
- [x] Generated story persistence can use the atomic Supabase RPC.
- [x] Generation usage limits exist.
- [x] Account UI shows account, storage, tariff, payment status, and manual sync.
- [x] My Library has search, sorting, counts, and empty states.
- [x] YooKassa backend scaffold exists but is not active for production.

## Must Check Before Public Sharing

Run these checks after every final deploy:

```bash
curl -I https://ezhik-i-lisenok.ru
curl -I https://ezhik-i-lisenok.ru/about.html
curl -I https://hedgehog-fox-stories.vercel.app/api/generate-story
```

Expected:

- the public site returns `200`;
- `http://ezhik-i-lisenok.ru` redirects to `https://ezhik-i-lisenok.ru`;
- the backend endpoint exists and does not expose secrets;
- no browser console errors on the public site;
- scripts and styles load with the latest cache-busting versions.

Manual browser checks:

- [ ] Open the homepage on desktop.
- [ ] Open the homepage on mobile width.
- [ ] Open `about.html`.
- [ ] Register a new test user.
- [ ] Confirm email if Supabase requires confirmation.
- [ ] Sign in.
- [ ] Sign out.
- [ ] Request password recovery.
- [ ] Generate one story while signed in.
- [ ] Confirm the story is saved in Supabase.
- [ ] Refresh the page and confirm the story remains in My Library.
- [ ] Use My Library search.
- [ ] Use My Library sorting.
- [ ] Delete a test story.
- [ ] Like and unlike a story.
- [ ] Confirm account sync refresh does not break the page.

## Required Before Paid Launch

Payments are intentionally deferred until the owner is ready for legal payment acceptance.

- [ ] Register as self-employed or choose another legal payment setup.
- [ ] Add public requisites page with real legal details.
- [ ] Submit the requisites page to YooKassa.
- [ ] Enable `PAYMENTS_ENABLED=true` only after YooKassa approval.
- [ ] Confirm Vercel has production YooKassa credentials.
- [ ] Configure YooKassa webhook:

```text
https://hedgehog-fox-stories.vercel.app/api/payment-webhook
```

- [ ] Test `payment.succeeded` webhook.
- [ ] Confirm paid subscription appears in Supabase.
- [ ] Confirm paid tariff appears in account UI.
- [ ] Add webhook idempotency before real traffic.
- [ ] Add refund and cancellation handling before real traffic.

## Legal And Trust Pages

Before broad public launch, add or prepare:

- [x] Requisites page.
- [x] Privacy policy.
- [x] Terms of use.
- [x] Consent/copy explaining generated AI content.
- [x] Contact email on the site.

Recommended URLs:

```text
https://ezhik-i-lisenok.ru/requisites.html
https://ezhik-i-lisenok.ru/privacy.html
https://ezhik-i-lisenok.ru/terms.html
```

## Operational Checklist

- [ ] Keep AI keys only in Vercel environment variables.
- [ ] Keep Supabase service role key only in Vercel environment variables.
- [ ] Do not expose payment secrets in frontend JavaScript.
- [ ] Keep `pictures/` and `export_chat_ezhik_lisenok.docx` out of commits unless explicitly approved.
- [ ] Verify Supabase RLS policies before public traffic.
- [ ] Verify generation limits from a fresh account.
- [ ] Check Vercel logs after test generation.
- [ ] Check Supabase logs after test generation.
- [ ] Review AI fallback rate after several generations.

## Current Blockers

- YooKassa cannot be completed until the legal payment setup is ready.
- Refund/cancellation webhook handling is not implemented yet.
- Payment webhook idempotency is not implemented yet.
