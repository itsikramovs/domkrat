# 🔌 06. API Specification

## REST API для проекта «Домкрат»

Базовые принципы, версионирование, авторизация, формат ответов и полный перечень endpoints.

---

## 📑 Содержание

1. [Принципы API](#принципы-api)
2. [Авторизация](#авторизация)
3. [Формат ответа](#формат-ответа)
4. [Обработка ошибок](#обработка-ошибок)
5. [Пагинация и фильтры](#пагинация-и-фильтры)
6. [Endpoints — Public (каталог)](#endpoints--public-каталог)
7. [Endpoints — Customer](#endpoints--customer)
8. [Endpoints — Merchant](#endpoints--merchant)
9. [Endpoints — Admin](#endpoints--admin)
10. [Endpoints — Warehouse](#endpoints--warehouse)
11. [Webhooks](#webhooks)
12. [WebSocket events](#websocket-events)

---

## Принципы API

### Базовый URL
```
Production:  https://api.domkrat.uz/v1
Staging:     https://api-staging.domkrat.uz/v1
Local dev:   http://localhost:3000/v1
```

### Версионирование
Через URL-prefix: `/v1`, `/v2`. При мажорных breaking changes — новая версия. Старая поддерживается минимум 6 месяцев.

### Стандарты
- **REST** + **JSON**
- **HTTPS** обязательно (HTTP редирект)
- **Content-Type**: `application/json; charset=utf-8`
- **CORS**: только разрешённые домены
- **HTTP методы**:
  - `GET` — чтение
  - `POST` — создание
  - `PATCH` — частичное обновление
  - `PUT` — полная замена
  - `DELETE` — удаление (soft delete для основных сущностей)

### Naming
- URL: kebab-case (`/order-items`)
- JSON поля: camelCase (`createdAt`, `totalAmount`)
- Query params: camelCase

### Идемпотентность
Все мутирующие запросы (`POST`, `PATCH`, `DELETE`) **должны** поддерживать заголовок:
```
Idempotency-Key: <uuid>
```
Дубликаты возвращают первый ответ (хранится 24ч в Redis).

### Локализация
Заголовок `Accept-Language: ru` или `uz` (default: `ru`).
Возвращаются мультиязычные поля в выбранном языке.

---

## Авторизация

### Стратегия: JWT (access) + Refresh tokens

**Access token** — 15 мин, JWT в заголовке:
```
Authorization: Bearer <access_token>
```

**Refresh token** — 30 дней, httpOnly cookie или Authorization Bearer для мобильных.

### POST `/auth/register`
Регистрация по телефону.

**Request**:
```json
{
  "phone": "+998901234567",
  "firstName": "Иван",
  "lastName": "Иванов",
  "password": "SecurePass123!"
}
```

**Response** 201:
```json
{
  "data": {
    "verificationId": "abc-123-uuid",
    "message": "SMS code sent",
    "expiresIn": 300
  }
}
```

### POST `/auth/verify-code`
Подтверждение SMS-кода.

**Request**:
```json
{
  "verificationId": "abc-123-uuid",
  "code": "123456"
}
```

**Response** 200:
```json
{
  "data": {
    "user": { "id": "...", "phone": "+998901234567", "roles": ["CUSTOMER"] },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ...",
      "expiresIn": 900
    }
  }
}
```

### POST `/auth/login`
Вход.

**Request**:
```json
{
  "identifier": "+998901234567",
  "password": "SecurePass123!"
}
```

### POST `/auth/refresh`
Обновление access-токена.

### POST `/auth/logout`
Выход (отзыв refresh-токена).

### POST `/auth/password-reset/request`
Запрос восстановления пароля (SMS-код).

### POST `/auth/password-reset/confirm`
Подтверждение нового пароля.

---

## Формат ответа

### Успешный ответ
```json
{
  "data": { ... } // или [...]
}
```

### Список с пагинацией
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 156,
    "totalPages": 8
  }
}
```

### Ошибка
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Phone must be in format +998XXXXXXXXX",
    "details": {
      "field": "phone",
      "rule": "format"
    },
    "correlationId": "req-abc-123",
    "timestamp": "2026-05-26T10:00:00Z"
  }
}
```

---

## Обработка ошибок

| Код | HTTP | Описание |
|-----|------|----------|
| `VALIDATION_ERROR` | 400 | Невалидные данные |
| `UNAUTHORIZED` | 401 | Нет токена / истёк |
| `FORBIDDEN` | 403 | Нет прав |
| `NOT_FOUND` | 404 | Ресурс не найден |
| `CONFLICT` | 409 | Конфликт (дубликат) |
| `RATE_LIMITED` | 429 | Превышен лимит запросов |
| `INTERNAL_ERROR` | 500 | Внутренняя ошибка |
| `SERVICE_UNAVAILABLE` | 503 | Сервис недоступен |
| `INSUFFICIENT_STOCK` | 422 | Недостаточно товара |
| `PAYMENT_FAILED` | 422 | Платёж не прошёл |
| `MERCHANT_SUSPENDED` | 403 | Мерчант заблокирован |
| `VERIFICATION_EXPIRED` | 410 | Код истёк |

---

## Пагинация и фильтры

### Query параметры

```
GET /products?page=1&perPage=20&sort=-createdAt&filter[categoryId]=abc&filter[brandId]=xyz&filter[priceMin]=100000&filter[priceMax]=500000
```

- `page`, `perPage` (max 100)
- `sort`: `-` префикс = desc (`-price` = price DESC)
- `filter[field]`: точное совпадение
- `filter[field][gte/lte/in]`: операторы
- `search`: полнотекстовый
- `include`: связанные сущности (`include=brand,category`)
- `fields`: выбор полей (`fields=id,name,price`)

---

## Endpoints — Public (каталог)

### Категории

```
GET    /categories                  Список категорий (дерево)
GET    /categories/:slug            Детали категории
GET    /categories/:slug/products   Товары в категории
```

### Бренды

```
GET    /brands                      Список брендов
GET    /brands/popular              Популярные на главную
```

### Товары

```
GET    /products                    Список товаров (с фильтрами)
GET    /products/:slug              Детали товара
GET    /products/:slug/reviews      Отзывы
GET    /products/:slug/compatibility Совместимость с авто
GET    /products/featured           Рекомендуемые
GET    /products/bestsellers        Хиты продаж
GET    /products/new                Новинки
```

### Поиск

```
GET    /search?q=...                Поиск товаров
GET    /search/suggest?q=...        Автокомплит
GET    /search/by-vin?vin=...       Поиск по VIN
GET    /search/by-oem?oem=...       Поиск по OEM
GET    /search/compatible           Поиск совместимых ?makeId=&modelId=&year=&modificationId=
```

### Авто (справочники)

```
GET    /cars/makes                  Все марки
GET    /cars/makes/:slug/models     Модели марки
GET    /cars/models/:id/generations Поколения
GET    /cars/generations/:id/modifications Модификации
```

### Контент

```
GET    /banners?position=HOME_MAIN  Баннеры
GET    /pages/:slug                 Статическая страница
GET    /faqs?category=...           FAQ
GET    /blog                        Статьи
GET    /blog/:slug                  Статья
```

### Магазины (мерчанты как публичные)

```
GET    /shops/:slug                 Страница магазина
GET    /shops/:slug/products        Товары магазина
```

---

## Endpoints — Customer

> Требуется `Authorization: Bearer <token>` и роль `CUSTOMER`.

### Профиль

```
GET    /me                          Текущий пользователь
PATCH  /me                          Обновить профиль
POST   /me/avatar                   Загрузить аватар
PATCH  /me/password                 Сменить пароль
PATCH  /me/preferences              Настройки уведомлений
DELETE /me                          Удалить аккаунт (soft delete)
```

### Адреса

```
GET    /me/addresses                Список адресов
POST   /me/addresses                Создать адрес
GET    /me/addresses/:id            Детали
PATCH  /me/addresses/:id            Обновить
DELETE /me/addresses/:id            Удалить
POST   /me/addresses/:id/set-default Сделать основным
```

### Гараж

```
GET    /me/garages                  Сохранённые авто
POST   /me/garages                  Добавить авто
PATCH  /me/garages/:id              Обновить (пробег и т.д.)
DELETE /me/garages/:id              Удалить
POST   /me/garages/decode-vin       Расшифровать VIN
```

### Избранное

```
GET    /me/wishlist                 Список избранного
POST   /me/wishlist/:productId      Добавить
DELETE /me/wishlist/:productId      Убрать
```

### Корзина

```
GET    /cart                        Получить корзину
POST   /cart/items                  Добавить товар
PATCH  /cart/items/:id              Изменить количество
DELETE /cart/items/:id              Удалить позицию
DELETE /cart                        Очистить корзину
POST   /cart/apply-promo            Применить промокод
DELETE /cart/promo                  Убрать промокод
GET    /cart/delivery-options       Доступные способы доставки
POST   /cart/calculate              Расчёт стоимости с доставкой
```

### Оформление заказа

```
POST   /orders                      Создать заказ из корзины
GET    /orders                      Мои заказы (история)
GET    /orders/:id                  Детали заказа
PATCH  /orders/:id/cancel           Отменить заказ
GET    /orders/:id/tracking         Tracking доставки
POST   /orders/:id/payment          Инициировать оплату
GET    /orders/:id/payment/status   Статус оплаты
POST   /orders/:id/review           Оставить отзыв
POST   /orders/:id/return-request   Запросить возврат
```

### Возвраты

```
GET    /returns                     Мои возвраты
GET    /returns/:id                 Детали
POST   /returns/:id/cancel          Отменить заявку
```

### Уведомления

```
GET    /notifications               Список (in-app)
PATCH  /notifications/:id/read      Пометить прочитанным
POST   /notifications/read-all      Прочитать все
GET    /notifications/unread-count  Кол-во непрочитанных
```

---

## Endpoints — Merchant

> Базовый префикс: `/merchant`. Роли: `MERCHANT`, `MERCHANT_STAFF`.

### Профиль и настройки

```
GET    /merchant/profile            Профиль мерчанта
PATCH  /merchant/profile            Обновить (требует пере-верификации)
GET    /merchant/documents          Документы
POST   /merchant/documents          Загрузить документ
GET    /merchant/contract           Активный договор
GET    /merchant/staff              Список сотрудников
POST   /merchant/staff/invite       Пригласить сотрудника
DELETE /merchant/staff/:id          Удалить сотрудника
```

### Товары

```
GET    /merchant/products           Мои товары
POST   /merchant/products           Создать товар
GET    /merchant/products/:id       Детали
PATCH  /merchant/products/:id       Обновить
DELETE /merchant/products/:id       Удалить (soft)
POST   /merchant/products/:id/images Загрузить фото
PATCH  /merchant/products/:id/status Изменить статус (ACTIVE/INACTIVE)
POST   /merchant/products/bulk-import Импорт из Excel
GET    /merchant/products/export    Экспорт в Excel
```

### Совместимость

```
GET    /merchant/products/:id/compatibility
POST   /merchant/products/:id/compatibility
DELETE /merchant/products/:id/compatibility/:compatId
```

### Остатки

```
GET    /merchant/inventory          Все остатки
GET    /merchant/inventory/alerts   Алерты (низкий остаток, неликвид)
PATCH  /merchant/inventory/:productId/quantity Обновить количество (для Type 2)
```

### Приёмки (для Type 1)

```
GET    /merchant/receipts           Список приёмок
POST   /merchant/receipts           Создать приёмку (DRAFT)
GET    /merchant/receipts/:id       Детали
PATCH  /merchant/receipts/:id       Обновить (только DRAFT)
POST   /merchant/receipts/:id/submit Отправить на приёмку
DELETE /merchant/receipts/:id       Удалить (только DRAFT)
```

### Заказы

```
GET    /merchant/orders             Заказы (sub_orders)
GET    /merchant/orders/:id         Детали
POST   /merchant/orders/:id/confirm Подтвердить (для Type 2)
POST   /merchant/orders/:id/ready   Готов к отгрузке
POST   /merchant/orders/:id/ship    Отгрузить (для Type 2)
GET    /merchant/orders/:id/print   Накладная PDF
```

### Финансы

```
GET    /merchant/balance            Балансы
GET    /merchant/transactions       История транзакций
GET    /merchant/withdrawals        Запросы на вывод
POST   /merchant/withdrawals        Создать запрос
GET    /merchant/withdrawals/:id    Детали
GET    /merchant/rental-fees        Начисления за аренду
GET    /merchant/invoices           Счета
```

### Аналитика

```
GET    /merchant/analytics/sales    Продажи (по дням/неделям/месяцам)
GET    /merchant/analytics/top-products Топ товаров
GET    /merchant/analytics/customers Аналитика по покупателям
GET    /merchant/analytics/conversion Конверсия
```

### Отзывы

```
GET    /merchant/reviews            Отзывы на товары мерчанта
POST   /merchant/reviews/:id/reply  Ответить на отзыв
```

---

## Endpoints — Admin

> Префикс: `/admin`. Роль: `ADMIN`, `SUPER_ADMIN`.

### Пользователи

```
GET    /admin/users                 Все пользователи
GET    /admin/users/:id             Детали
PATCH  /admin/users/:id             Обновить
PATCH  /admin/users/:id/status      Активировать/заблокировать
POST   /admin/users/:id/roles       Назначить роль
DELETE /admin/users/:id/roles/:role Снять роль
GET    /admin/users/:id/audit       История действий
```

### Мерчанты

```
GET    /admin/merchants             Все мерчанты
GET    /admin/merchants/:id         Детали
PATCH  /admin/merchants/:id         Обновить
POST   /admin/merchants/:id/approve Одобрить (PENDING → ACTIVE)
POST   /admin/merchants/:id/reject  Отклонить
POST   /admin/merchants/:id/suspend Приостановить
POST   /admin/merchants/:id/ban     Заблокировать
GET    /admin/merchants/:id/documents Документы
PATCH  /admin/merchants/:id/documents/:docId Одобрить/отклонить
GET    /admin/merchants/:id/contract Договор
POST   /admin/merchants/:id/contract Создать договор
```

### Каталог

```
GET    /admin/categories            Все категории
POST   /admin/categories            Создать
PATCH  /admin/categories/:id        Обновить
DELETE /admin/categories/:id        Удалить (soft)
POST   /admin/categories/reorder    Изменить порядок

GET    /admin/brands                Все бренды
POST   /admin/brands                Создать
PATCH  /admin/brands/:id            Обновить

GET    /admin/attributes            Все атрибуты
POST   /admin/attributes            Создать
PATCH  /admin/attributes/:id        Обновить

GET    /admin/products              Все товары (все мерчантов)
PATCH  /admin/products/:id/moderate Модерация (APPROVED/REJECTED)
POST   /admin/products/:id/feature  Добавить в "Рекомендуемые"
```

### Авто (справочник)

```
GET    /admin/cars/makes
POST   /admin/cars/makes
PATCH  /admin/cars/makes/:id
DELETE /admin/cars/makes/:id

GET    /admin/cars/models
POST   /admin/cars/models
...

POST   /admin/cars/import           Импорт справочника из CSV/JSON
```

### Заказы

```
GET    /admin/orders                Все заказы
GET    /admin/orders/:id            Детали
PATCH  /admin/orders/:id            Обновить
POST   /admin/orders/:id/cancel     Отменить
POST   /admin/orders/:id/refund     Возврат
GET    /admin/orders/disputes       Споры
```

### Склад

```
GET    /admin/warehouses            Все склады
POST   /admin/warehouses            Создать
PATCH  /admin/warehouses/:id        Обновить

GET    /admin/warehouses/:id/zones
POST   /admin/warehouses/:id/zones
...

GET    /admin/warehouses/:id/cells  Все ячейки
POST   /admin/warehouses/:id/cells  Создать ячейку
PATCH  /admin/cells/:id             Обновить (включая аренду)
GET    /admin/cells/:id/qr          Сгенерировать QR
POST   /admin/cells/bulk-generate   Массовая генерация ячеек
```

### Финансы

```
GET    /admin/finance/dashboard     Финансовый дашборд
GET    /admin/finance/transactions  Все транзакции
GET    /admin/finance/withdrawals   Все запросы на вывод
POST   /admin/finance/withdrawals/:id/approve Одобрить
POST   /admin/finance/withdrawals/:id/reject Отклонить
POST   /admin/finance/withdrawals/:id/complete Отметить выполненным
GET    /admin/finance/commissions   Правила комиссий
POST   /admin/finance/commissions   Создать правило
PATCH  /admin/finance/commissions/:id
DELETE /admin/finance/commissions/:id
GET    /admin/finance/rental-fees   Начисления аренды
POST   /admin/finance/rental-fees/run-cron Запустить начисление вручную
GET    /admin/finance/reports/sales Отчёт продаж
GET    /admin/finance/reports/commissions Отчёт комиссий
```

### CMS

```
GET    /admin/cms/pages
POST   /admin/cms/pages
PATCH  /admin/cms/pages/:id
DELETE /admin/cms/pages/:id

GET    /admin/cms/banners
POST   /admin/cms/banners
...

GET    /admin/cms/promo-codes
POST   /admin/cms/promo-codes
...

GET    /admin/cms/blog
POST   /admin/cms/blog
...
```

### Уведомления

```
GET    /admin/notifications/templates
PATCH  /admin/notifications/templates/:id
POST   /admin/notifications/broadcast Массовая рассылка
```

### Настройки

```
GET    /admin/settings              Все настройки
PATCH  /admin/settings/:key         Обновить
GET    /admin/feature-flags
POST   /admin/feature-flags
PATCH  /admin/feature-flags/:id
```

### Аналитика

```
GET    /admin/analytics/overview    Общая
GET    /admin/analytics/users       Пользователи
GET    /admin/analytics/sales       Продажи
GET    /admin/analytics/products    Товары
GET    /admin/analytics/merchants   Мерчанты
```

### Аудит

```
GET    /admin/audit-logs            Лог действий
GET    /admin/audit-logs/:entityType/:entityId История изменений сущности
```

---

## Endpoints — Warehouse

> Роли: `WAREHOUSE_WORKER`, `WAREHOUSE_MANAGER`. Используется в мобильном приложении.

### Авторизация

```
POST   /warehouse/auth/login        Вход кладовщика
```

### Задачи

```
GET    /warehouse/tasks             Мои задачи
GET    /warehouse/tasks/available   Доступные к взятию
POST   /warehouse/tasks/:id/take    Взять задачу
GET    /warehouse/tasks/:id         Детали задачи
```

### Приёмка

```
GET    /warehouse/receipts/pending  Ожидающие приёмки
POST   /warehouse/receipts/:id/start Начать приёмку
POST   /warehouse/receipts/:id/items/:itemId/scan Сканировать товар
PATCH  /warehouse/receipts/:id/items/:itemId Подтвердить количество
POST   /warehouse/receipts/:id/qc Контроль качества
POST   /warehouse/receipts/:id/complete Завершить приёмку
```

### Размещение

```
GET    /warehouse/putaway/pending   Товары для размещения
POST   /warehouse/putaway/scan-product Сканировать товар
POST   /warehouse/putaway/scan-cell Сканировать ячейку
POST   /warehouse/putaway/place     Подтвердить размещение
```

### Сборка

```
GET    /warehouse/picking/tasks     Задания на сборку
POST   /warehouse/picking/:taskId/start Начать сборку
POST   /warehouse/picking/:taskId/items/:itemId/scan Подтвердить отбор
POST   /warehouse/picking/:taskId/complete Завершить сборку
GET    /warehouse/picking/:taskId/route Оптимальный маршрут
```

### Инвентаризация

```
GET    /warehouse/inventory/tasks   Задания на инвентаризацию
POST   /warehouse/inventory/:taskId/scan-cell
POST   /warehouse/inventory/:taskId/scan-product
POST   /warehouse/inventory/:taskId/complete
```

### Поиск

```
GET    /warehouse/search/cell/:qr   Найти ячейку по QR
GET    /warehouse/search/product/:barcode Найти товар по штрих-коду
```

---

## Endpoints — Courier

> Роль: `COURIER`.

```
GET    /courier/shipments           Мои доставки
GET    /courier/shipments/:id       Детали
POST   /courier/shipments/:id/pickup Забрал у мерчанта/склада
POST   /courier/shipments/:id/in-transit В пути
POST   /courier/shipments/:id/out-for-delivery У клиента
POST   /courier/shipments/:id/delivered Доставил (фото + подпись)
POST   /courier/shipments/:id/failed Не удалось доставить
POST   /courier/location            Обновить GPS
GET    /courier/route/optimize      Оптимизация маршрута
```

---

## Webhooks

### Входящие webhooks (от внешних систем)

#### Click webhook
```
POST   /webhooks/click/prepare
POST   /webhooks/click/complete
```

#### Payme webhook
```
POST   /webhooks/payme/notify
```

#### Uzum webhook
```
POST   /webhooks/uzum/notify
```

#### Yandex Go webhook
```
POST   /webhooks/yandex-go/status-update
```

#### BTS webhook
```
POST   /webhooks/bts/tracking
```

### Безопасность webhooks
- Проверка signature (HMAC-SHA256)
- Whitelist IP-адресов провайдеров
- Idempotency через `event_id`

### Исходящие webhooks (для мерчантов в будущем)

```
POST   /merchant/webhooks/endpoints Зарегистрировать endpoint
GET    /merchant/webhooks/events    События к подписке
GET    /merchant/webhooks/logs      Лог отправок
```

События для мерчантов: `order.created`, `order.cancelled`, `inventory.low`, и т.д.

---

## WebSocket events

### Подключение
```
wss://api.domkrat.uz/ws?token=<access_token>
```

### События от сервера (subscribe)

**Customer**:
- `order.status_changed` — изменился статус заказа
- `notification.new` — новое in-app уведомление
- `delivery.location_updated` — курьер обновил GPS

**Merchant**:
- `order.new` — новый заказ
- `inventory.alert` — алерт по складу
- `withdrawal.status_changed` — статус выплаты

**Warehouse**:
- `task.assigned` — назначена задача
- `picking.priority_order` — срочный заказ

### Отправка от клиента
- `subscribe`: подписка на конкретные события
- `ping`: keep-alive

### Пример

```javascript
// Подписка
ws.send(JSON.stringify({
  type: 'subscribe',
  events: ['order.status_changed', 'notification.new']
}));

// Получение
ws.onmessage = (msg) => {
  const event = JSON.parse(msg.data);
  // { type: 'order.status_changed', data: { orderId, newStatus } }
};
```

---

## Rate Limiting

| Эндпоинт | Лимит |
|----------|-------|
| `/auth/*` | 5 req/min на IP |
| `/auth/verify-code` | 3 попытки на verificationId |
| `/search/*` | 30 req/min на IP |
| Общие API (авторизованные) | 100 req/min на user |
| Общие API (анонимные) | 30 req/min на IP |
| Загрузка файлов | 10 req/min на user |
| Webhooks (входящие) | 100 req/min на endpoint |

При превышении: `429 Too Many Requests` с заголовком `Retry-After: 60`.

---

## OpenAPI / Swagger

Полная актуальная документация всегда доступна по адресу:

```
https://api.domkrat.uz/docs              # Swagger UI
https://api.domkrat.uz/docs-json         # OpenAPI 3.0 JSON
```

Документация автогенерируется из `@nestjs/swagger` декораторов в коде.

---

**Далее**: см. `07-ROLES-PERMISSIONS.md` для детальной матрицы прав.
