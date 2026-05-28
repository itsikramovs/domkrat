# 🏛️ 03. Архитектура системы

## Подход: Modular Monolith → готовность к микросервисам

На этапе MVP используется **модульный монолит** (Modular Monolith) — все модули в одном приложении NestJS, но с **чёткими границами доменов**. Это позволяет:
- Быстро запустить MVP
- Не страдать от distributed system complexity на старте
- Легко выделить любой модуль в отдельный микросервис когда понадобится

---

## 📐 Слои приложения (Clean Architecture)

```
┌──────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                            │
│   Controllers (REST) | WebSocket Gateways | GraphQL Resolvers    │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                    APPLICATION LAYER                             │
│         Use Cases / Application Services / DTOs                  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                       DOMAIN LAYER                               │
│         Entities | Value Objects | Domain Services               │
│              Domain Events | Business Rules                      │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                            │
│   Repositories | External APIs | Cache | Queue | File Storage    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Модули системы (Bounded Contexts)

### 1. **Auth Module** — Аутентификация и авторизация
- Регистрация / вход (Email, Phone)
- JWT + Refresh tokens
- 2FA (SMS)
- OAuth providers (Phase 2)
- RBAC + CASL для атрибутивного доступа
- Lockout, brute-force защита

### 2. **Users Module** — Пользователи
- Профили (Customer, Merchant, Admin, Staff)
- Адреса доставки
- Гаражи (сохранённые авто)
- Wishlist / избранное
- Уведомления (preferences)

### 3. **Catalog Module** — Каталог товаров
- Категории (древовидная иерархия)
- Бренды (производители запчастей)
- Товары и варианты
- Характеристики (атрибуты)
- Изображения
- Отзывы и рейтинги
- SEO-метаданные

### 4. **Compatibility Module** — Совместимость с авто
- Справочник: Марка → Модель → Поколение → Модификация
- Связь товар ↔ модификации авто (M:N)
- VIN-поиск через внешний API
- Двигатели, годы выпуска, рынки
- OEM-номера и кросс-номера

### 5. **Search Module** — Поиск
- Индексация в Meilisearch
- Полнотекстовый поиск по товарам
- Фасеточные фильтры
- Автокомплит и подсказки
- Поиск по артикулу / OEM
- Поиск с опечатками

### 6. **Cart & Checkout Module** — Корзина и оформление
- Корзина (для гостей в Redis, для авториз. в БД)
- Расчёт стоимости (товары + доставка + промокоды)
- Промокоды и скидки
- Оформление заказа
- Multi-merchant checkout (заказ может содержать товары разных мерчантов)

### 7. **Orders Module** — Заказы
- Создание и жизненный цикл заказа
- Подзаказы по мерчантам (split-order)
- Статусы и переходы (state machine)
- История изменений (audit log)
- Возвраты и отмены
- Споры

### 8. **Warehouse Module (WMS)** — Складская система
- Структура складов: Склад → Зона → Стеллаж → Полка → Ячейка
- Приёмка товара
- Размещение (putaway) с QR-кодами
- Резервирование под заказы
- Отбор (picking) и сборка
- Отгрузка (shipping)
- Инвентаризация
- Мониторинг неликвида (>3 мес)

### 9. **Merchants Module** — Мерчанты
- Регистрация и верификация мерчантов
- Договоры (типы 1 и 2)
- Документы (юридические)
- Сотрудники (под-аккаунты)
- Настройки логистики
- Условия (комиссии, аренда)

### 10. **Inventory Module** — Остатки
- Остатки по локациям склада
- Остатки у мерчантов Тип 2
- Резервы под заказы
- Движение товаров (приход/расход/перемещение)
- FIFO учёт

### 11. **Payments Module** — Платежи
- Интеграции Click / Payme / Uzum
- COD (наличными при получении)
- Webhooks обработка
- Refund / Cancel
- Платёжные документы (чеки)

### 12. **Delivery Module** — Доставка
- Способы доставки (4 типа)
- Стоимость доставки (по зонам, весу)
- Интеграция Yandex Go, BTS
- Курьеры платформы (маршруты)
- Пункты выдачи
- Tracking

### 13. **Finance Module** — Финансы
- Балансы мерчантов
- Комиссии платформы (расчёт и удержание)
- Аренда складских мест
- Запросы на вывод
- Ручное подтверждение выплат админом
- Финансовые отчёты
- Налоги (НДС)

### 14. **Notifications Module** — Уведомления
- Email (через SMTP)
- SMS (Eskiz, PlayMobile)
- Push-уведомления (WebSocket для веба, FCM для мобилок)
- In-app уведомления (колокольчик)
- Шаблоны (RU/UZ)
- Преференции пользователей

### 15. **CMS Module** — Контент-менеджмент
- Баннеры (главная страница, категории)
- Статические страницы (О нас, Доставка, Возврат, FAQ)
- Блог (статьи о техобслуживании)
- SEO настройки
- Промо-блоки

### 16. **Analytics Module** — Аналитика
- События пользователей (просмотры, клики, покупки)
- Воронка конверсии
- Аналитика для мерчантов
- Складская аналитика (оборачиваемость, ABC-анализ)
- Финансовая аналитика

### 17. **Audit Module** — Аудит
- Логи всех критичных действий (изменение цен, статусов заказов, балансов)
- История изменений сущностей
- Кто, когда, что изменил

### 18. **Files Module** — Файлы
- Загрузка в MinIO
- Resize/optimize изображений (Sharp)
- Генерация thumbnails
- Watermark для фото товаров
- PDF-генерация (накладные, акты)

### 19. **i18n Module** — Локализация
- Управление переводами
- Языковые настройки пользователя
- Переводы динамического контента

### 20. **Settings Module** — Настройки системы
- Глобальные параметры (комиссии по умолчанию, налоги)
- Feature flags (включить/выключить функционал)
- Курсы валют (на будущее, если будет USD/RUB)

---

## 🔄 Взаимодействие модулей

### Sync (синхронные вызовы внутри монолита)
Используем NestJS DI — модули зависят друг от друга через интерфейсы.

```typescript
// Пример: OrdersModule зависит от других
imports: [
  UsersModule,
  CatalogModule,
  InventoryModule,
  PaymentsModule,
  DeliveryModule,
  NotificationsModule,
]
```

### Async (асинхронные события)
Используем **Event Emitter** (внутри монолита) + **BullMQ** для тяжёлых задач.

```typescript
// Пример: при создании заказа
this.eventEmitter.emit('order.created', new OrderCreatedEvent(order));

// Подписчики:
// - InventoryModule: резервирует товары
// - NotificationsModule: отправляет SMS клиенту
// - WarehouseModule: создаёт задачу на сборку
// - MerchantsModule: уведомляет мерчанта Тип 2
// - AnalyticsModule: записывает событие
```

### Готовность к микросервисам
Все асинхронные события идут через **EventBus**, который при разделении на микросервисы заменяется на **RabbitMQ/Kafka** без переписывания бизнес-логики.

---

## 🎭 Domain Events

Ключевые доменные события:

```typescript
// User Events
- UserRegistered
- UserVerified
- UserLoggedIn

// Order Events
- OrderCreated
- OrderPaid
- OrderConfirmed
- OrderPicked
- OrderShipped
- OrderDelivered
- OrderCancelled
- OrderRefunded

// Inventory Events
- StockReserved
- StockReleased
- StockReceived
- StockMoved
- LowStockDetected
- StaleStockDetected (неликвид)

// Merchant Events
- MerchantRegistered
- MerchantApproved
- MerchantSuspended
- WithdrawalRequested
- WithdrawalApproved

// Payment Events
- PaymentInitiated
- PaymentSucceeded
- PaymentFailed
- RefundProcessed
```

---

## 🛡️ Cross-cutting concerns

### 1. **Logging** (через NestJS Interceptor)
Логирование запросов / ответов / ошибок с correlation ID.

### 2. **Validation** (через Pipes)
Все DTO валидируются через class-validator.

### 3. **Authorization** (через Guards)
JWT Guard + Roles Guard + CASL Ability Guard.

### 4. **Error Handling** (через Filter)
Унифицированный формат ошибок:
```json
{
  "statusCode": 404,
  "error": "NOT_FOUND",
  "message": "Product not found",
  "timestamp": "2026-05-26T10:30:00Z",
  "path": "/api/v1/products/123",
  "correlationId": "abc-123-xyz"
}
```

### 5. **Rate Limiting** (Throttler)
- Auth endpoints: 5 req/min
- API общий: 100 req/min на пользователя
- Поиск: 30 req/min на IP

### 6. **Caching** (Cache Interceptor + Redis)
- Категории — 1 час
- Карточки товаров — 5 мин
- Списки товаров — 1 мин
- Профиль пользователя — 5 мин

---

## 📁 Структура папок NestJS приложения

```
apps/api/src/
├── modules/
│   ├── auth/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── guards/
│   │   ├── strategies/
│   │   ├── dto/
│   │   └── auth.module.ts
│   ├── users/
│   ├── catalog/
│   │   ├── controllers/
│   │   │   ├── products.controller.ts
│   │   │   ├── categories.controller.ts
│   │   │   └── brands.controller.ts
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── entities/
│   │   ├── dto/
│   │   ├── events/
│   │   └── catalog.module.ts
│   ├── orders/
│   ├── warehouse/
│   ├── merchants/
│   ├── inventory/
│   ├── payments/
│   │   ├── providers/
│   │   │   ├── click.provider.ts
│   │   │   ├── payme.provider.ts
│   │   │   └── uzum.provider.ts
│   │   ├── webhooks/
│   │   └── payments.module.ts
│   ├── delivery/
│   ├── finance/
│   ├── notifications/
│   │   ├── channels/
│   │   │   ├── sms/
│   │   │   ├── email/
│   │   │   └── push/
│   │   └── templates/
│   ├── compatibility/
│   ├── search/
│   ├── cms/
│   ├── analytics/
│   ├── audit/
│   ├── files/
│   └── settings/
├── shared/
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   ├── utils/
│   └── constants/
├── infrastructure/
│   ├── database/
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── migrations/
│   ├── cache/
│   ├── queue/
│   ├── storage/
│   └── event-bus/
├── config/
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── redis.config.ts
│   └── ...
├── main.ts
└── app.module.ts
```

---

## 🔌 Внешние интеграции — Adapter Pattern

Каждая внешняя интеграция изолирована через **Port/Adapter** паттерн:

```typescript
// Domain layer (Port)
export interface PaymentProvider {
  initiatePayment(amount: number, orderId: string): Promise<PaymentResult>;
  verifyPayment(transactionId: string): Promise<PaymentStatus>;
  refund(transactionId: string, amount: number): Promise<RefundResult>;
}

// Infrastructure (Adapter)
@Injectable()
export class ClickPaymentAdapter implements PaymentProvider {
  // Реализация для Click
}

@Injectable()
export class PaymeAdapter implements PaymentProvider {
  // Реализация для Payme
}
```

**Преимущество**: можно легко добавить новую платёжную систему или подменить адаптер.

---

## ⚡ Производительность критичных эндпоинтов

### Каталог (GET /products)
- **Кэш Redis** на 1-5 минут (с invalidation при изменении товара)
- **Meilisearch** для фильтрации и поиска
- **Read replica** PostgreSQL (Phase 2)

### Корзина (GET /cart)
- **Redis** для всех данных корзины (быстрый доступ)
- Синхронизация с БД при оформлении заказа

### Карточка товара (GET /products/:slug)
- **ISR** в Next.js (revalidate 60s)
- Кэш Redis для горячих товаров

---

## 🔄 State Machine для заказа

Заказ имеет чёткие состояния и переходы:

```
                        ┌──> CANCELLED
                        │
CREATED → PAID ─────────┼──> PROCESSING → ASSEMBLED → SHIPPED → DELIVERED
                        │                                      │
                        └──> REFUND_REQUESTED                  ├──> COMPLETED
                                                               └──> RETURNED
```

Реализация: библиотека **xstate** или собственный движок состояний с проверкой переходов.

---

## 🎯 Принципы разделения данных мерчантов

### Multi-tenancy через **column-based isolation**:
- Все таблицы с данными мерчантов имеют `merchant_id`
- В каждом запросе из кабинета мерчанта автоматически добавляется фильтр `WHERE merchant_id = current_merchant_id`
- На уровне БД — **Row Level Security (RLS)** в PostgreSQL для критичных таблиц (Phase 2)

### Авторизация через CASL
```typescript
// Пример: мерчант может видеть только свои заказы
export class OrderAbility {
  define(ability: AbilityBuilder<Ability>, user: User) {
    if (user.role === 'MERCHANT') {
      ability.can('read', 'Order', { merchantId: user.merchantId });
      ability.cannot('update', 'Order', { status: 'CANCELLED' });
    }
  }
}
```

---

## 📦 Складская подсистема — отдельная архитектурная зона

WMS — самая сложная часть системы. Особенности:

### Event Sourcing для движения товаров
Все операции с товарами записываются как **immutable events**:
- StockReceived (приёмка)
- StockMoved (перемещение)
- StockReserved (резерв)
- StockReleased (снятие резерва)
- StockShipped (отгрузка)
- StockAdjusted (корректировка инвентаризации)

**Преимущество**: полная история движения, возможность восстановить состояние на любую дату.

### CQRS для запросов остатков
- **Write model**: события движения товаров
- **Read model**: денормализованная таблица `inventory_balances` для быстрого чтения

### Распределённые блокировки для резерва
При оформлении заказа — Redis-based lock на товар, чтобы избежать race condition при одновременных заказах:
```typescript
const lock = await redisLock.acquire(`product:${productId}`, 5000);
try {
  // проверить остаток и зарезервировать
} finally {
  await lock.release();
}
```

---

## 🚨 Готовность к масштабированию

### Что заложено сразу
1. **Модули как bounded contexts** — легко выделить в микросервисы
2. **EventBus** — готов к замене на брокер сообщений
3. **Read/Write separation** — Prisma поддерживает разные клиенты для replica
4. **Idempotent API** — все мутирующие операции с idempotency-key
5. **Stateless API** — масштабирование через увеличение pods
6. **Partitioning стратегия** для больших таблиц (orders, audit_logs, inventory_events)

### Когда понадобится разделение
- **Search Service** → выделить первым (нагрузка от каталога)
- **Payments Service** → выделить ради PCI compliance
- **Warehouse Service** → выделить когда складов будет много
- **Notifications Service** → выделить ради изоляции SMS API лимитов

---

**Далее**: см. `04-DATABASE-SCHEMA.md` для полной схемы БД.
