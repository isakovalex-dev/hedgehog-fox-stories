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

No real payment provider is connected yet. The site must not collect money until provider credentials, webhook verification, and subscription updates are implemented and tested.

YooKassa is the selected provider for the MVP.

## Environment variables

Vercel variables for the payment backend:

```text
PAYMENTS_ENABLED=false
PAYMENT_PROVIDER=
PAYMENT_CHECKOUT_URL=
PAYMENT_WEBHOOK_SECRET=
```

YooKassa production mode:

```text
PAYMENTS_ENABLED=true
PAYMENT_PROVIDER=yookassa
YOOKASSA_SHOP_ID=<shop_id_from_yookassa>
YOOKASSA_SECRET_KEY=<secret_key_from_yookassa>
YOOKASSA_RETURN_URL=https://ezhik-i-lisenok.ru
YOOKASSA_FAMILY_PRICE_RUB=299.00
SUPABASE_SERVICE_ROLE_KEY=<supabase_service_role_key>
```

Important:

- `SUPABASE_SERVICE_ROLE_KEY` must be stored only in Vercel backend environment variables.
- Do not put `SUPABASE_SERVICE_ROLE_KEY`, `YOOKASSA_SECRET_KEY`, or any payment secret into frontend JavaScript.
- After changing Vercel environment variables, redeploy the backend project.

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
    "plan": "family",
    "userId": "..."
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
    "userId": "..."
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
- reads `metadata.userId` and `metadata.plan`;
- creates an active `family` subscription row in Supabase;
- returns HTTP 200 to YooKassa after successful processing.

Manual webhook behavior:

- verifies that payments are enabled;
- verifies that a webhook secret is configured;
- verifies the `X-Payment-Webhook-Secret` header;
- accepts valid JSON payloads;
- does not update Supabase subscriptions yet.

## YooKassa setup checklist

1. In Vercel, add or edit the environment variables listed above.
2. Redeploy the Vercel backend project.
3. In YooKassa dashboard, add webhook URL:

```text
https://hedgehog-fox-stories.vercel.app/api/payment-webhook
```

4. Enable the `payment.succeeded` event.
5. On the public site, sign in and click the subscription payment button.
6. Complete a test payment.
7. Return to the site and verify that the account shows the family tariff.

## Next production step

1. Add idempotency for repeated YooKassa webhooks.
2. Add subscription expiration handling.
3. Add cancellation/refund event handling.
4. Add account UI for payment status and tariff management.
