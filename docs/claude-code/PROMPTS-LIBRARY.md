# 🎯 Библиотека промптов для Claude Code

Готовые промпты для типовых задач разработки проекта «Домкрат».

> **Использование**: копируй промпт, подставляй переменные `<...>`, отправляй Claude Code.

---

## 📑 Содержание

1. [Bootstrap проекта](#bootstrap-проекта)
2. [Создание модуля NestJS](#создание-модуля-nestjs)
3. [Создание endpoint](#создание-endpoint)
4. [Создание Prisma модели](#создание-prisma-модели)
5. [Написание тестов](#написание-тестов)
6. [Интеграция с внешним API](#интеграция-с-внешним-api)
7. [Frontend компоненты](#frontend-компоненты)
8. [Багфиксы](#багфиксы)
9. [Рефакторинг](#рефакторинг)
10. [Code review](#code-review)

---

## Bootstrap проекта

### Промпт: Инициализация Prisma schema

```
Изучи документы:
- docs/CLAUDE-CODE/CLAUDE.md (правила проекта)
- docs/04-DATABASE-SCHEMA.md (часть 1 схемы БД)
- docs/04-DATABASE-SCHEMA-PART2.md (часть 2 схемы БД)

Создай полный файл apps/api/prisma/schema.prisma на основе документации.

Требования:
1. Все 80+ моделей из документации
2. Все enums корректно определены
3. Правильные relations с `onDelete` стратегиями (Cascade / Restrict / SetNull)
4. Все `@@index` и `@@unique` constraints
5. JSONB для мультиязычных полей (name, description)
6. Decimal для денежных полей (price, amount)
7. UUID для PK (через `@default(uuid())`)
8. Audit fields (created_at, updated_at) на всех таблицах
9. soft delete (deleted_at) на критичных сущностях

После создания:
1. Запусти `pnpm prisma format` для форматирования
2. Запусти `pnpm prisma validate` для проверки
3. Создай миграцию `pnpm prisma migrate dev --name init`
4. Запусти проверку: `pnpm prisma generate`

Если что-то непонятно в требованиях — спроси перед началом.

Отчитайся:
- Сколько моделей создано
- Какие были сложные моменты
- Что пропущено / упрощено и почему
```

---

### Промпт: Базовый seed скрипт

```
Изучи:
- docs/CLAUDE-CODE/CLAUDE.md
- apps/api/prisma/schema.prisma

Создай apps/api/prisma/seed.ts со следующими тестовыми данными:

1. **Users (5 ролей)**:
   - 1 SUPER_ADMIN (admin@domkrat.uz, password "Admin123!")
   - 2 ADMIN (admin1@, admin2@)
   - 3 CUSTOMERS с разными адресами
   - 2 MERCHANT (один TYPE_1, один TYPE_2)
   - 1 COURIER

2. **Categories**: 10 категорий с подкатегориями (Шины и диски, Расходные материалы, Тормозная система, Электрика, Кузовные запчасти и т.д.)

3. **Brands**: 10 популярных (Bosch, Mann, Mahle, Denso, NGK, Brembo, Continental, Castrol, Mobil 1, Hyundai)

4. **Car makes**: 20 популярных в UZ (Chevrolet, Toyota, Hyundai, KIA, BMW, Mercedes, Lada, Daewoo, и т.д.)

5. **Car models**: По 3-5 моделей на каждую марку

6. **Products**: 50 товаров с привязкой к мерчантам и категориям

7. **Warehouses**: 1 склад "Tashkent Main" с:
   - 3 зоны (A, B, C)
   - 5 стеллажей в каждой
   - 5 полок на стеллаж
   - 10 ячеек на полку
   - = 750 ячеек

8. **Delivery methods**:
   - SELF_PICKUP (бесплатно)
   - PLATFORM_COURIER (25,000 UZS базово)
   - YANDEX_GO (динамически)
   - BTS (35,000 UZS базово)

9. **Notification templates**: 10 базовых шаблонов (welcome, order_paid, order_delivered, etc.) с RU/UZ переводами

Требования к коду:
- Идемпотентный (через upsert)
- Хорошо структурирован (отдельные функции для каждой группы)
- С прогресс-барами (ora или просто console.log)
- Корректные relations
- Реалистичные данные (не "test1", "test2")

После: запусти `pnpm prisma db seed` и убедись что всё проходит.

Отчитайся по объёму данных.
```

---

## Создание модуля NestJS

### Промпт: Полный модуль (например, Products)

```
Изучи:
- docs/CLAUDE-CODE/CLAUDE.md (конвенции)
- docs/03-ARCHITECTURE.md (раздел "Products Module")
- docs/04-DATABASE-SCHEMA.md (таблица products)
- docs/06-API-SPECIFICATION.md (endpoints для products)
- docs/07-ROLES-PERMISSIONS.md (права для products)
- apps/api/src/modules/auth (как пример структуры модуля)

Создай модуль `apps/api/src/modules/products` со следующей структурой:

```
products/
├── products.module.ts
├── controllers/
│   ├── products.controller.ts          (PUBLIC: GET endpoints)
│   ├── merchant-products.controller.ts (MERCHANT: CRUD своих)
│   └── admin-products.controller.ts    (ADMIN: модерация)
├── services/
│   ├── products.service.ts
│   ├── product-search.service.ts
│   └── product-images.service.ts
├── repositories/
│   └── products.repository.ts
├── dto/
│   ├── create-product.dto.ts
│   ├── update-product.dto.ts
│   ├── list-products.dto.ts
│   ├── product-response.dto.ts
│   └── upload-image.dto.ts
├── entities/
│   └── product.entity.ts
├── events/
│   ├── product-created.event.ts
│   └── product-updated.event.ts
└── tests/
    ├── products.service.spec.ts
    └── products.controller.e2e-spec.ts
```

### Реализуй endpoints:

**Public (без auth)**:
- GET /v1/products — список с фильтрами
- GET /v1/products/:slug — детали товара
- GET /v1/products/featured

**Merchant** (роль MERCHANT/MERCHANT_STAFF):
- GET /v1/merchant/products
- POST /v1/merchant/products
- GET /v1/merchant/products/:id
- PATCH /v1/merchant/products/:id
- DELETE /v1/merchant/products/:id (soft delete)
- POST /v1/merchant/products/:id/images
- PATCH /v1/merchant/products/:id/status

**Admin** (роль ADMIN/SUPER_ADMIN):
- GET /v1/admin/products (все товары всех мерчантов)
- POST /v1/admin/products/:id/moderate (APPROVED/REJECTED)
- POST /v1/admin/products/:id/feature

### Особенности:
1. Multi-tenancy: мерчант видит только свои товары (`merchant_id = currentUser.merchantId`)
2. Используй CASL для проверки прав на конкретные сущности
3. Slug генерируется автоматически (`slugify` + counter если коллизия)
4. Валидация мультиязычных полей (минимум RU)
5. Эмиттит события `product.created`, `product.updated`, `product.status_changed`
6. Загрузка изображений в MinIO через `FilesService`
7. Кэширование детальных карточек товаров (Redis, TTL 5 мин)
8. Инвалидация кэша при изменении

### Тесты:
- Unit tests для service (минимум 80% coverage):
  - Создание товара
  - Обновление товара
  - Multi-tenancy (мерчант 1 не видит товары мерчанта 2)
  - Soft delete
  - Валидация мультиязычных полей
  - Обработка дубликатов SKU
- E2E tests:
  - Полный CRUD через API
  - Проверка авторизации (401, 403)
  - Загрузка изображений

### Swagger:
- Все endpoints с описаниями
- DTO с примерами
- Группировка по тегам (Products, Merchant Products, Admin Products)

После реализации:
1. Запусти все тесты: `pnpm test products`
2. Запусти линтер: `pnpm lint`
3. Проверь типы: `pnpm type-check`
4. Создай миграцию если нужны изменения в БД
5. Запусти приложение и проверь Swagger UI

Отчитайся:
- Список созданных файлов
- Test coverage
- Известные ограничения
- Открытые вопросы
```

---

## Создание endpoint

### Промпт: Один endpoint

```
Изучи:
- docs/CLAUDE-CODE/CLAUDE.md
- Существующий модуль: apps/api/src/modules/<module>

Добавь endpoint:

**Endpoint**: `<METHOD> /v1/<path>`
**Описание**: <что делает>
**Роль**: <CUSTOMER/MERCHANT/ADMIN/...>

**Request**:
```typescript
// DTO
{
  field1: string;
  field2: number;
  // ...
}
```

**Response**:
```typescript
{
  data: {
    // ...
  }
}
```

**Бизнес-логика**:
1. Шаг 1
2. Шаг 2
3. Шаг 3

**Edge cases**:
- Что если <условие> → ответ <код>
- Что если <условие> → ответ <код>

**Что сделать**:
1. Добавить DTO в `dto/`
2. Добавить метод в `<module>.service.ts`
3. Добавить endpoint в `<module>.controller.ts`
4. Защитить через Guards + CASL
5. Swagger декораторы
6. Юнит-тест для service
7. E2E тест для endpoint

После: запусти тесты и линтер.
```

---

### Примеры заполненных промптов для конкретных endpoints

#### Пример: POST /v1/orders

```
Изучи:
- docs/CLAUDE-CODE/CLAUDE.md
- docs/05-BUSINESS-FLOWS.md (раздел "Жизненный цикл заказа")
- docs/04-DATABASE-SCHEMA.md (таблицы orders, order_sub_orders, order_items)
- apps/api/src/modules/cart (existing)
- apps/api/src/modules/inventory (existing)

Реализуй endpoint POST /v1/orders для создания заказа из корзины.

**Роль**: CUSTOMER

**Request DTO**:
```typescript
{
  deliveryAddressId: string;        // UUID
  deliveryMethodId: string;          // UUID
  pickupPointId?: string;            // если SELF_PICKUP
  paymentMethod: 'CLICK' | 'PAYME' | 'UZUM' | 'COD';
  promoCode?: string;
  customerNotes?: string;
  isLegalEntity?: boolean;
  taxId?: string;                    // если juridical
}
```

**Response**:
```typescript
{
  data: {
    orderId: string;
    orderNumber: string;             // DK-2026-000001
    status: 'CREATED';
    paymentStatus: 'UNPAID';
    totalAmount: string;             // decimal as string
    paymentUrl?: string;             // если онлайн оплата
    expiresAt: string;               // ISO datetime
  }
}
```

**Бизнес-логика** (в транзакции):
1. Получить корзину пользователя
2. Если пустая → 400 "Cart is empty"
3. Загрузить адрес доставки и проверить принадлежность user'у
4. Загрузить delivery_method, проверить доступность
5. Рассчитать стоимость через PricingService:
   - subtotal = сумма items
   - discount = промокод (если есть)
   - delivery_cost = из delivery_method для адреса
   - vat = 12% от (subtotal - discount)
   - total = subtotal - discount + delivery_cost
6. Резервировать товары через InventoryService.reserve():
   - Использовать Redis lock
   - FIFO выборка
   - При нехватке → 422 "Insufficient stock for <product>"
7. Создать order с status=CREATED, payment_status=UNPAID
8. Сделать snapshot адреса в order.delivery_address_snapshot
9. Сделать snapshot цен и товаров в order_items
10. Разбить на sub_orders по merchant_id:
    - commission_rate из commission rules
    - merchant_payout = subtotal - commission
    - fulfillment_type FBO (Type 1) или FBS (Type 2)
11. Сгенерировать order_number "DK-{year}-{seq:06d}"
12. Очистить корзину
13. Установить expires_at = NOW() + 15 min
14. Эмиттнуть event "order.created"
15. Если COD → вернуть order; если онлайн → инициировать оплату через PaymentsService

**Особенности**:
- Транзакция целиком (rollback при любой ошибке)
- Idempotency key поддержка
- Логирование всех шагов
- Корректные decimal расчёты (decimal.js)

**Edge cases**:
- Корзина пустая → 400 BAD_REQUEST
- Адрес не принадлежит юзеру → 403 FORBIDDEN
- Товар out of stock → 422 INSUFFICIENT_STOCK с деталями
- Промокод недействителен → 400 INVALID_PROMO
- Промокод истёк → 400 PROMO_EXPIRED
- Доставка недоступна в зону → 422 DELIVERY_UNAVAILABLE
- Платёж не инициировался → 500 (с rollback)

**Тесты**:
- Happy path (онлайн оплата)
- Happy path (COD)
- Пустая корзина → 400
- Чужой адрес → 403
- Нехватка товара → 422
- Multi-merchant split (3 товара от 2 мерчантов → 2 sub_orders)
- Расчёт commission корректный
- Race condition: 2 одновременных заказа на тот же товар (один должен fail)

После: запусти тесты, проверь Swagger.
```

---

## Создание Prisma модели

### Промпт: Добавление новой таблицы

```
Изучи:
- docs/CLAUDE-CODE/CLAUDE.md
- apps/api/prisma/schema.prisma (текущая схема)

Добавь модель `<ModelName>` в schema.prisma.

**Назначение**: <зачем нужна таблица>

**Поля**:
| Поле | Тип | Описание |
|------|-----|----------|
| ... | ... | ... |

**Relations**:
- belongsTo <Model> (через <field>)
- hasMany <Model> (cascade на delete)

**Indexes**:
- (field1, field2) — для быстрого поиска по <use case>
- field3 unique

После:
1. Запусти `pnpm prisma format`
2. Создай миграцию: `pnpm prisma migrate dev --name add_<model>`
3. Проверь, что миграция применилась
4. Запусти `pnpm prisma generate`

Если есть бизнес-логика по новой таблице — спроси, нужен ли отдельный модуль.
```

---

## Написание тестов

### Промпт: Unit-тесты для service

```
Изучи:
- docs/CLAUDE-CODE/CLAUDE.md
- apps/api/src/modules/<module>/services/<service>.ts
- Существующие тесты других сервисов как пример

Напиши unit-тесты для <ServiceName> в `<service>.spec.ts`.

**Покрытие**:
- Все public методы
- Все edge cases
- Все ветки if/else
- Все throw'ы

**Подходы**:
- Использовать `jest-mock-extended` для Prisma
- Mocking всех внешних зависимостей (другие сервисы, http клиенты)
- AAA pattern (Arrange / Act / Assert)
- Описательные test names: "should X when Y"

**Покрытие сценариев**:
1. Happy path для каждого метода
2. Validation errors
3. NotFoundException
4. ForbiddenException (права)
5. ConflictException (дубликаты)
6. Database errors (Prisma errors handling)
7. Edge cases:
   - Пустые входы
   - Null значения
   - Граничные числа (0, негативные, очень большие)
   - Длинные строки

**Структура файла**:
```typescript
describe('<ServiceName>', () => {
  let service: <ServiceName>;
  let prisma: DeepMockProxy<PrismaService>;
  // ...

  beforeEach(async () => { ... });

  describe('methodA', () => {
    it('should X when Y', async () => { ... });
    it('should throw ZException when ...', async () => { ... });
  });

  describe('methodB', () => { ... });
});
```

После: запусти `pnpm test <service>` и убедись:
- Все тесты проходят
- Coverage > 80%

Отчитайся coverage по строкам / branches / functions.
```

---

### Промпт: E2E тест для endpoint

```
Изучи:
- docs/CLAUDE-CODE/CLAUDE.md
- apps/api/test/setup.ts (test setup)
- apps/api/src/modules/<module>/controllers/<controller>.ts
- Существующие e2e тесты как пример

Напиши e2e-тест для endpoint `<METHOD> /v1/<path>` в файле `<module>.controller.e2e-spec.ts`.

**Сценарии**:

1. **Успешные**:
   - 200/201 при правильных данных и правах
   - Корректный response body
   - Сохранение в БД (проверка через Prisma напрямую)
   - Эмит событий (через spy)

2. **Авторизация**:
   - 401 без токена
   - 401 с невалидным токеном
   - 401 с истёкшим токеном

3. **Авторизация (роли)**:
   - 403 если нет нужной роли
   - 200 с нужной ролью
   - 403 если пытается работать с чужими данными (multi-tenancy)

4. **Валидация**:
   - 400 при отсутствии required полей
   - 400 при неверных типах
   - 400 при невалидных форматах (email, phone)

5. **Бизнес-логика**:
   - 404 для несуществующих ресурсов
   - 409 для конфликтов
   - 422 для бизнес-ошибок

**Подходы**:
- Использовать `supertest`
- Каждый тест — изолированный (cleanup в afterEach)
- Реальная БД (через docker-compose тестовая)
- Без моков для большинства, кроме внешних API

**Помощники**:
- `createTestUser(role)` — создать тестового юзера и вернуть токен
- `createTestMerchant()` — создать мерчанта
- `cleanupDatabase()` — очистка

После: запусти `pnpm test:e2e <module>`.
```

---

## Интеграция с внешним API

### Промпт: Click платежи

```
Изучи:
- docs/CLAUDE-CODE/CLAUDE.md
- docs/08-INTEGRATIONS.md (раздел "Click")
- docs/05-BUSINESS-FLOWS.md (раздел "Жизненный цикл заказа")
- https://docs.click.uz (для уточнения деталей)

Реализуй интеграцию с Click Pay API.

**Файлы для создания**:
- apps/api/src/modules/payments/providers/click.provider.ts
- apps/api/src/modules/payments/webhooks/click-webhook.controller.ts
- apps/api/src/modules/payments/services/click-signature.service.ts
- apps/api/src/modules/payments/dto/click-webhook.dto.ts
- Тесты

**Реализуй**:

1. **ClickProvider** (implements PaymentProvider):
   - `initiate(params)`: создаёт URL для редиректа пользователя
   - `verifyPayment(transactionId)`: проверяет статус через API
   - `refund(transactionId, amount)`: refund

2. **Webhook controller** с 2 endpoints:
   - POST /webhooks/click/prepare
   - POST /webhooks/click/complete

3. **Signature verification** через MD5 (как в документации Click)

4. **Logging**:
   - Все запросы / ответы в payment_transactions.request_payload и response_payload
   - Уровень: INFO для нормальных, ERROR для сбоев

5. **Idempotency**:
   - Хранить click_trans_id в Redis (TTL 24h)
   - Не обрабатывать дубликаты webhook

6. **Безопасность**:
   - Whitelist IP-адресов Click
   - Логирование подозрительных запросов

**Конфигурация (env)**:
```
CLICK_SERVICE_ID=
CLICK_MERCHANT_ID=
CLICK_SECRET_KEY=
CLICK_RETURN_URL=https://domkrat.uz/orders/{orderId}/payment-result
```

**Тесты**:
1. Unit-тесты ClickProvider:
   - Корректное формирование URL
   - Корректная подпись
   - Обработка ошибок API
2. E2E-тесты webhooks:
   - Webhook PREPARE с валидной подписью → 200
   - Webhook PREPARE с невалидной подписью → 403
   - Webhook COMPLETE с success → order переходит в PAID
   - Webhook COMPLETE с error → order остаётся UNPAID
   - Дубликат webhook → не обрабатывается повторно

**Mock для тестов**:
- Используй `nock` для перехвата HTTP-запросов
- Тестовые карты из документации Click для интеграционных тестов

После: запусти все тесты, проверь Swagger.

Отчитайся:
- Что реализовано
- Известные ограничения
- Что нужно настроить в продакшене (production keys, IP whitelist, etc.)
```

---

## Frontend компоненты

### Промпт: Страница каталога

```
Изучи:
- docs/CLAUDE-CODE/CLAUDE.md (раздел Frontend конвенции)
- packages/ui/components (существующие компоненты)
- apps/web/src/app/[locale]/page.tsx (главная как пример структуры)

Создай страницу категории товаров: `apps/web/src/app/[locale]/c/[slug]/page.tsx`

**Требования**:

1. **SSR с кэшированием**:
   - generateStaticParams для популярных категорий
   - revalidate: 60 секунд

2. **SEO**:
   - generateMetadata: title, description, og:image из категории
   - Хлебные крошки (Schema.org)
   - Canonical URL

3. **UI секции**:
   - Заголовок категории + описание
   - Хлебные крошки (Главная → Категория → Подкатегория)
   - Sidebar фильтров (слева):
     - Бренды (checkbox list, top-10 + "Показать все")
     - Цена (slider min/max)
     - Совместимость с авто (cascade selector)
     - Характеристики (динамически по категории)
     - В наличии
   - Сортировка (top right):
     - По популярности (default)
     - По цене ↑
     - По цене ↓
     - По рейтингу
     - По новинкам
   - Список товаров (grid):
     - Карточка: фото, название, цена, рейтинг, мерчант
     - Кнопка "В корзину"
     - "В избранное"
   - Пагинация (page-based)

4. **State management**:
   - URL params для фильтров и сортировки
   - TanStack Query для данных
   - Loading states (skeleton)

5. **Mobile**:
   - Фильтры → drawer на мобильных
   - Grid: 1 col mobile, 2 tablet, 3-4 desktop

6. **i18n**:
   - Все тексты через next-intl
   - Описание категории на текущем языке

**Компоненты для создания**:
- `apps/web/src/features/catalog/components/ProductCard.tsx`
- `apps/web/src/features/catalog/components/FiltersSidebar.tsx`
- `apps/web/src/features/catalog/components/SortDropdown.tsx`
- `apps/web/src/features/catalog/components/CategoryBreadcrumbs.tsx`
- `apps/web/src/features/catalog/components/CarCompatibilitySelector.tsx`

**API endpoints** (уже существуют):
- GET /v1/categories/:slug
- GET /v1/categories/:slug/products?filters=...

**Дизайн**:
- Цвета и токены из packages/ui/tailwind.config.js
- Иконки из lucide-react

**Acceptance criteria**:
- [ ] Страница рендерится с реальными данными
- [ ] Фильтры работают (применяются через URL)
- [ ] Поделиться ссылкой с фильтрами → восстанавливается состояние
- [ ] Mobile responsive
- [ ] Lighthouse Score > 90 (Performance, SEO)
- [ ] Нет CLS (Cumulative Layout Shift)

После: запусти dev сервер, протестируй вручную, сделай скриншоты для PR.
```

---

## Багфиксы

### Промпт: Исправление бага

```
**Bug ticket**: <DKR-456 / link>

**Описание**:
<what's broken>

**Шаги воспроизведения**:
1. ...
2. ...
3. ...

**Ожидаемое поведение**:
...

**Фактическое поведение**:
...

**Стектрейс / логи**:
```
<paste>
```

**Environment**:
- Browser/OS: ...
- API version: ...
- User role: ...

---

**Задача**:

1. **Воспроизведи баг локально**:
   - Опиши шаги в комментарии PR
   - Сделай скриншот / лог

2. **Напиши failing test**:
   - Unit или e2e (по типу бага)
   - Тест должен ВПАДЛУ воспроизводить баг

3. **Исправь**:
   - Минимальное изменение
   - Не делай рефакторинг по ходу
   - Если видишь связанные баги — отдельные задачи

4. **Проверь, что тест проходит**:
   - Запусти конкретный тест
   - Запусти все тесты модуля (regression)

5. **Документируй**:
   - В PR описании: что было, что стало, почему

После: создай PR с тегом `bug` и присвой себе.
```

---

## Рефакторинг

### Промпт: Извлечение сервиса

```
Изучи:
- docs/CLAUDE-CODE/CLAUDE.md
- apps/api/src/modules/<module>/services/<service>.ts

В файле `<service>.ts` есть метод `<methodName>` (строки X-Y), который стал слишком большим (>100 строк) и нарушает SRP.

**Задача**: вынести логику в отдельный сервис `<NewServiceName>`.

**Требования**:
1. Новый сервис в `apps/api/src/modules/<module>/services/<new-service>.service.ts`
2. Не менять публичный интерфейс существующего сервиса (только делегирование)
3. Все тесты должны продолжать проходить
4. Coverage не падает
5. Регистрировать в module как провайдер

**Шаги**:
1. Создай новый сервис
2. Перенеси методы
3. Обнови старый сервис на делегирование
4. Перенеси соответствующие тесты
5. Запусти все тесты — должны проходить
6. Запусти линтер

После: PR с описанием "Refactor: extract <NewService> from <OldService>"
```

---

## Code review

### Промпт: Self-review перед коммитом

```
Перед созданием PR self-review своих изменений.

**Чеклист**:

**Безопасность**:
- [ ] Все endpoints защищены гардами
- [ ] Multi-tenancy соблюдается (merchant_id filtering)
- [ ] Нет SQL injection (только Prisma queries)
- [ ] Нет утечки sensitive данных в response (password_hash, tokens)
- [ ] Валидация всех DTO

**Производительность**:
- [ ] Нет N+1 запросов
- [ ] Используются индексы для запросов
- [ ] Pagination на списочных endpoints
- [ ] Кэширование где уместно

**Корректность**:
- [ ] Транзакции для многошаговых операций
- [ ] Decimal для денег (не number)
- [ ] Корректные foreign key constraints
- [ ] Soft delete для критичных сущностей

**Качество**:
- [ ] TypeScript strict (нет any)
- [ ] JSDoc для публичных методов
- [ ] Логирование критичных операций
- [ ] Обработка ошибок (try/catch + throw)
- [ ] Нет console.log
- [ ] Нет TODO без ticket

**Тесты**:
- [ ] Юнит-тесты для service (coverage >80%)
- [ ] E2E тесты для endpoints
- [ ] Edge cases покрыты
- [ ] Multi-tenancy тестируется

**Документация**:
- [ ] Swagger декораторы
- [ ] CLAUDE.md обновлён (если новые конвенции)
- [ ] README модуля (если нужно)

**Конвенции**:
- [ ] Naming соответствует CLAUDE.md
- [ ] Файлы в правильной структуре
- [ ] Импорты отсортированы
- [ ] Линтер не показывает ошибок

Запусти:
- pnpm lint
- pnpm type-check
- pnpm test --coverage

Отчитайся о результатах и создай PR с описанием.
```

---

### Промпт: Review чужого PR

```
Изучи PR: <link>

**Проведи code review**:

1. **Архитектура**:
   - Соответствует ли CLAUDE.md?
   - Правильно ли использован slой (controller → service → repository)?
   - Нет ли смешения ответственностей?

2. **Безопасность**:
   - Все ли guards на месте?
   - Multi-tenancy соблюдается?
   - Нет ли потенциальных SQL injection / XSS?

3. **Производительность**:
   - N+1 проблемы?
   - Тяжёлые операции в hot path?
   - Корректные индексы для запросов?

4. **Корректность**:
   - Бизнес-логика правильная?
   - Edge cases обработаны?
   - Транзакции где нужно?

5. **Тесты**:
   - Покрытие достаточное?
   - Тесты осмысленные (не для галочки)?
   - Edge cases покрыты?

6. **Читаемость**:
   - Понятный код?
   - Имена переменных и функций ясные?
   - Нет ли overcomplexity?

**Формат review**:
- ✅ Что хорошо — отметь
- ⚠️ Что улучшить — конструктивно
- ❌ Что блокер — объясни почему

Не будь "rubber stamp" — задавай вопросы.
Не будь "nitpicky" — фокус на важном.
```

---

## 🎯 Метапромпты (для генерации новых промптов)

### Промпт: Сгенерировать промпт для задачи

```
Я хочу делегировать Claude Code следующую задачу:

<краткое описание>

Сгенерируй для меня детальный промпт по шаблонам из docs/CLAUDE-CODE/PROMPTS-LIBRARY.md.

Промпт должен:
1. Ссылаться на нужные документы
2. Иметь чёткие acceptance criteria
3. Перечислять файлы для создания/изменения
4. Указывать какие тесты нужны
5. Иметь шаги проверки в конце

Если задача слишком большая (>500 LOC) — разбей на несколько промптов.
```

---

**Используй эти промпты как стартовый шаблон. Адаптируй под конкретные задачи.** 🚀
