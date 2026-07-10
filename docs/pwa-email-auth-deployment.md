# PWA email auth and Stripe access deployment

The implementation is intentionally deployable in a disabled state. No
production switch should be enabled until the staging flow is complete.

## Services and secrets

### API Railway service

Set only on the API service:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
STRIPE_RESTRICTED_KEY
STRIPE_ALLOWED_PRODUCT_IDS=prod_UfyAnM42JA5jub
AUTH_DB_PATH=/data/auth.sqlite3
PURCHASE_URL=https://kokoromind.com/funnel/standard/
MANAGE_URL=https://kokoromind.com/manage
```

`STRIPE_RESTRICTED_KEY` needs read access only to Checkout Sessions, Customers,
and Subscriptions. The Railway Volume mounted at `/data` stores only one-time
handoff records; it is not a billing database.

Add the staging and production PWA origins to `CORS_ORIGIN`. Do not put the
Supabase secret key or Stripe restricted key in the frontend service.

### Frontend Railway service

```text
VITE_API_BASE=https://staging-api.example
VITE_WEB_AUTH_ENABLED=true
VITE_SUPABASE_URL=https://staging-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_TURNSTILE_SITE_KEY=...
```

`VITE_WEB_AUTH_ENABLED=false` is the web rollback switch. Native Capacitor and
Telegram always remain on the legacy route surface in this milestone.

### Funnel Railway service

```text
KOKORO_API_BASE=https://staging-api.example
KOKORO_PWA_APP_URL=https://staging-app.example
KOKORO_WEB_LOGIN_ENABLED=true
KOKORO_ANDROID_PWA_VARIANTS=standard
```

`KOKORO_ANDROID_PWA_VARIANTS` is a comma-separated rollout allowlist. Leave it
empty to preserve the current CTA everywhere; enable one variation first, then
add the remaining names after production verification.

## Supabase and Resend

1. Use a separate Supabase project for staging.
2. Enable email OTP and use an email template containing `{{ .Token }}`.
3. Configure OTP expiry to 10 minutes and resend cooldown to 60 seconds.
4. Configure Resend SMTP with `Kokoro <login@auth.kokoromind.com>`.
5. Publish SPF and DKIM for `auth.kokoromind.com`; start DMARC at `p=none`.
6. Disable email click tracking.
7. Enable Cloudflare Turnstile and set the matching site key in the frontend.
8. Restrict staging delivery to test recipients until E2E passes.

## Staging sequence

1. Deploy API with both legacy and `/v1` endpoints.
2. Confirm a missing token gets `401`, no subscription gets `402` on protected
   resources, and an unavailable Stripe lookup gets `503`.
3. Deploy the PWA with `VITE_WEB_AUTH_ENABLED=true` on the staging hostname.
4. Deploy the funnel with only one Android variation in the allowlist.
5. Complete Stripe test Checkout → handoff → Resend OTP → session → access →
   ElevenLabs → generation → library.
6. Test portal cancellation at period end and `Refresh access`.
7. Rebase both branches on their latest `origin/main`, rebuild, and repeat E2E.

## Production rollout and rollback

Deploy the API first, then the PWA with web auth disabled. Verify a production
test account, enable web auth, and finally allow one Android funnel variation.

Rollback requires no code revert:

- clear `KOKORO_ANDROID_PWA_VARIANTS`;
- set `KOKORO_WEB_LOGIN_ENABLED=false`;
- set `VITE_WEB_AUTH_ENABLED=false` and redeploy the frontend;
- leave `/v1` deployed and keep all legacy endpoints online.
