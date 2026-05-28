# 📋 План реализации MVP для Claude Code

## Пошаговый план задач, адаптированный под AI-разработку

Каждая задача — **атомарная**: маленький scope, чёткие критерии готовности, проверяемый результат.

---

## 📑 Содержание

1. [Принципы AI-разработки](#принципы-ai-разработки)
2. [Phase 0: Bootstrap проекта](#phase-0-bootstrap-проекта)
3. [Phase 1: Foundation](#phase-1-foundation)
4. [Phase 2: Каталог](#phase-2-каталог)
5. [Phase 3: Корзина и заказы](#phase-3-корзина-и-заказы)
6. [Phase 4: Мерчанты](#phase-4-мерчанты)
7. [Phase 5: Склад MVP](#phase-5-склад-mvp)
8. [Phase 6: Production-ready](#phase-6-production-ready)
9. [Шаблоны задач для Claude Code](#шаблоны-задач-для-claude-code)

---

## Принципы AI-разработки

### 🤖 Особенности работы Claude Code

1. **Claude отлично делает**:
   - Точные, изолированные задачи (CRUD-эндпоинт, миграция БД, тест)
   - Рефакторинг и форматирование
   - Написание тестов
   - Документация и комментарии
   - Решение алгоритмических задач

2. **Claude хуже справляется с**:
   - Большими задачами (>500 LOC за раз)
   - Архитектурными решениями без чёткого ТЗ
   - Долгосрочным контекстом (помнит хуже человека)
   - Задачами с неявными требованиями

3. **Поэтому**:
   - **Дробим задачи**: каждая = 1-3 файла, ~100-300 LOC
   - **Чёткие критерии готовности**: что должно работать после
   - **Тесты как контракт**: написал код → есть тесты → можно проверить
   - **Один PR — одна задача**: не смешиваем фичи

### 🔄 Workflow для каждой задачи

```
1. ЧЕЛОВЕК (Tech Lead):
   - Создаёт задачу в трекере (Linear / Jira / GitHub Issues)
   - Заполняет шаблон (см. ниже)
   - Назначает приоритет

2. ЧЕЛОВЕК + CLAUDE:
   - Обсуждают план (особенно для сложных задач)
   - Claude задаёт уточняющие вопросы

3. CLAUDE CODE:
   - Создаёт ветку
   - Реализует задачу
   - Пишет тесты
   - Создаёт PR

4. ЧЕЛОВЕК (Code Review):
   - Проверяет PR
   - Запускает локально
   - Просит правки (через комментарии в PR)

5. CLAUDE CODE:
   - Вносит правки
   - Прогоняет тесты

6. ЧЕЛОВЕК:
   - Approve и merge
```

### 📐 Размер задачи

| Тип задачи | LOC | Время Claude | Время review |
|------------|-----|--------------|--------------|
| Создание DTO + валидация | ~50 | 5 мин | 5 мин |
| Endpoint + service метод | ~150 | 15 мин | 10 мин |
| Полный CRUD модуль | ~500 | 1 час | 30 мин |
| Сложная бизнес-логика | ~300 + тесты | 1-2 часа | 30 мин |
| Интеграция с внешним API | ~400 | 2 часа | 1 час |

**Правило**: если задача >800 LOC — разбить.

---

## Phase 0: Bootstrap проекта

> **Tech Lead делает один раз**. Это нельзя автоматизировать через Claude Code.

### Задачи

#### 0.1 Создание репозитория и базовой структуры
**Кто**: Tech Lead

**Что делать**:
1. Создать GitHub репозиторий `domkrat`
2. Настроить branch protection rules
3. Создать структуру монорепо:
   ```bash
   pnpm dlx create-turbo@latest
   ```
4. Скопировать `CLAUDE.md` (см. отдельный файл) в корень
5. Скопировать `docs/` (всю документацию) в корень
6. Создать `.gitignore`, `.env.example`, `README.md`
7. Настроить `pnpm-workspace.yaml`
8. Настроить корневой `package.json` со скриптами

#### 0.2 Инициализация инфраструктуры (Docker)
**Кто**: Tech Lead / DevOps

**Что делать**:
1. Создать `docker-compose.dev.yml` (см. `09-DEPLOYMENT-GUIDE.md`)
2. Запустить инфраструктуру локально
3. Проверить доступ к PostgreSQL, Redis, Meilisearch, MinIO
4. Создать `.env.example` с правильной структурой

#### 0.3 Инициализация NestJS API
**Кто**: Tech Lead

**Что делать**:
```bash
cd apps
nest new api --strict --package-manager pnpm
```

Установить базовые зависимости (см. `02-TECH-STACK.md`).

Настроить:
- `tsconfig.json` (strict mode)
- `.eslintrc.js` (с конвенциями проекта)
- `.prettierrc`
- `nest-cli.json` (с правильными paths)

#### 0.4 Инициализация Prisma
**Кто**: Tech Lead

**Что делать**:
1. `pnpm add prisma @prisma/client`
2. `pnpm prisma init`
3. Настроить `schema.prisma` с базовыми настройками
4. Создать `PrismaModule` и `PrismaService` (глобальный)

#### 0.5 Инициализация Next.js приложений
**Кто**: Tech Lead

```bash
cd apps
pnpm create next-app web --typescript --tailwind --app --src-dir
pnpm create next-app merchant --typescript --tailwind --app --src-dir
pnpm create next-app admin --typescript --tailwind --app --src-dir
```

Настроить общую UI-библиотеку:
```bash
cd packages
mkdir ui
# package.json + базовые компоненты + shadcn/ui setup
```

#### 0.6 Дизайн-система
**Кто**: Designer + Frontend Tech Lead

**Что делать**:
1. Создать Figma-файл с дизайн-токенами
2. Определить цветовую палитру бренда «Домкрат»
3. Создать в `packages/ui`:
   - `tailwind.config.js` с токенами
   - Базовые компоненты (Button, Input, Card, Modal)
   - Установить shadcn/ui

#### 0.7 Конфигурация CI/CD
**Кто**: DevOps

**Что делать**:
1. Создать `.github/workflows/ci.yml`
2. Настроить запуск тестов на каждый PR
3. Настроить Docker build на main/develop
4. Настроить deploy на staging (когда сервер готов)

---

## Phase 1: Foundation

### Sprint 1 (Недели 1-2)

#### 🤖 Задача 1.1: Полная Prisma schema из документации

**Описание**:
Создать `prisma/schema.prisma` со всеми моделями из `docs/04-DATABASE-SCHEMA.md` и `docs/04-DATABASE-SCHEMA-PART2.md`.

**Файлы**:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/00000000_init/migration.sql`

**Acceptance criteria**:
- [ ] Все 80+ моделей описаны
- [ ] Все enums созданы
- [ ] Все relations корректны (onDelete/onUpdate правила)
- [ ] Все индексы добавлены (`@@index`, `@@unique`)
- [ ] Миграция применяется без ошибок
- [ ] `pnpm prisma generate` отрабатывает
- [ ] `pnpm prisma validate` без ошибок

**Промпт для Claude**:
```
Создай полный prisma/schema.prisma на основе документов:
- docs/04-DATABASE-SCHEMA.md
- docs/04-DATABASE-SCHEMA-PART2.md

Следуй конвенциям из CLAUDE.md. Каждая модель с правильными:
- relations
- индексами
- onDelete стратегиями
- мультиязычными JSON полями

После создания запусти `pnpm prisma migrate dev --name init` для проверки.
```

---

#### 🤖 Задача 1.2: PrismaService с graceful shutdown

**Файлы**: `apps/api/src/infrastructure/database/prisma.service.ts`, `prisma.module.ts`

**Acceptance criteria**:
- [ ] PrismaService с `onModuleInit` и `onModuleDestroy`
- [ ] Connection pooling настроен
- [ ] Логирование запросов в dev, не в prod
- [ ] Module экспортирует PrismaService как global

---

#### 🤖 Задача 1.3: Seed скрипт с тестовыми данными

**Файлы**: `apps/api/prisma/seed.ts`

**Что должно быть seed'нуто**:
- 1 SUPER_ADMIN пользователь
- 3 ADMIN пользователя
- 10 категорий с подкатегориями
- 5 брендов
- 20 марок авто + модели + модификации (популярные в UZ)
- Несколько складских зон/стеллажей/ячеек
- Базовые delivery_methods
- Notification templates

**Acceptance criteria**:
- [ ] `pnpm prisma db seed` отрабатывает
- [ ] Можно повторно запустить (idempotent через upsert)
- [ ] Все ID детерминированные (для тестов)

---

#### 🤖 Задача 1.4: Auth модуль — регистрация по телефону

**Файлы**:
- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/modules/auth/controllers/auth.controller.ts`
- `apps/api/src/modules/auth/services/auth.service.ts`
- `apps/api/src/modules/auth/services/sms-verification.service.ts`
- `apps/api/src/modules/auth/dto/register.dto.ts`
- `apps/api/src/modules/auth/dto/verify-code.dto.ts`
- tests

**Endpoints**:
- `POST /v1/auth/register` — регистрация
- `POST /v1/auth/verify-code` — подтверждение SMS

**Acceptance criteria**:
- [ ] Валидация телефона `+998XXXXXXXXX`
- [ ] Пароль хэшируется argon2
- [ ] SMS-код генерируется (6 цифр)
- [ ] SMS-сервис — пока mock (`SmsServiceMock`)
- [ ] Код хранится в `verification_codes`
- [ ] При успешной верификации создаётся user с ролью CUSTOMER
- [ ] Возвращаются access + refresh токены
- [ ] Unit-тесты для service
- [ ] E2E-тест для endpoint

---

#### 🤖 Задача 1.5: JWT стратегия + Guards

**Файлы**:
- `apps/api/src/modules/auth/strategies/jwt.strategy.ts`
- `apps/api/src/modules/auth/strategies/refresh-token.strategy.ts`
- `apps/api/src/modules/auth/guards/jwt-auth.guard.ts`
- `apps/api/src/modules/auth/guards/roles.guard.ts`
- `apps/api/src/modules/auth/decorators/roles.decorator.ts`
- `apps/api/src/modules/auth/decorators/current-user.decorator.ts`

**Acceptance criteria**:
- [ ] Access token 15 мин, refresh 30 дней
- [ ] Refresh tokens хранятся в БД (с хэшем)
- [ ] Возможность отозвать refresh token (logout)
- [ ] Guards работают на всех endpoints
- [ ] Тесты на разрешённые и запрещённые сценарии

---

#### 🤖 Задача 1.6: Login + refresh + logout endpoints

**Endpoints**:
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `POST /v1/auth/password-reset/request`
- `POST /v1/auth/password-reset/confirm`

---

#### 🤖 Задача 1.7: Users модуль — профиль, адреса, гараж

**Endpoints** (см. `docs/06-API-SPECIFICATION.md`):
- `GET /v1/me`
- `PATCH /v1/me`
- `POST /v1/me/avatar`
- `PATCH /v1/me/password`
- `GET/POST/PATCH/DELETE /v1/me/addresses`
- `GET/POST/PATCH/DELETE /v1/me/garages`

---

#### 🤖 Задача 1.8: SMS интеграция — Eskiz adapter

**Файлы**:
- `apps/api/src/modules/notifications/channels/sms/sms.service.ts`
- `apps/api/src/modules/notifications/channels/sms/eskiz.provider.ts`
- `apps/api/src/modules/notifications/channels/sms/sms-mock.provider.ts`

**Acceptance criteria**:
- [ ] Адаптер для Eskiz API (с аутентификацией)
- [ ] Mock-провайдер для тестов и dev
- [ ] Переключение через env (`SMS_PROVIDER=eskiz|mock`)
- [ ] Логирование отправок
- [ ] Retry при сбое (3 попытки с exponential backoff)
- [ ] Тесты с моком axios

---

#### 🤖 Задача 1.9: Базовая UI shadcn/ui + лейаут

**Файлы**:
- `packages/ui/components/{Button, Input, Card, Modal, Form, ...}`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/components/Header.tsx`
- `apps/web/src/components/Footer.tsx`

**Acceptance criteria**:
- [ ] Установлены shadcn/ui компоненты в packages/ui
- [ ] Tailwind config с дизайн-токенами «Домкрат»
- [ ] Layout с Header, Footer, языковым переключателем
- [ ] Mobile-responsive
- [ ] Storybook для компонентов (опционально)

---

#### 🤖 Задача 1.10: Страницы регистрации/входа на фронте

**Файлы**:
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`
- `apps/web/src/app/(auth)/verify/page.tsx`
- `apps/web/src/features/auth/api.ts` (TanStack Query)
- `apps/web/src/features/auth/store.ts` (Zustand для токенов)

**Acceptance criteria**:
- [ ] Форма с react-hook-form + zod
- [ ] Интеграция с API (TanStack Query)
- [ ] Обработка ошибок
- [ ] Сохранение токенов в httpOnly cookie
- [ ] Редирект после успеха
- [ ] i18n RU/UZ

---

## Phase 2: Каталог

### Sprint 2-3 (Недели 3-6)

#### 🤖 Задача 2.1: Categories модуль (Admin CRUD + Public read)

**Endpoints**:
- `GET /v1/categories` — дерево категорий
- `GET /v1/categories/:slug`
- `GET /v1/admin/categories`
- `POST /v1/admin/categories`
- `PATCH /v1/admin/categories/:id`
- `DELETE /v1/admin/categories/:id`
- `POST /v1/admin/categories/reorder`

**Особенности**:
- Использовать LTREE для иерархии (см. `04-DATABASE-SCHEMA.md`)
- Кэшировать дерево в Redis (TTL 1 час, инвалидация при изменениях)
- Мультиязычность (RU/UZ)

**Acceptance criteria**:
- [ ] CRUD работает с ролями
- [ ] Дерево возвращается за <100ms
- [ ] Тесты на корректность LTREE при перемещении

---

#### 🤖 Задача 2.2: Brands модуль

Аналогично categories. Простой CRUD.

---

#### 🤖 Задача 2.3: Attributes модуль

**Endpoints**:
- `GET /v1/admin/attribute-groups`
- `POST/PATCH /v1/admin/attribute-groups`
- `GET /v1/admin/attributes`
- `POST/PATCH/DELETE /v1/admin/attributes`

**Особенности**:
- Поддержка разных типов: STRING/NUMBER/BOOLEAN/ENUM/MULTI_ENUM
- Привязка к категориям

---

#### 🤖 Задача 2.4: Cars справочник (Admin)

**Endpoints**:
- CRUD для makes, models, generations, modifications, engines

**Особенности**:
- Импорт из CSV (массовая загрузка)

---

#### 🤖 Задача 2.5: Products модуль — Admin/Merchant CRUD

**Endpoints**:
- `GET /v1/merchant/products`
- `POST /v1/merchant/products`
- `GET /v1/merchant/products/:id`
- `PATCH /v1/merchant/products/:id`
- `DELETE /v1/merchant/products/:id`
- `POST /v1/merchant/products/:id/images`
- `PATCH /v1/merchant/products/:id/status`

**Особенности**:
- Multi-tenancy: мерчант видит только свои товары
- Generate slug автоматически из имени
- Валидация: цена > 0, name не пустое
- Snapshot при изменении цены (для аудита)

**Acceptance criteria**:
- [ ] Тесты на multi-tenancy (мерчант 1 не видит товары мерчанта 2)
- [ ] Загрузка изображений в MinIO (resize через Sharp)
- [ ] Корректная валидация мультиязычных полей

---

#### 🤖 Задача 2.6: Product compatibility (привязка к авто)

**Endpoints**:
- `GET /v1/merchant/products/:id/compatibility`
- `POST /v1/merchant/products/:id/compatibility`
- `DELETE /v1/merchant/products/:id/compatibility/:compatId`

**Особенности**:
- Поддержка привязки к make/model/modification (любой уровень)
- Year_from/year_to ограничения

---

#### 🤖 Задача 2.7: Products поиск (Public)

**Endpoints**:
- `GET /v1/products` — с фильтрами
- `GET /v1/products/:slug`
- `GET /v1/search?q=...`
- `GET /v1/search/by-oem?oem=...`
- `GET /v1/search/compatible?makeId=&modelId=&year=&modificationId=`

**Особенности**:
- Базовый поиск через PostgreSQL FTS + pg_trgm
- Meilisearch — отдельной задачей (2.8)
- Фильтры: category, brand, price_min, price_max, in_stock

---

#### 🤖 Задача 2.8: Meilisearch интеграция

**Файлы**:
- `apps/api/src/modules/search/search.module.ts`
- `apps/api/src/modules/search/services/meilisearch.service.ts`
- `apps/api/src/modules/search/services/products-indexer.service.ts`
- Worker для индексации (BullMQ)

**Acceptance criteria**:
- [ ] При создании/изменении товара — задача на индексацию
- [ ] Реиндексация всего каталога командой
- [ ] Поиск с typo-tolerance работает
- [ ] Faceted search (категория, бренд, цена)
- [ ] Поиск в RU и UZ

---

#### 🤖 Задача 2.9: Frontend — каталог категорий

**Файлы**:
- `apps/web/src/app/[locale]/page.tsx` (главная)
- `apps/web/src/app/[locale]/c/[slug]/page.tsx` (категория)
- `apps/web/src/app/[locale]/p/[slug]/page.tsx` (товар)
- `apps/web/src/features/catalog/*`

**Acceptance criteria**:
- [ ] SSR/ISR (revalidate 60s для карточек)
- [ ] SEO meta-tags
- [ ] sitemap.xml автогенерация
- [ ] Хлебные крошки
- [ ] Фильтры в sidebar
- [ ] Пагинация
- [ ] Sort: цена, рейтинг, дата
- [ ] Mobile responsive

---

#### 🤖 Задача 2.10: Подбор по марке/модели

**Файлы**:
- `apps/web/src/components/CarSelector.tsx` — каскадный селектор
- `apps/web/src/app/[locale]/garage/page.tsx` — гараж пользователя

**Acceptance criteria**:
- [ ] 3-level cascade: Марка → Модель → Год → Модификация
- [ ] Сохранение в localStorage для гостей
- [ ] Сохранение в БД для авторизованных
- [ ] Применение фильтра к каталогу

---

## Phase 3: Корзина и заказы

### Sprint 4-5 (Недели 7-10)

#### 🤖 Задача 3.1: Cart модуль (backend)

**Endpoints**:
- `GET /v1/cart`
- `POST /v1/cart/items`
- `PATCH /v1/cart/items/:id`
- `DELETE /v1/cart/items/:id`
- `DELETE /v1/cart`
- `POST /v1/cart/apply-promo`
- `DELETE /v1/cart/promo`
- `POST /v1/cart/calculate`

**Особенности**:
- Гостевые корзины в Redis (по session_id)
- Авторизованные — в БД
- Merge при логине
- TTL 30 дней
- Расчёт стоимости с учётом скидок и НДС

---

#### 🤖 Задача 3.2: Pricing service (расчёт стоимости)

**Файлы**:
- `apps/api/src/modules/pricing/pricing.module.ts`
- `apps/api/src/modules/pricing/services/pricing.service.ts`
- `apps/api/src/modules/pricing/services/promo.service.ts`
- `apps/api/src/modules/pricing/services/vat.service.ts`

**Acceptance criteria**:
- [ ] Использует `decimal.js`
- [ ] Расчёт скидки (PERCENT/FIXED)
- [ ] Расчёт НДС
- [ ] Юнит-тесты с разными комбинациями
- [ ] Округление по правилам бухучёта

---

#### 🤖 Задача 3.3: Inventory модуль — резервирование

**Файлы**:
- `apps/api/src/modules/inventory/services/inventory.service.ts`
- `apps/api/src/modules/inventory/services/stock-reservation.service.ts`
- `apps/api/src/modules/inventory/services/stock-movements.service.ts`

**Acceptance criteria**:
- [ ] Redis lock при резервировании (предотвращение race conditions)
- [ ] FIFO выборка из остатков
- [ ] Запись stock_movements
- [ ] Cron для очистки истекших резервов
- [ ] Тесты на одновременные запросы

---

#### 🤖 Задача 3.4: Orders модуль — создание заказа

**Endpoints**:
- `POST /v1/orders` — создать из корзины
- `GET /v1/orders` — мои заказы
- `GET /v1/orders/:id` — детали

**Особенности**:
- Транзакция: создание заказа + резерв товара + sub_orders
- Split на sub_orders по мерчантам
- Generate order_number `DK-2026-000001`
- Эмиттит `order.created` event

---

#### 🤖 Задача 3.5: Orders state machine

**Файлы**:
- `apps/api/src/modules/orders/services/order-status.service.ts`
- `apps/api/src/modules/orders/state-machine.ts`

**Acceptance criteria**:
- [ ] Все переходы из `05-BUSINESS-FLOWS.md`
- [ ] Запрет невалидных переходов
- [ ] Логирование в order_status_history
- [ ] Триггеры событий (events) на переходы
- [ ] Юнит-тесты на каждый переход

---

#### 🤖 Задача 3.6: Payments — Click интеграция

**Файлы**:
- `apps/api/src/modules/payments/providers/click.provider.ts`
- `apps/api/src/modules/payments/webhooks/click.controller.ts`
- `apps/api/src/modules/payments/services/payments.service.ts`

**Endpoints**:
- `POST /v1/orders/:id/payment` — инициировать
- `POST /v1/webhooks/click/prepare`
- `POST /v1/webhooks/click/complete`

**Acceptance criteria**:
- [ ] Проверка подписи (MD5 как в документации Click)
- [ ] Webhook IP whitelist
- [ ] Идемпотентность через payment_transaction_id
- [ ] Тесты с моком axios

---

#### 🤖 Задача 3.7: Payments — Payme интеграция

**Особенности**: Payme использует JSON-RPC, а не REST. Суммы в тийинах (×100).

**Acceptance criteria**:
- [ ] Реализованы все 6 методов JSON-RPC
- [ ] Basic Auth проверка
- [ ] Конвертация UZS ↔ тийины

---

#### 🤖 Задача 3.8: Payments — Uzum интеграция

Аналогично Click.

---

#### 🤖 Задача 3.9: Payments — COD (Cash on Delivery)

**Простой**: при выборе COD заказ сразу `PROCESSING`, оплата при доставке.

---

#### 🤖 Задача 3.10: Delivery модуль — методы доставки

**Endpoints**:
- `GET /v1/cart/delivery-options` — доступные методы для адреса
- `GET /v1/admin/delivery-methods`
- CRUD для зон, точек выдачи

---

#### 🤖 Задача 3.11: Notifications модуль + listeners

**Файлы**:
- `apps/api/src/modules/notifications/notifications.module.ts`
- `apps/api/src/modules/notifications/services/notifications.service.ts`
- `apps/api/src/modules/notifications/channels/{sms,email,push}/`
- `apps/api/src/modules/notifications/listeners/order.listener.ts`

**Acceptance criteria**:
- [ ] Подписка на events: order.created, order.paid, order.delivered, etc.
- [ ] Отправка через BullMQ (асинхронно)
- [ ] Учёт preferences пользователя
- [ ] Шаблоны (RU/UZ)
- [ ] Retry при сбое

---

#### 🤖 Задача 3.12: Frontend — корзина

**Файлы**:
- `apps/web/src/app/[locale]/cart/page.tsx`
- `apps/web/src/components/CartItem.tsx`
- `apps/web/src/features/cart/*`

---

#### 🤖 Задача 3.13: Frontend — checkout

**Файлы**:
- `apps/web/src/app/[locale]/checkout/page.tsx`
- `apps/web/src/features/checkout/*`

**Acceptance criteria**:
- [ ] Multi-step: адрес → доставка → оплата
- [ ] Валидация на каждом шаге
- [ ] Редирект на платёжную систему
- [ ] Страница успеха / ошибки

---

#### 🤖 Задача 3.14: Frontend — личный кабинет (заказы)

**Файлы**:
- `apps/web/src/app/[locale]/account/orders/page.tsx`
- `apps/web/src/app/[locale]/account/orders/[id]/page.tsx`

---

## Phase 4: Мерчанты

### Sprint 6 (Недели 11-12)

#### 🤖 Задача 4.1: Merchants модуль — регистрация и верификация

**Endpoints**:
- `POST /v1/merchant/register` (доступно всем CUSTOMER)
- `POST /v1/merchant/documents`
- `GET /v1/admin/merchants`
- `POST /v1/admin/merchants/:id/approve`
- `POST /v1/admin/merchants/:id/reject`

---

#### 🤖 Задача 4.2: Merchant staff модуль

**Endpoints**:
- `GET /v1/merchant/staff`
- `POST /v1/merchant/staff/invite`
- `DELETE /v1/merchant/staff/:id`

**Особенности**:
- Permissions через JSONB
- Sub-account creation

---

#### 🤖 Задача 4.3: Merchant orders processing

**Endpoints**:
- `GET /v1/merchant/orders`
- `POST /v1/merchant/orders/:id/confirm` (для Type 2)
- `POST /v1/merchant/orders/:id/ready`
- `POST /v1/merchant/orders/:id/ship` (для Type 2)

---

#### 🤖 Задача 4.4: Finance модуль — балансы и транзакции

**Endpoints**:
- `GET /v1/merchant/balance`
- `GET /v1/merchant/transactions`
- `GET /v1/merchant/withdrawals`
- `POST /v1/merchant/withdrawals` — запрос на вывод

**Особенности**:
- Decimal arithmetic
- Triggers на финансовые транзакции при изменении статуса заказа
- Hold period 7 дней

---

#### 🤖 Задача 4.5: Admin: финансы (выплаты)

**Endpoints**:
- `GET /v1/admin/finance/withdrawals`
- `POST /v1/admin/finance/withdrawals/:id/approve`
- `POST /v1/admin/finance/withdrawals/:id/reject`
- `POST /v1/admin/finance/withdrawals/:id/complete`

---

#### 🤖 Задача 4.6: Frontend — кабинет мерчанта

**Файлы**: `apps/merchant/src/app/*`

- Дашборд
- Товары
- Заказы
- Финансы
- Сотрудники

---

#### 🤖 Задача 4.7: Frontend — админ-панель

**Файлы**: `apps/admin/src/app/*`

- Пользователи
- Мерчанты (верификация)
- Каталог
- Заказы
- Финансы

---

## Phase 5: Склад MVP

### Sprint 7 (Недели 13-14)

#### 🤖 Задача 5.1: Warehouse модуль — структура

**Endpoints**:
- `GET /v1/admin/warehouses`
- CRUD для warehouses, zones, racks, shelves, cells
- `POST /v1/admin/cells/bulk-generate` (массовое создание ячеек)
- `GET /v1/admin/cells/:id/qr` (генерация QR)

---

#### 🤖 Задача 5.2: Stock receipts (приёмки)

**Endpoints**:
- `POST /v1/merchant/receipts` (мерчант создаёт)
- `GET /v1/warehouse/receipts/pending` (склад видит)
- `POST /v1/warehouse/receipts/:id/start`
- `POST /v1/warehouse/receipts/:id/complete`

---

#### 🤖 Задача 5.3: Picking (сборка заказов)

**Endpoints**:
- `GET /v1/warehouse/picking/tasks`
- `POST /v1/warehouse/picking/:taskId/start`
- `POST /v1/warehouse/picking/:taskId/items/:itemId/scan`
- `POST /v1/warehouse/picking/:taskId/complete`

**Особенности**:
- Оптимизация маршрута picker'а
- Учёт FIFO

---

#### 🤖 Задача 5.4: Inventory rental fees (аренда ячеек)

**Особенности**:
- Cron 1-го числа месяца
- Списание с merchant_balance

---

## Phase 6: Production-ready

### Sprint 8 (Недели 15-16)

#### 🤖 Задача 6.1: Sentry интеграция

#### 🤖 Задача 6.2: Prometheus metrics

#### 🤖 Задача 6.3: Pino structured logging

#### 🤖 Задача 6.4: Health checks endpoints

#### 🤖 Задача 6.5: Rate limiting на критичных endpoints

#### 🤖 Задача 6.6: E2E tests — критичные флоу
- Регистрация → логин → создание заказа → оплата → доставка → завершение

#### 🤖 Задача 6.7: Нагрузочные тесты (k6)

#### 🤖 Задача 6.8: Документация Swagger полная

#### 🤖 Задача 6.9: Деплой на staging

#### 🤖 Задача 6.10: Smoke tests на staging

---

## Шаблоны задач для Claude Code

### 📝 Шаблон: Новый модуль NestJS

```markdown
## Задача: Создать модуль `<MODULE_NAME>`

### Контекст
- Документация модуля: `docs/03-ARCHITECTURE.md` → раздел "<MODULE_NAME>"
- Таблицы БД: `docs/04-DATABASE-SCHEMA.md` → `<table>`
- API endpoints: `docs/06-API-SPECIFICATION.md` → раздел "<MODULE_NAME>"
- Права: `docs/07-ROLES-PERMISSIONS.md`

### Что сделать
1. Создать структуру модуля по конвенции CLAUDE.md
2. Реализовать endpoints из API спецификации
3. Multi-tenancy через `<column>`
4. CASL правила для прав доступа
5. Unit тесты (coverage >80%)
6. E2E тесты для критичных endpoints
7. Swagger декораторы на всех endpoints

### Acceptance criteria
- [ ] Все endpoints работают и протестированы
- [ ] Тесты на multi-tenancy
- [ ] Тесты на права доступа (403 для запрещённых)
- [ ] Тесты на edge cases (пустые входы, невалидные данные)
- [ ] Swagger автоматически отображает endpoints
- [ ] Pre-commit hooks проходят

### Файлы
- `apps/api/src/modules/<module>/...` (структура из CLAUDE.md)

### Время оценки
~2 часа Claude + 30 мин review
```

---

### 📝 Шаблон: Endpoint в существующем модуле

```markdown
## Задача: Добавить endpoint `<METHOD> /v1/<path>`

### Контекст
- Существующий модуль: `apps/api/src/modules/<module>`
- Описание endpoint: `docs/06-API-SPECIFICATION.md` строка <line>
- Требуемые права: <role/ability>

### Request
```json
<example>
```

### Response
```json
<example>
```

### Что сделать
1. Создать/обновить DTO в `dto/`
2. Реализовать метод в `services/<module>.service.ts`
3. Добавить endpoint в `controllers/<module>.controller.ts`
4. Guard'ы и декораторы прав
5. Юнит-тесты для service
6. E2E тест для endpoint
7. Swagger декораторы

### Acceptance criteria
- [ ] Endpoint работает с правильными ролями
- [ ] Возвращает 403 для несанкционированных
- [ ] Валидация DTO
- [ ] Тесты на happy path и edge cases
```

---

### 📝 Шаблон: Багфикс

```markdown
## Задача: Bug — <короткое описание>

### Описание
<что не работает>

### Шаги воспроизведения
1. ...
2. ...
3. ...

### Ожидаемое поведение
...

### Фактическое поведение
...

### Стектрейс / логи
```
<paste>
```

### Что сделать
1. Воспроизвести баг локально
2. Написать failing тест
3. Исправить баг
4. Проверить, что тест проходит
5. Проверить, что не сломали другое
```

---

### 📝 Шаблон: Рефакторинг

```markdown
## Задача: Refactor — <название>

### Текущее состояние
<что плохо>

### Целевое состояние
<как должно быть>

### Обоснование
<почему важно>

### Что сделать
1. Не менять публичный API (если не указано)
2. Все тесты должны продолжать проходить
3. Покрытие тестами не должно падать
4. Один коммит = один логический шаг
```

---

## 🎯 Ключевые метрики качества разработки

### Code quality
- TypeScript strict mode: 100%
- ESLint без ошибок
- Test coverage: >70% (services), >50% (controllers)
- Cyclomatic complexity: <10 на функцию

### Performance
- API p95: <300ms (без внешних API)
- DB queries в одном endpoint: <10
- Bundle size frontend: <300KB initial

### Security
- 0 high/critical уязвимостей в `pnpm audit`
- Все секреты в env / vault
- 0 публично доступных endpoints без `@UseGuards`

---

## 🚦 Definition of Done для задачи

Задача считается завершённой, когда:

- [ ] Код написан и соответствует CLAUDE.md
- [ ] Все тесты проходят (unit + e2e)
- [ ] Покрытие тестами не упало
- [ ] Линтер не показывает ошибок
- [ ] TypeScript без ошибок
- [ ] Прошёл code review (минимум 1 человек)
- [ ] Документация обновлена (если был API change)
- [ ] Миграция БД создана и протестирована (если нужно)
- [ ] PR merged в `develop`
- [ ] Smoke test пройден на staging (после deploy)

---

## 💡 Tips для эффективной работы с Claude Code

### 1. Контекст — это всё
Перед задачей загружай в контекст:
- `CLAUDE.md`
- Релевантные документы из `docs/`
- Файлы похожих модулей (как пример)

### 2. Один раз — один scope
Не давай задачи типа "сделай весь модуль orders". Разбей:
- "Создай DTO для orders"
- "Создай OrdersService.create"
- "Добавь POST /v1/orders endpoint"
- "Напиши тесты"

### 3. Тесты — это контракт
Если Claude написал код, но не написал тесты — тесты следующая задача. Это страховка от регрессий.

### 4. Review важен
Claude может писать код быстро, но без вдумчивого review будут проблемы:
- Производительность (N+1, неиндексированные запросы)
- Безопасность (упущенные права)
- Бизнес-логика (тонкие моменты)

### 5. Документируй решения
Если Claude принял неочевидное решение — попроси добавить комментарий с обоснованием.

### 6. Иди по дорожке
Не отклоняйся от плана. Caude должен следовать архитектуре проекта. Сначала — структура, потом — оптимизация.

---

**Удачи в реализации проекта! Claude Code + правильно настроенный контекст = быстрый и качественный продукт.** 🚗💨
