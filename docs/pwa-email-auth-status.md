# PWA email auth — staging status

Обновлено: 10 июля 2026, вечер. Ветка: `codex/pwa-email-auth` (оба репо: этот и
`Guiltyme212/kokoro-heartfelt-moments`). Production `main` не тронут.

Контекст задачи: браузерная PWA для Android/web, вход по email + 6-значный
Supabase OTP (письма через Resend), доступ по активной подписке Stripe.
Runbook: `docs/pwa-email-auth-deployment.md`. Оплата остаётся на funnel;
iOS и Telegram не меняются.

## Сделано и проверено

### DNS / Resend — готово полностью

- Партнёр добавил DNS-записи для `auth.kokoromind.com` (DKIM, MX, SPF) в
  Name.com; проверено через dig — значения совпадают с выданными Resend.
- Домен в Resend: **verified**. Sending on, receiving off, open/click
  tracking off.
- SMTP-ключ: используется ключ **Kokoro-sendAuth** (создан владельцем, токен
  у него). Второй ключ `supabase-staging-smtp` был создан и удалён — его
  токен недействителен.
- DMARC-записи нет. Не блокер для staging; перед production добавить TXT
  `_dmarc.auth` = `v=DMARC1; p=none`.

### Supabase staging — готово полностью

- Проект: ref `maresexyyjdemxvklfyf` (us-west-1, имя «Dimacyb's Project»),
  URL `https://maresexyyjdemxvklfyf.supabase.co`.
- Auth-конфиг задан через Management API (`PATCH /v1/projects/{ref}/config/auth`):
  - SMTP: `smtp.resend.com:465`, user `resend`, отправитель
    `Kokoro <login@auth.kokoromind.com>`;
  - OTP: срок 600 сек, повторная отправка не чаще 60 сек;
  - **`mailer_otp_length: 6`** — критично: дефолт 8, а `WebAuth.tsx`
    принимает ровно `/^\d{6}$/`. С дефолтом вход не работал бы вообще;
  - **оба** email-шаблона переведены на код `{{ .Token }}`: «Magic Link»
    (повторный вход) **и** «Confirm signup» (первый вход нового
    пользователя — по умолчанию слал ссылку вместо кода, что ломало бы
    первый вход каждому покупателю);
  - `site_url` = staging PWA URL.
- Почтовая цепочка проверена вживую: OTP отправлен через Supabase REST →
  Resend → статус delivered, письмо содержит 6-значный код, правильную тему
  «Your Kokoro login code» и отправителя.

### Railway staging (env `pwa-auth-staging`, проект KOKORO) — готово

- `kokoro-api-staging`: `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` /
  `SUPABASE_SECRET_KEY` внесены через Railway CLI. Уже стояли:
  `AUTH_DB_PATH=/data/auth.sqlite3`, `PURCHASE_URL`/`MANAGE_URL` (указывают
  на staging funnel), `CORS_ORIGIN` (включает staging PWA origin),
  `STRIPE_ALLOWED_PRODUCT_IDS`. `/health` отвечает 200.
- `kokoro-pwa-staging`: `VITE_API_BASE`, `VITE_WEB_AUTH_ENABLED=true`,
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` стоят; PWA
  пересобрана, Supabase URL подтверждён в собранном JS-бандле на живом URL.
- Публичный ключ Supabase: `sb_publishable__euN0RsOskTnRBpoUsYlvA_cJDPn2g6`
  (не секрет, запечён в бандл).

### Известное состояние, не баг

- `/v1/access` (и другие защищённые `/v1/*`) отвечают
  `503 AUTH_NOT_CONFIGURED`. Так задумано: `main.py` включает auth-модуль
  только когда задан ещё и `STRIPE_RESTRICTED_KEY` (его пока нет). Фронтенд
  на 503 показывает экран «Temporary issue» с кнопкой Refresh access.
- Сессия персистентна: `persistSession + autoRefreshToken`
  (`app/src/lib/supabase.ts`), код вводится один раз на устройство/браузер.

## Осталось сделать (по порядку)

1. **Ручной UI-тест входа** на
   `https://kokoro-pwa-staging-pwa-auth-staging.up.railway.app`:
   email → письмо → код → сессия; закрыть PWA → открыть → кода не спрашивает.
   Ожидаемо после входа: «We couldn't check your access» (Stripe ещё нет).
2. **Stripe test mode** (делает владелец в Stripe dashboard, Test mode):
   тестовый Product + restricted key (`rk_test_...`) с read-доступом только к
   Checkout Sessions, Customers, Subscriptions. Затем: внести
   `STRIPE_RESTRICTED_KEY` в Railway API staging и сверить
   `STRIPE_ALLOWED_PRODUCT_IDS` с ID тестового продукта.
3. **Проверить включение защиты**: после перезапуска API — `401` без токена,
   `402` с сессией без подписки, `200 access=true` с тестовой подпиской.
4. **Funnel staging** (репо `kokoro-heartfelt-moments`, Railway-проект
   `kokoro-website`, сервис `kokoro-funnel-staging`): нужен Stripe test
   secret key; проверить `KOKORO_API_BASE`, `KOKORO_PWA_APP_URL`,
   `KOKORO_WEB_LOGIN_ENABLED`, `KOKORO_ANDROID_PWA_VARIANTS`.
5. **Полный E2E**: test Checkout → thank-you «Open Kokoro» → handoff → OTP →
   access=true → chat → generation → library. Плюс отмена через portal
   (доступ до конца периода) и «Refresh access».
6. **Turnstile** (Cloudflare) — перед публичным запуском, не блокер E2E:
   ключ в `VITE_TURNSTILE_SITE_KEY` + пересборка PWA.
7. Перед production: rebase обеих веток на свежий `origin/main`, повторный
   E2E, DMARC-запись, production-раскатка по runbook (API → PWA с выключенным
   web auth → включение → одна Android-вариация funnel).

## Секреты — где лежат

Локальный файл на машине владельца: `~/kokoro-staging-secrets.env`
(SUPABASE_ACCESS_TOKEN, RESEND_SMTP_KEY, SUPABASE_URL,
SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY; туда же добавить
STRIPE_RESTRICTED_KEY). В git и в чаты значения не копировать; в Railway
вносить напрямую (CLI залогинен: `railway whoami` → Dimacyb@gmail.com).
