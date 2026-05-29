# 🤝 CLAUDE Handoff — Текущий статус и план

> **Этот файл — точка входа для Claude в новой сессии.**
> Прочитай его первым после CLAUDE.md, дальше используй ссылки.
> Дата последнего обновления: **2026-05-29**.

---

## 0. ⚡ САМОЕ ВАЖНОЕ ДЛЯ СЛЕДУЮЩЕЙ СЕССИИ

**Сайт УЖЕ развёрнут и живёт на `domcrat.uz` через Cloudflare Tunnel** (проверено 2026-05-29, все хосты HTTP 200 по HTTPS). НО запущено как **detached background-процессы (`setsid`), НЕ systemd** → переживёт выход из сессии, но **НЕ переживёт ребут сервера**.

**Что сделать в первую очередь (требует `sudo` от пользователя):**

1. Перевести 4 сервиса + cloudflared на **systemd** (persistence через ребут) — шаги в `docs/11-LAUNCH-DOMCRAT.md §6` + `infrastructure/systemd/`.
2. Закрыть `admin.domcrat.uz` через **Cloudflare Access** (email allowlist).
3. Отозвать временный Cloudflare API-токен (лежит `~/.config/cloudflare-api.token`, своё дело сделал).

**Незакоммиченные правки** (на момент написания в `git status`): code-fix `StorageService` (split internal/public MinIO), все `*.env.production.example`, systemd-юниты, cloudflared-конфиг, `.gitignore`, `docs/09`, новый `docs/11-LAUNCH-DOMCRAT.md`. Секретов в трекинге нет (`.env.production*` игнорятся). **Решить: закоммитить на `master`.**

Подробный runbook именно этого сервера — **`docs/11-LAUNCH-DOMCRAT.md`**.

---

## 1. Где сейчас находится проект

**Стадия**: MVP функционально готов и **развёрнут на тестовом домене `domcrat.uz`** (через «c»; основной `domkrat.uz` через «k» добавим позже — конфиги и CORS уже содержат оба). Для боевого запуска осталось интегрировать реальные платежи/SMS/SMTP и согласовать legal.

### Состояние сервисов (LIVE на 2026-05-29)

```
✓ https://api.domcrat.uz/api/v1/health   → {"status":"ok"}
✓ https://domcrat.uz  / https://www.domcrat.uz   → 200 (SSR, каталог рендерится)
✓ https://merchant.domcrat.uz/login      → 200
✓ https://admin.domcrat.uz               → 200
~ https://cdn.domcrat.uz                  → 403 на root (норма MinIO; public-политика
                                            product/* заработает после первой загрузки картинки)
```

Локально (для отладки на сервере) те же сервисы: API :3001, web :3000, merchant :3002, admin :3003.

### Как именно запущено (важные нюансы инфры)

- **Туннель `02bf83d1-d3e1-43dc-89d1-a6320fce7234`** работает в **locally-managed** режиме (НЕ token-mode):
  - креды восстановлены из connector-токена → `~/.cloudflared/<uuid>.json`;
  - ingress (оба домена, 6 сабдоменов) → `~/.cloudflared/config.yml`;
  - бинарь: `~/.local/bin/cloudflared` (v2026.5.2, поставлен без sudo).
  - **Причина locally-managed**: выданный Cloudflare API-токен имеет только `Zone→DNS:Edit`, без `Account→Tunnel:Edit`, поэтому ingress через API прописать нельзя — обошёл локальным конфигом. **Следствие: вкладка Public Hostnames в дашборде Cloudflare ПУСТА — это норма, не добавлять туда хосты (конфликт с локальным конфигом).**
- **DNS**: 6 проксируемых CNAME (`<host> → <uuid>.cfargotunnel.com`) созданы через Cloudflare API.
- **Процессы** запущены через `setsid` (detached), логи в `/tmp/domkrat-logs/{api,web,merchant,admin,cloudflared}.log`. systemd — TODO (см. §0).
- **Секреты на диске** (вне git, chmod 600): `~/.config/cloudflared.token` (connector), `~/.config/cloudflare-api.token` (API, отозвать после настройки), `apps/api/.env.production` + `apps/{web,merchant,admin}/.env.production[.local]`.
- **super admin**: `super@domkrat.uz` / `Test1234!` (демо-seed — сменить перед боевым). БД засеяна полным `db:seed`: 100 товаров, 2 демо-мерчанта, справочники.

### Метрики

- **33 коммита** в master (главная ветка: `master`, не `main` — расхождение с git config!)
- **273 .ts/.tsx файлов**
- **81 тест** (38 unit + 43 E2E) — все зелёные
- **16 NestJS модулей**, **~30 страниц web**, **9 страниц merchant**, **20+ admin**
- **~80 моделей** в Prisma schema
- **104 продукта** в seed (10 категорий × 10-13 шт)
- **130+ REST endpoints**

---

## 2. Что готово и протестировано

### Backend (apps/api)

- ✅ Auth: email+password, argon2id, JWT 15min + refresh 30d с rotation, email-верификация через MailHog
- ✅ Catalog: Categories, Brands, Products (CRUD для мерчанта + публичный read + фильтры/сортировки)
- ✅ Cars: марки/модели/поколения/модификации + VIN resolve
- ✅ Search: Meilisearch full-text + автокомплит + /by-vin + /by-oem
- ✅ Cart + Pricing: VAT 12% через decimal.js
- ✅ Orders + Inventory: атомарное резервирование через updateMany, state machine
- ✅ Payments: MockProvider (auto-success) + COD; Click/Payme/Uzum — стабы с 501
- ✅ Finance: balance, transactions, withdrawals, hold-release cron (HOLD_DAYS)
- ✅ Returns, Reviews, Banners, Notifications (feed + badge)
- ✅ Uploads: MinIO presigned URLs, public read для product/\*
- ✅ Merchant Analytics: `/merchant/analytics/summary?range=N` (Recharts на dashboard)
- ✅ Throttler: 60/min globally, 5/min на auth (login/register/password-reset)
- ✅ Helmet (security headers), Sentry no-op без DSN

### Frontend (apps/web)

- ✅ HomePage (mobile-first): HeroBanner, CategoryTile 4xN, CarOnboarding, MyCarProducts, HorizontalProducts по категориям, BrandsCarousel
- ✅ Catalog: `/catalog`, `/c/[slug]` с фильтрами (бренды, цена, авто)
- ✅ Product page: `/p/[slug]` с галереей, описанием, отзывами
- ✅ Search: `/search?q=` (Meilisearch), `?vin=`, `?makeId/modelId/modificationId`
- ✅ Cart + Checkout (delivery method, addresses, payment)
- ✅ Auth: /login, /register, /verify-email
- ✅ Account: orders, garage (с CarPicker), addresses, notifications, favorites, returns, reviews
- ✅ Brands: /brands список + /brands/[slug]
- ✅ Legal: /terms, /privacy, /offer, /returns-policy
- ✅ PWA: manifest.ts, иконки SVG, маскированные
- ✅ i18n RU/UZ: cookie-based, переключатель в header, messages/{ru,uz}.json
- ✅ SEO: sitemap.xml (динамический), robots.txt, OG/Twitter meta
- ✅ UX: skeleton loaders, EmptyState, error.tsx, not-found.tsx

### Merchant (apps/merchant)

- ✅ Login, dashboard с аналитикой (Recharts) + заказы по статусам
- ✅ Products: список, создание, редактирование с ImagesManager + CompatibilityManager
- ✅ Orders: confirm → ready → ship flow

### Admin (apps/admin)

- ✅ Users, Merchants, Orders, Finance (withdrawals approve/reject)
- ✅ Backend admin API полный, frontend — каркас

### Tests (81 шт)

- **Unit (38)**: PricingService (14), PasswordService (4), AuthService (14), OrdersService (6)
- **E2E (43)**: orders-flow (10), catalog (17), cart-edge (7), merchant-flow (8) + general

### Production setup

- ✅ `infrastructure/docker/docker-compose.production.yml` (infra-only, 127.0.0.1)
- ✅ `infrastructure/systemd/domkrat-{api,web,merchant,admin}.service` с hardening
- ✅ `infrastructure/cloudflared/config.example.yml` (5 хостов)
- ✅ `apps/{api,web,merchant,admin}/.env.production.example`
- ✅ `apps/api/prisma/prod-seed.ts` — только справочники + super admin из ENV
- ✅ `docs/09-DEPLOYMENT-PROD.md` (250+ строк)
- ✅ Safety checks в `main.ts` для production (HOLD_DAYS, JWT_SECRET, CORS)
- ✅ `.github/workflows/ci.yml`: lint+typecheck, unit, e2e (Postgres service), build
- ✅ Husky + lint-staged (prettier на коммит)

---

## 3. Что НЕ готово (критично для запуска)

### 🔴 Блокеры для production

1. **Реальные платёжные провайдеры** — Click, Payme, Uzum (сейчас 501 stubs)
2. **Реальный SMS-провайдер** — Eskiz API (сейчас MockSmsProvider)
3. **Реальный SMTP** — заменить MailHog (Mailgun/SendGrid/Yandex.SMTP)
4. **Юридическое согласование** legal pages (сейчас MVP-шаблоны)
5. ~~**Реальный домен** + Cloudflare Tunnel + DNS~~ ✅ СДЕЛАНО для `domcrat.uz` (см. §0/§1). Осталось: systemd-persistence, Cloudflare Access на admin, отзыв API-токена; для `domkrat.uz` — добавить зону в Cloudflare + DNS routes (см. `docs/11 §«Когда добавляем основной домен»`).

### 🟡 Желательно до запуска

6. **Промокоды end-to-end** — БД готова, нужны: admin CRUD UI + интеграция в `PricingService` + checkout UI
7. **Backup cron** для Postgres + проверка восстановления
8. **Реальная аналитика выручки на тестовых заказах** — сейчас в seed нет завершённых заказов, графики мерчанта пустые
9. **Sentry DSN** в `.env` (SDK уже подключен)

### 🟢 Nice-to-have

10. **next-intl на оставшиеся страницы** — сейчас переведены footer + bottom-nav, нужно расширить на product card, account, formats (цены, даты)
11. **Admin frontend полный** — backend есть, UI местами заглушки
12. **CASL правила формализованы** — сейчас доступ через @Roles + ручные проверки
13. **Bundle analyzer + Lighthouse audit**

---

## 4. Что делать в следующей сессии — приоритезированный план

### Если нужно **развёртывание в production** (1-2 дня):

1. Получить домен + настроить Cloudflare account → выполнить `cloudflared tunnel create domkrat`
2. Снять Eskiz API key, прописать в `apps/api/.env.production` (`SMS_PROVIDER=eskiz`)
3. Получить SMTP-креды → `apps/api/.env.production` (SMTP_HOST/PORT/USER/PASS)
4. Развернуть по `docs/09-DEPLOYMENT-PROD.md` — пошаговое руководство готово
5. Проверить: `pnpm prod-seed` создаёт super admin, можно залогиниться в `admin.<domain>`

### Если нужны **реальные платежи** (3-5 дней):

- `apps/api/src/modules/orders/providers/` — где лежат stubs
- Каждый провайдер: реализовать `createTransaction()`, `verifyCallback()`, webhook handler
- Click: HMAC SHA-1, статусы prepare/complete
- Payme: суммы в **тийинах** (×100) — критично, отдельный test case
- Uzum: OAuth + REST
- Тесты с реальными test-кредами провайдеров

### Если нужны **промокоды** (2-3 дня):

- БД (`PromoCode`, `PromoCodeUsage`) уже есть
- Backend:
  - `apps/api/src/modules/admin/promocodes/` — CRUD endpoints
  - `apps/api/src/modules/cart/promocodes.service.ts` — валидация + расчёт скидки
  - Интегрировать в `PricingService` (новое поле `discountFromPromo`)
- Frontend:
  - `apps/admin/src/app/promocodes/` — список + форма
  - В checkout: input "Промокод" → `POST /promocodes/validate` → пересчёт
- Тесты: unit для validate (просроченный/исчерпанный/per-user-limit), E2E

### Если нужно **больше тестов** (1 день):

- Returns flow (создание → одобрение → возврат денег)
- Hold-release cron (фиктивная completed дата → запуск cron → balance перешёл в available)
- Inventory race condition (concurrent orders на тот же товар)
- Merchant inventory CRUD
- Multi-tenancy (мерчант2 не видит данные мерчанта1)

### Если нужно **i18n расширить** (1 день):

- Добавить ключи в `messages/{ru,uz}.json` для product page, account, cart
- Заменить hardcoded strings на `t('...')`
- Number/date formatting: `useFormatter()` из next-intl
- Узбекская локаль для дат: `date-fns/locale/uz`

---

## 5. Критические гочи и грабли

### Окружение

- ⚠️ **Главная ветка = `master`**, хотя git config указывает `main`. Используй `git push origin master`.
- ⚠️ **Sudo требует пароль** — Claude не может ставить системные пакеты. Просить пользователя.
- ⚠️ **Docker от группы docker** — `samandar` в группе, но claude может не иметь доступа к /var/run/docker.sock. Если `docker ps` падает с permission denied — попроси пользователя или используй `sudo docker` (с паролем).
- ⚠️ **Туннель — locally-managed, конфиг локальный** (`~/.cloudflared/config.yml`), а НЕ в дашборде Cloudflare. Менять маршрутизацию/добавлять хосты — правкой этого файла + рестарт cloudflared, НЕ через дашборд (вкладка Public Hostnames пуста — это норма). Запуск: `~/.local/bin/cloudflared --no-autoupdate --config ~/.cloudflared/config.yml tunnel run <uuid>`.
- ⚠️ **Сервисы запущены через `setsid` (не systemd)** — переживают выход из сессии, но НЕ ребут. Перезапуск отдельного сервиса = найти PID (`pgrep -af`), убить, заново `setsid … &` с env из `apps/<app>/.env.production`. Правильное решение — перевести на systemd (нужен sudo, см. `docs/11 §6`).
- ⚠️ **Env фронтов вшиваются на этапе `pnpm build`** (`NEXT_PUBLIC_*`). Лежат в `apps/{web,merchant,admin}/.env.production[.local]` с URL `domcrat.uz`. Сменишь домен/канонический URL — нужно **пересобрать** фронты, иначе в бандле останется старый адрес.

### Тесты

- ⚠️ E2E запускать **только sequentially** (`maxWorkers: 1` в `jest-e2e.json`) — иначе тесты портят друг другу состояние общей БД.
- ⚠️ `NODE_ENV=test` поднимает throttler limit до 10000, чтобы supertest-серии не падали (см. `app.module.ts:39` и `auth.controller.ts:13`).
- ⚠️ Test password для всех seed-юзеров: `Test1234!`. Это **dev only**, в prod-seed не попадает.
- ⚠️ Pricing model: `subtotal` — сумма без НДС, `vatAmount` — НДС поверх (12%), `total` = subtotal − discount + deliveryCost. **VAT не входит в total** (так в коде). Если будешь править — сначала уточни.

### Безопасность / Деньги

- ⚠️ Только `argon2id` для паролей (НЕ bcrypt) — см. `apps/api/src/modules/auth/password.service.ts`.
- ⚠️ Только `Decimal` из `decimal.js` для сумм. Никогда не `number * 1.12`.
- ⚠️ Multi-tenancy через явный фильтр `merchantId` или `userId` — в каждом запросе. Без этого мерчант увидит чужие заказы.
- ⚠️ В production `HOLD_DAYS=0` запрещён — `main.ts:30` бросает Error. Минимум 1 (рекомендуется 7).
- ⚠️ `JWT_SECRET` в production должен быть ≥32 chars и не содержать `change_me/secret/example/dev` — main.ts кидает Error.

### Frontend

- ⚠️ Все приложения слушают `0.0.0.0` для VS Code Remote — не менять на localhost.
- ⚠️ Меняешь `pnpm build` пока работает `pnpm dev` → может слететь .next, отдаёт 404 на CSS. Решение: kill dev, `rm -rf apps/web/.next`, restart dev.
- ⚠️ Если добавляешь `useSearchParams()` в page — оберни в `<Suspense>`, иначе prerender падает в build.

### i18n

- ⚠️ Cookie-based, без URL prefix `/ru/` `/uz/`. Переключатель пишет в cookie `domkrat_locale`.
- ⚠️ Для server components: `import { getLocale } from 'next-intl/server'`.
- ⚠️ Для client: `import { useLocale, useTranslations } from 'next-intl'`.
- ⚠️ JSONB поля БД (`{ru, uz}`): используй `pickLocale()` из `lib/utils.ts` (server) или `useLocaleText()` из `lib/use-locale-text.ts` (client).

---

## 6. Полезные команды

```bash
# Старт всего
pnpm docker:up                    # postgres, redis, meili, minio, mailhog
pnpm dev                          # все 4 приложения (parallel через turbo)
pnpm dev:api                      # только API
pnpm dev:web                      # только customer web

# БД
pnpm db:migrate                   # новая миграция
pnpm db:seed                      # полный seed (с тестовыми юзерами)
pnpm --filter @domkrat/api prod-seed  # production seed (нужны SUPER_ADMIN_EMAIL/PASSWORD)
pnpm db:studio                    # Prisma Studio на 5555

# Тесты
pnpm test                         # unit
pnpm --filter @domkrat/api test:e2e   # E2E (постгрес должен быть запущен!)
NODE_ENV=test pnpm test:e2e       # с поднятым throttler

# Качество
pnpm type-check                   # типы всех апп
pnpm lint                         # eslint
pnpm build                        # production build

# Деплой (на сервере) — ПОСЛЕ перевода на systemd (нужен sudo, пока НЕ сделано)
sudo systemctl restart domkrat-api domkrat-web domkrat-merchant domkrat-admin
sudo journalctl -u domkrat-api -f

# Текущий запуск (background / setsid — пока нет systemd)
pgrep -af "cloudflared.*config.yml"           # жив ли туннель
ps -eo pid,etime,cmd | grep -E "dist/main|next-server" | grep -v grep
tail -f /tmp/domkrat-logs/cloudflared.log      # логи туннеля
tail -f /tmp/domkrat-logs/api.log              # логи api (web/merchant/admin аналогично)
curl -s https://api.domcrat.uz/api/v1/health   # проверка снаружи через Cloudflare

# Перезапуск туннеля (если упал)
~/.local/bin/cloudflared --no-autoupdate --config ~/.cloudflared/config.yml \
  tunnel run 02bf83d1-d3e1-43dc-89d1-a6320fce7234 > /tmp/domkrat-logs/cloudflared.log 2>&1 &
```

---

## 7. Где что искать (быстрая навигация)

| Что                         | Где                                                                         |
| --------------------------- | --------------------------------------------------------------------------- |
| Контекст проекта, конвенции | `CLAUDE.md` (корень, авто-загружается)                                      |
| Бизнес-логика               | `docs/05-BUSINESS-FLOWS.md`                                                 |
| Схема БД                    | `docs/04-DATABASE-SCHEMA.md` + `PART2.md` + `apps/api/prisma/schema.prisma` |
| API endpoints               | `docs/06-API-SPECIFICATION.md` + Swagger на :3001/api/docs                  |
| Роли и права                | `docs/07-ROLES-PERMISSIONS.md`                                              |
| Прод-деплой                 | `docs/09-DEPLOYMENT-PROD.md`                                                |
| MVP roadmap                 | `docs/10-MVP-ROADMAP.md`                                                    |
| API код                     | `apps/api/src/modules/<имя>/`                                               |
| Web страницы                | `apps/web/src/app/<route>/page.tsx`                                         |
| Web компоненты              | `apps/web/src/components/`                                                  |
| API хуки фронта             | `apps/web/src/lib/api/<resource>.ts`                                        |
| Тесты unit                  | рядом с кодом: `*.spec.ts`                                                  |
| Тесты E2E                   | `apps/api/test/*.e2e-spec.ts`                                               |
| Seed                        | `apps/api/prisma/seed.ts` (dev) + `prod-seed.ts` (prod)                     |

---

## 8. История по фазам

- **Phase 0** (commits 1-8): bootstrap — pnpm/turbo, NestJS, 3×Next.js, Docker compose
- **Phase 1** (commits 9-20): schema, auth, users, catalog, cart, orders, payments
- **Phase 2** (commits 21-33): web, merchant и admin frontends + расширенные фичи (uploads, search, garage, notifications, analytics, tests, production setup, P0-P3 hardening)

---

**Если что-то изменилось — обнови этот файл.** Следующая сессия начнёт с него.
