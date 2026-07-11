# План: слияние PWA email-auth в main и продакшн-раскатка без поломок

## Контекст

Ветка `codex/pwa-email-auth` (этот репо + funnel-репо `kokoro-heartfelt-moments`) добавляет PWA для Android/web: вход по email-коду (Supabase OTP + Resend) и проверку подписки Stripe на каждый запрос. Нужно влить это в `main` так, чтобы production Railway (авто-деплой из main: фронт `app/`, API `api/`), iOS-приложение и Telegram Mini App не пострадали.

**Почему это безопасно осуществимо:** код написан по принципу «deploy disabled». Разведка подтвердила:
- Фронт: вся новая логика за одним переключателем `isProtectedWebClient()` ([platform.ts](app/src/lib/platform.ts)) = `VITE_WEB_AUTH_ENABLED==='true'` && не-Capacitor && не-Telegram. Без флага: ни service worker, ни Supabase, ни экранов входа. iOS и Telegram исключены даже при включённом флаге.
- API: auth-модуль строится только при наличии ВСЕХ четырёх секретов (`SUPABASE_URL/PUBLISHABLE/SECRET` + `STRIPE_RESTRICTED_KEY`), иначе `/v1/*` → 503, легаси-роуты байт-в-байт как раньше ([main.py:177-210](api/src/kokoro_api/main.py#L177)).
- `main` не двигался с точки ветвления (merge-base == 298dfc6) — слияние тривиально.
- Безусловные изменения для всех клиентов минимальны: `cache:'no-store'` на API-запросах, manifest-ссылка, theme-color кремовый, бандл больше (+supabase-js). Не ломающие, но проверяем явно.
- Реальные риски: (1) новая Python-зависимость `PyJWT[crypto]` импортируется легаси-цепочкой — если не установится, падает ВЕСЬ API; (2) нет теста на «выключенное» состояние; (3) CI собирает фронт только с флагом ON, а прод сначала поедет с OFF.

**Ответ на вопрос про Apple ID (iPhone):** ты прав, для нашего пайплайна email — правильный выбор. Ключ доступа — email, совпадающий с email покупки в Stripe. Sign in with Apple часто отдаёт скрытый relay-адрес (`xxx@privaterelay.appleid.com`), который никогда не совпадёт с email из Stripe → проверка подписки сломается. Требования Apple добавлять «Sign in with Apple» нет: оно действует только для сторонних соцлогинов, а email-код — первопартийный вход. НО: включение email-auth и пейволла в iOS-приложении — отдельная будущая веха, не этот план: экран «Get access» со ссылкой на внешнюю оплату в iOS-приложении регулируется правилами App Review (anti-steering) и требует отдельной проработки. В этом плане iOS остаётся на легаси, как задумано.

**Предусловие всего плана:** staging E2E полностью зелёный (Stripe test checkout → handoff → OTP → доступ → генерация → библиотека → отмена → Refresh access) — текущая работа по [docs/pwa-email-auth-status.md](docs/pwa-email-auth-status.md).

---

## Фаза 0 — Укрепление ветки до слияния

1. **Тест выключенного состояния** — новый `api/tests/routes/test_auth_disabled.py` (по образцу соседних тестов): app без `auth_services` → `GET /v1/access` = 503 `AUTH_NOT_CONFIGURED`, `POST /v1/auth/handoffs` = 503, легаси-роут в том же app работает. Это контракт, в котором прод проживёт первые дни.
2. **CI-сборка фронта с флагом OFF** — в [.github/workflows/ci.yml](.github/workflows/ci.yml) добавить второй `pnpm build` без auth-переменных (сейчас собирается только ON; прод сначала поедет OFF).
3. **Boot-smoke PyJWT**: `cd api && uv sync --frozen && uv run python -c "import kokoro_api.main"` — имитация того, что сделает Railway.
4. **Гигиена прод-окружения Railway** (read-only проверка + один подготовительный шаг):
   - убедиться, что на прод-сервисах НЕТ новых переменных (`railway variables` по каждому);
   - **прикрепить Volume к прод-API на `/data`** (staging имеет, прод — нет; рестарт сервиса — сделать в тихое окно, проверить `/health`); `AUTH_DB_PATH` пока НЕ ставить;
   - тег `git tag pre-pwa-auth-merge 298dfc6` — именованная точка отката.
5. Rebase-проверка перед PR: если `main` уехал — rebase ветки, повторный staging-smoke. То же в funnel-репо.

## Фаза 1 — Механика слияния

- **PR в обоих репо**, слияние merge-коммитом (не squash) — один revert-target `git revert -m 1 <sha>`.
- **Порядок: этот репо первым**, funnel вторым (funnel ссылается на API; его флаги `KOKORO_WEB_LOGIN_ENABLED`/`KOKORO_ANDROID_PWA_VARIANTS` остаются выключенными при слиянии).
- После merge наблюдать прод-деплой обоих сервисов + зелёный CI на push в main.
- **Staging-окружения перенацелить на `main`** (Settings → Source в обоих staging-сервисах), не удалять — это постоянная репетиционная площадка: каждый флаг сначала включаем на staging. Ветки удалить через ~2 недели после стабильного прода.

## Фаза 2 — Продакшн-последовательность (каждый шаг самодостаточен и безопасен)

### 2.1 После merge: всё выключено — проверить, что легаси не тронуто
- `curl /health` → 200; `curl /v1/access` → 503 `AUTH_NOT_CONFIGURED`; логи API — чистый старт, **нет ImportError** (риск PyJWT; лечится Railway-редеплоем предыдущего билда).
- **iOS** (текущий App Store-билд, без OTA — он ходит в этот же прод-API): открыть, библиотека, одна генерация.
- **Telegram**: открыть, библиотека, генерация (заодно проверка нового среза `?` из hash-роутера).
- **Прод-web**: нет экрана входа; DevTools → Service Workers: пусто; запросы без `/v1` и без `Authorization`.
- Явные проверки безусловных изменений: генерация+библиотека в Telegram (cache no-store), цвет адресной строки Android Chrome (кремовый — ок), manifest отдаёт 200, первая загрузка на слабом телефоне (бандл вырос).

### 2.2 Прод-Supabase + домен (параллельно, без влияния на пользователей)
- **Новый Supabase-проект** (отдельный от staging), настройка как staging — через Management API по образцу из status-дока: OTP length **6** (дефолт 8 ломает 6-значный UI), expiry 600с, cooldown 60с, SMTP `smtp.resend.com:465`/`resend`, отправитель `Kokoro <login@auth.kokoromind.com>`, **ОБА шаблона** с `{{ .Token }}` — «Confirm signup» (письмо новому пользователю) и «Magic Link» (письмо повторного входа; это только название шаблона у Supabase — сам вход по ссылке мы не используем, с `{{ .Token }}` в письме будет 6-значный код), site_url = прод-домен PWA. Отдельный Resend SMTP-ключ для прода. Проверка живым письмом до подключения куда-либо.
- **Домен `app.kokoromind.com`**: партнёр добавляет CNAME на Railway-фронт, в Railway подключить custom domain (TLS автоматом). Сделать ДО включения веб-входа: установленная PWA и сессии привязываются к домену навсегда; домен уже в дефолтах CORS кода.
- **DMARC**: партнёр добавляет TXT `_dmarc.auth` = `v=DMARC1; p=none` (та же панель Name.com).
- **Stripe live mode**: restricted key `rk_live_...` (read-only: Checkout Sessions, Customers, Subscriptions — только руками в дашборде), подтвердить live product ID (сверить с `prod_UfyAnM42JA5jub` из дефолтов).

### 2.3 Включить auth на прод-API (один батч переменных, один редеплой)
`SUPABASE_URL/PUBLISHABLE_KEY/SECRET_KEY`, `STRIPE_RESTRICTED_KEY=rk_live_...`, `STRIPE_ALLOWED_PRODUCT_IDS=<live id>`, `AUTH_DB_PATH=/data/auth.sqlite3`, `PURCHASE_URL`, `MANAGE_URL`. Проверки: `/v1/access` без токена → **401** (был 503); с сессией без подписки → **402** с purchaseUrl; логи чистые; один легаси-запрос из Telegram — не тронут.

### 2.4 Включить веб-вход на прод-фронте
`VITE_WEB_AUTH_ENABLED=true`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` → редеплой (пересборка). Проверить запечённый URL в бандле (как на staging). **Внимание: это видимый порог** — прод-web становится «только для залогиненных»; перед включением глянуть в PostHog, есть ли живой анонимный веб-трафик. E2E своим email: вход → письмо (Resend: delivered) → код → сессия → 402-экран с ссылкой на funnel; перезапуск браузера — без нового кода. **Сразу перепроверить iOS и Telegram** — оба без экрана входа.

### 2.5 Funnel + полный E2E покупки
Funnel-прод: `KOKORO_API_BASE`, `KOKORO_PWA_APP_URL=https://app.kokoromind.com`, `KOKORO_WEB_LOGIN_ENABLED=true`, `KOKORO_ANDROID_PWA_VARIANTS=standard` (одна вариация). **Реальная карта** (в прод-API живой ключ — тестовые сессии не пройдут): покупка → thank-you «Open Kokoro» → handoff → код → access=true → генерация → библиотека; отмена через portal (доступ до конца периода) → refund в Stripe → «Refresh access» показывает 402. Стоимость проверки — один рефанд.

### 2.6 Гейт публичного запуска → расширение вариаций
Чеклист: DMARC резолвится (`dig`), **Turnstile** (site key на фронт + secret в Supabase captcha — включение без secret заблокирует ВСЕ отправки кодов, перепроверить вход после включения), Resend без bounce/complaint, 24–48ч тихих логов. Потом `KOKORO_ANDROID_PWA_VARIANTS=<полный список>`.

## Фаза 3 — Предохранители iOS/Telegram

- **НЕ запускать `pnpm run release:ota`** до: несколько дней зелёного прод-web E2E + нативный smoke нового бандла на устройстве. Merge в main НЕ пушит OTA — App Store-билд живёт со старым бандлом, пока команду не запустят руками. Записать это в status-док (чтобы ни одна агент-сессия не запустила «услужливо»).
- Перед будущим OTA: в локальном `app/.env` не должно быть `VITE_WEB_AUTH_*`/`VITE_SUPABASE_*` (гвард защитит, но auth-конфигу в нативном бандле делать нечего). После OTA: загрузка мимо сплэша (белый экран = module-load crash), Apple sign-in, генерация, библиотека. Откат — Capgo dashboard: вернуть предыдущий бандл на канал `production`.
- Telegram: действий не требует, перепроверять после каждой пересборки фронта (2.1, 2.4, 2.6).

## Фаза 4 — Рычаги отката (без ревертов кода)

| Фаза | Рычаг |
|---|---|
| 2.1 не бутится | Railway «redeploy previous» / `git revert -m 1 <merge-sha>` |
| 2.3 | убрать `STRIPE_RESTRICTED_KEY` → `/v1` снова 503, легаси не тронуто |
| 2.4 | `VITE_WEB_AUTH_ENABLED=false` + редеплой фронта |
| 2.5 | очистить `KOKORO_ANDROID_PWA_VARIANTS`; `KOKORO_WEB_LOGIN_ENABLED=false` |
| после OTA | Capgo: предыдущий бандл на канал production |

## Фаза 5 — Мониторинг после запуска (ежедневно первую неделю)

Resend: delivered ~100%, ноль bounce/complaint. Supabase Auth-логи: «отправлено vs подтверждено» (расхождение = проблема доставки/UX). API-логи: 5xx на `/v1` ≈ 0, ошибки handoff, `StripeUnavailableError`. `/data/auth.sqlite3` существует и мал. Stripe: конверсия checkout. Тревога «код не подходит» → первым делом проверить прод-Supabase: `mailer_otp_length` всё ещё 6 и шаблоны с `{{ .Token }}`.

## Верификация плана в целом

Каждая фаза имеет встроенные проверки (curl-статусы, живые письма, e2e с реальной картой, iOS/Telegram-smoke после каждой пересборки фронта). Итоговый критерий: покупатель с Android проходит funnel → оплата → код → доступ, при этом iOS и Telegram работают как до слияния, и любой шаг откатывается переменной окружения.

## Файлы, которые будут созданы/изменены (только Фаза 0; остальное — env и внешние сервисы)

- `api/tests/routes/test_auth_disabled.py` — новый тест 503-контракта.
- `.github/workflows/ci.yml` — вторая сборка фронта с флагом OFF.
- `docs/pwa-email-auth-status.md` — дописать правило «не запускать release:ota» и прогресс фаз.
