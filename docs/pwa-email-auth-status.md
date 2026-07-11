# PWA email auth — staging status

Обновлено: 11 июля 2026, вечер. Ветка: `codex/pwa-email-auth` (оба репо: этот и
`Guiltyme212/kokoro-heartfelt-moments`). Production `main` не тронут.

Контекст задачи: браузерная PWA для Android/web, вход по email + 6-значный
Supabase OTP (письма через Resend), доступ по активной подписке Stripe.
Runbook деплоя: `docs/pwa-email-auth-deployment.md`. План будущего мержа в
main: `docs/pwa-email-auth-merge-plan.md`. Оплата остаётся на funnel;
iOS и Telegram не меняются.

## Состояние: основной путь пройден вживую ✅

Полный E2E на Android подтверждён владельцем 10–11 июля:

```text
funnel (staging) → Stripe test Checkout (4242…) → thank-you →
Open Kokoro → PWA → код из письма → доступ → экран установки →
установка на домашний экран → запуск с иконки: standalone, без
повторного кода, сессия на месте
```

## Инфраструктура — готово и проверено

- **DNS/Resend**: домен `auth.kokoromind.com` verified; отправка работает
  (письма delivered, 6-значный код, отправитель `Kokoro <login@…>`).
  SMTP-ключ — `Kokoro-sendAuth` (токен у владельца). DMARC ещё не добавлен
  (перед продом: TXT `_dmarc.auth` = `v=DMARC1; p=none`).
- **Supabase staging** (`maresexyyjdemxvklfyf`): OTP length 6, expiry 600с,
  cooldown 60с, оба email-шаблона с `{{ .Token }}`, Resend SMTP,
  `rate_limit_email_sent` поднят 2 → **100/час** (дефолт 2/час — обязательный
  пункт для прод-проекта, иначе вход сломается после 2 писем!).
- **Stripe test mode**: продукт `prod_UrlzzI9T3PuxbK`; funnel staging —
  `STRIPE_SECRET_KEY` (sk_test) + `CO_PRODUCT`; API staging —
  `STRIPE_RESTRICTED_KEY` (rk_test, read-only CS/Customers/Subs) +
  `STRIPE_ALLOWED_PRODUCT_IDS`. `/v1/access`: 401/402 семантика работает,
  handoff валидирует сессии через Stripe.
- **Railway staging** (`pwa-auth-staging`): оба сервиса собраны с полным
  набором переменных; Railway CLI залогинен, funnel-репо локально в
  `~/kokoro-heartfelt-moments`.

## Продуктовые доработки в ветках (11 июля)

- **Экран установки после входа** (app `43170b8`): после свежего входа по
  коду — отдельный экран Install Kokoro (native prompt / подсказка / continue
  in browser). Session-restore и standalone его не видят. Проверен вживую.
- **Побег из Facebook in-app browser** (app `3c78c9a`, funnel `01dd8f3`):
  реклама FB/IG на Android открывается во внутреннем WebView, где установка
  PWA невозможна в принципе. Thanks-CTA при детекте IAB оборачивает переход
  в `intent://` → открывает Chrome, handoff-токен передаётся query-параметром
  (intent не умеет #fragment; PWA принимает `?handoff=` и вычищает из URL).
  Фолбэк при блокировке — навигация на месте через 1.6с. Экран установки в
  IAB показывает «Open in Chrome». **Проверено вживую из приложения Facebook
  (11 июля)**: квиз и оплата в IAB работают, intent-побег срабатывает; FB
  показывает своё системное окно «Вы покидаете приложение» (Продолжить →
  Chrome с экраном кода; Назад → фолбэк-вход внутри IAB). Обойти это окно
  нельзя — стандартная цена выхода из IAB.
- **Гейт аналитики на staging** (funnel `50fb1f8`): PostHog (prod-ключ!),
  Meta Pixel и серверный CAPI-мост инициализируются только на
  `*.kokoromind.com` — staging-прогоны больше не пачкают боевую аналитику.

## Известные наблюдения (не баги, решить до/при проде)

- Удаление аккаунта не отзывает уже выданные токены: другие устройства того
  же пользователя продолжают работать до истечения access-токена (~1 час).
  Уточнение на будущее: в `DELETE /v1/account` сначала отзывать все сессии
  (admin logout), затем удалять пользователя — тогда выход мгновенный на всех
  устройствах.
- PwaUpdatePrompt может влезть посреди входа у вернувшегося пользователя
  (после каждого деплоя первый визит грузит закэшированную версию из SW).
  Уточнение на будущее: на auth-экранах применять обновление автоматически
  без баннера (там нечего прервать); спрашивать только внутри приложения,
  чтобы не перезагрузить во время медитации/голосовой сессии.

- Desktop thank-you: главная CTA ведёт в App Store, веб-вход — маленькая
  ссылка «open in web»; при включённом веб-логине акценты стоит пересмотреть.
- В IAB нет Google Pay → на оплате чуть больше трения (ввод карты руками).
- Письмо повторного входа с нового устройства = новый код (сессии не
  переносятся между браузерами) — ожидаемое поведение.

## Осталось (по приоритету)

1. **Проход из реального приложения Facebook** (Android): пост со staging-URL
   «только я» → квиз → оплата → CTA должен выбросить в Chrome с экраном кода.
2. Тест отмены: portal → cancel at period end → «Refresh access» (доступ до
   конца периода) → refund → 402.
3. **Turnstile** перед публичным запуском (site key на фронт + secret в
   Supabase captcha; без secret заблокируются ВСЕ отправки кодов).
4. DMARC TXT (партнёр, Name.com).
5. Далее — по `docs/pwa-email-auth-merge-plan.md` (мерж в main выключенным,
   поэтапное включение, прод-Supabase с теми же настройками **включая
   rate_limit_email_sent и OTP length 6**, домен app.kokoromind.com).

## Секреты

`~/kokoro-staging-secrets.env` (машина владельца): Supabase PAT/URL/ключи,
Resend SMTP key, sk_test/rk_test Stripe, STRIPE_MCP_KEY. В git/чаты не
копировать. MCP подключены: Resend (OAuth), Stripe (API key header).
