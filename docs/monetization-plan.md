# Monetization Plan

## MVP subscription plans

The first production-ready plan set should stay simple:

| Internal status | User-facing name | Limit | Period | Payment state |
| --- | --- | --- | --- | --- |
| `free` | Бесплатный | 1 AI story | 30 days | no payment |
| `trial` | Пробный | 3 AI stories | 7 days | optional later |
| `active` | Семейный | 20 AI stories | 30 days | paid later |
| `expired` | Истёк | 0 AI stories | until renewed | blocked generation |

Current code already uses these generation limits:

- `free`: 1;
- `trial`: 3;
- `active`: 20;
- `expired`: 0.

The MVP should not promise unlimited generation. Use friendly wording like "до 20 новых историй в месяц" for the paid plan.

## Free mode

Free users should be able to try the product without payment.

Suggested free features:

- read all built-in stories;
- like stories locally or through account-based likes later;
- generate 1 custom AI story per 30-day period;
- keep access to saved library stories.

The free limit keeps costs controlled while still showing the value of personalized stories.

## Paid mode

Paid users should get a clear monthly generation allowance.

Suggested limit:

- 20 generated AI stories per month.
- user-facing name: `Семейный`.
- saved stories remain available after the monthly limit is reached.

This is better than a real unlimited plan because AI generation has real variable costs. A hard monthly limit protects the service from abuse, keeps pricing predictable, and makes support easier.

## Why not true unlimited

True unlimited generation creates several risks:

- AI API costs can grow faster than subscription revenue;
- one user can overload the system;
- image generation can become especially expensive;
- payment disputes become harder when usage is uncontrolled.

The product can still use friendly wording like "up to 20 new stories every month" instead of "limited".

## Future YooKassa integration

Payments should be added only after the plan names, limits, and UI copy are stable.

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

## User-facing copy

Use short labels in the account/subscription area:

- `Бесплатный`: "1 история в месяц";
- `Пробный`: "3 истории на 7 дней";
- `Семейный`: "до 20 историй в месяц";
- `Истёк`: "генерация временно недоступна".

When the limit is reached, show a clear message:

> Лимит генерации исчерпан. Истории в библиотеке остаются доступны.
