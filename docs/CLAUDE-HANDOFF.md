# 🤝 CLAUDE Handoff — Текущий статус и план

> **Этот файл — точка входа для Claude в новой сессии.**
> Прочитай его первым после CLAUDE.md, дальше используй ссылки.
> Дата последнего обновления: **2026-05-28**.

---

## 1. Где сейчас находится проект

**Стадия**: MVP функционально готов. Все ключевые пользовательские флоу работают локально на 192.168.1.8. Запуск в production — после интеграции реальных платежей/SMS/SMTP и юридического согласования.

### Состояние сервисов (на момент написания)

```
✓ API     → http://192.168.1.8:3001/api/v1/health    → {"status":"ok"}
✓ Web     → http://192.168.1.8:3000                  → 200
✓ API docs → http://192.168.1.8:3001/api/docs        → Swagger UI
○ Merchant → http://192.168.1.8:3002                 → ручной старт через pnpm dev:merchant
○ Admin    → http://192.168.1.8:3003                 → ручной старт через pnpm dev:admin
```

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
5. **Реальный домен** + Cloudflare Tunnel UUID + DNS routes

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

# Деплой (на сервере)
sudo systemctl restart domkrat-api domkrat-web domkrat-merchant domkrat-admin
sudo journalctl -u domkrat-api -f
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
