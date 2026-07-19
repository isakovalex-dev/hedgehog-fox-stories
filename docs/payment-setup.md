# Payment Setup

## Current state

Payments use a backend-first flow. The public site asks the backend to create a checkout session, and the backend redirects the user to the payment provider.

Backend endpoints:

```text
POST /api/create-checkout
POST /api/payment-webhook
```

Files:

```text
api/create-checkout.js
api/payment-webhook.js
```

YooKassa is the selected provider for the MVP. The public interface exposes a
single `Семейный` plan: **299 ₽** for **30 days**, up to **20 new stories**, with
**no automatic renewal**. The amount, period, and limit are fixed and validated by
the Vercel backend and Supabase payment RPC, not accepted from the browser.

## Environment variables

Vercel variables for the payment backend:

```text
PAYMENTS_ENABLED=false
PAYMENT_PROVIDER=
PAYMENT_CHECKOUT_URL=
PAYMENT_WEBHOOK_SECRET=
```

`PAYMENT_WEBHOOK_SECRET` is used only by the optional `manual` provider. YooKassa
webhooks are verified by retrieving the payment from the YooKassa API with the
server-side shop credentials.

YooKassa production mode:

```text
PAYMENTS_ENABLED=true
PAYMENT_PROVIDER=yookassa
YOOKASSA_SHOP_ID=<shop_id_from_yookassa>
YOOKASSA_SECRET_KEY=<secret_key_from_yookassa>
YOOKASSA_RETURN_URL=https://ezhik-i-lisenok.ru/?route=/library&payment=return
SUPABASE_SECRET_KEY=<supabase_secret_key>
```

Important:

- `SUPABASE_SECRET_KEY` must be stored only in Vercel backend environment variables.
- Do not put `SUPABASE_SECRET_KEY`, `YOOKASSA_SECRET_KEY`, the shop ID, or any payment secret into frontend JavaScript.
- After changing Vercel environment variables, redeploy the backend project.
- The server accepts exactly `299.00 RUB`; do not add a browser-editable price field.
- Keep `PAYMENTS_ENABLED=false` until the database setup below has been executed and
  all variables are present.

Optional manual checkout mode for a temporary external payment link:

```text
PAYMENTS_ENABLED=true
PAYMENT_PROVIDER=manual
PAYMENT_CHECKOUT_URL=https://example.com/checkout
PAYMENT_WEBHOOK_SECRET=long-random-secret
```

Manual mode returns a configured checkout URL but does not automatically update Supabase subscriptions.

## Create checkout contract

Request:

```text
POST /api/create-checkout
Authorization: Bearer <Supabase access token>
```

Response when payments are disabled:

```json
{
  "error": "Checkout creation failed",
  "message": "Payments are disabled",
  "details": null
}
```

Response for manual mode:

```json
{
  "checkout": {
    "checkoutUrl": "https://example.com/checkout",
    "provider": "manual",
    "plan": "family"
  },
  "meta": {
    "paymentsEnabled": true,
    "provider": "manual",
    "authChecked": true
  }
}
```

Response for YooKassa mode:

```json
{
  "checkout": {
    "checkoutUrl": "https://yoomoney.ru/checkout/payments/v2/contract?orderId=...",
    "provider": "yookassa",
    "plan": "family",
    "providerPaymentId": "...",
    "status": "pending",
    "amount": {
      "value": "299.00",
      "currency": "RUB"
    },
    "accessDays": 30,
    "generationLimit": 20,
    "autoRenew": false
  },
  "meta": {
    "paymentsEnabled": true,
    "provider": "yookassa",
    "authChecked": true
  }
}
```

## Payment webhook contract

Request:

```text
POST /api/payment-webhook
```

YooKassa webhook URL:

```text
https://hedgehog-fox-stories.vercel.app/api/payment-webhook
```

YooKassa event to subscribe to:

```text
payment.succeeded
```

Current YooKassa behavior:

- accepts `payment.succeeded`;
- verifies the payment by requesting the current payment object from YooKassa API;
- requires `status: succeeded` and `paid: true`;
- reads `metadata.userId`, `metadata.plan`, the 30-day period, and the 20-story limit;
- verifies the recipient shop, plan metadata, currency, and configured price before
  changing access;
- calls an atomic Supabase RPC that records the payment event and activates the
  family period once;
- ignores repeated delivery of the same provider payment without extending access;
- returns HTTP 200 to YooKassa after successful processing.

Before enabling YooKassa mode, run this SQL once in Supabase SQL Editor:

```text
docs/supabase-yookassa-payment-setup.sql
```

The SQL creates `payment_events` with RLS enabled and no browser policies. It also
creates `apply_yookassa_payment`, a `security invoker` RPC executable only by
`service_role`. It records a successful YooKassa payment before changing the
subscription and usage period, so repeated webhooks cannot grant the same access twice.

Manual webhook behavior:

- verifies that payments are enabled;
- verifies that a webhook secret is configured;
- verifies the `X-Payment-Webhook-Secret` header;
- accepts valid JSON payloads;
- does not update Supabase subscriptions yet.

## YooKassa setup checklist

1. Wait for YooKassa approval and sign the contract.
2. Run `docs/supabase-yookassa-payment-setup.sql` in Supabase SQL Editor.
3. In Vercel, add or edit the environment variables listed above, then redeploy the backend project.
4. In YooKassa dashboard, add webhook URL:

```text
https://hedgehog-fox-stories.vercel.app/api/payment-webhook
```

5. Enable the `payment.succeeded` event.
6. On the public site, sign in and click `Оплатить 299 ₽`.
7. Complete a test payment.
8. Confirm that one `payment_events` row and one family subscription period were created.
9. Send the same test webhook again and confirm it returns `alreadyProcessed: true`.
10. Return to the site and verify that the account shows the family tariff.

## Next production step

1. Add authoritative subscription RLS rules before public paid traffic, so browser
   requests cannot change a paid tariff or a generation counter directly.
2. Add cancellation/refund event handling.
3. Add renewal only if a future product decision introduces it. The current plan has no auto-renewal.
