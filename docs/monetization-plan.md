# Monetization Plan

## Free mode

Free users should be able to try the product without payment.

Suggested free features:

- read all built-in stories;
- like stories locally or through account-based likes later;
- generate 1 custom story as a trial.

The free limit keeps costs controlled while still showing the value of personalized stories.

## Paid mode

Paid users should get a clear monthly generation allowance.

Suggested limit:

- 20 generated stories per month.

This is better than a real unlimited plan because AI generation has real variable costs. A hard monthly limit protects the service from abuse, keeps pricing predictable, and makes support easier.

## Why not true unlimited

True unlimited generation creates several risks:

- AI API costs can grow faster than subscription revenue;
- one user can overload the system;
- image generation can become especially expensive;
- payment disputes become harder when usage is uncontrolled.

The product can still use friendly wording like "up to 20 new stories every month" instead of "limited".

## Future YooKassa integration

Payment flow:

1. User clicks a subscription button.
2. Frontend calls `POST /api/create-checkout`.
3. Backend creates a YooKassa payment or subscription checkout.
4. Backend returns a confirmation URL.
5. User pays through YooKassa.
6. YooKassa sends a webhook to `POST /api/payment-webhook`.
7. Backend verifies the webhook signature.
8. Backend updates `subscriptions` in Supabase.
9. Frontend receives the updated subscription through `GET /api/subscription`.

## Subscription checks before generation

Before AI generation, the backend must:

- identify the authenticated user;
- read subscription status from Supabase;
- read current period usage from `generation_usage`;
- reject generation if the user is over the limit;
- increment usage only after a successful generation or according to a defined retry policy.

Frontend checks can improve UX, but backend checks are mandatory.
