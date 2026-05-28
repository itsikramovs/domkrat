# 🗄️ 04. Схема базы данных

## PostgreSQL 16 + Prisma ORM

Полная схема базы данных проекта «Домкрат». Все таблицы описаны с типами, индексами, связями и комментариями.

---

## 📑 Содержание

1. [Принципы дизайна БД](#принципы-дизайна-бд)
2. [Группы таблиц](#группы-таблиц)
3. [Auth & Users](#1-auth--users)
4. [Merchants](#2-merchants)
5. [Catalog](#3-catalog)
6. [Compatibility (авто)](#4-compatibility-авто)
7. [Warehouse (WMS)](#5-warehouse-wms)
8. [Inventory](#6-inventory)
9. [Orders](#7-orders)
10. [Payments](#8-payments)
11. [Delivery](#9-delivery)
12. [Finance](#10-finance)
13. [Notifications](#11-notifications)
14. [CMS & Content](#12-cms--content)
15. [Audit & Logs](#13-audit--logs)
16. [System](#14-system)
17. [Ключевые индексы и производительность](#ключевые-индексы)
18. [Prisma Schema (готовый файл)](#prisma-schema)

---

## Принципы дизайна БД

### 1. **Naming conventions**
- Таблицы: `snake_case`, множественное число (`products`, `order_items`)
- Поля: `snake_case` (`created_at`, `merchant_id`)
- Foreign keys: `{table_singular}_id` (`product_id`, `user_id`)
- Индексы: `idx_{table}_{columns}` (`idx_products_merchant_id`)
- Уникальные индексы: `uq_{table}_{columns}`

### 2. **Первичные ключи**
- **UUID v7** (time-ordered) для всех пользовательских сущностей — лучше для распределённости
- **BIGSERIAL** для системных таблиц (audit_logs, events) — экономия места

### 3. **Soft delete**
Критичные сущности (Users, Merchants, Products, Orders) имеют поле `deleted_at` для soft delete. Это важно для финансовой отчётности и аудита.

### 4. **Audit fields на каждой таблице**
- `created_at` — timestamp создания
- `updated_at` — timestamp последнего изменения
- `created_by` — UUID пользователя (опционально)
- `updated_by` — UUID пользователя (опционально)

### 5. **Мультиязычность**
Переводимые поля хранятся как **JSONB**:
```json
{
  "ru": "Тормозные колодки",
  "uz": "Tormoz kolodkalari"
}
```

### 6. **Деньги**
Все денежные суммы — `DECIMAL(15, 2)` (поддержка до триллионов сум). **Никогда** не используем `FLOAT`.

### 7. **Enum типы**
Используем PostgreSQL ENUM для статусов — производительнее, чем строки, и type-safe.

### 8. **Индексы**
- Все foreign keys индексированы
- Поля для поиска и сортировки — индексированы
- Составные индексы для частых WHERE условий
- GIN индексы для JSONB и полнотекстового поиска
- pg_trgm для нечёткого поиска

---

## Группы таблиц

```
┌────────────────────────────────────────────────────────────────┐
│  AUTH & USERS         │  users, user_roles, user_addresses,    │
│                       │  user_garages, refresh_tokens,         │
│                       │  verification_codes                    │
├────────────────────────────────────────────────────────────────┤
│  MERCHANTS            │  merchants, merchant_documents,        │
│                       │  merchant_staff, merchant_contracts    │
├────────────────────────────────────────────────────────────────┤
│  CATALOG              │  categories, brands, products,         │
│                       │  product_variants, product_images,     │
│                       │  product_attributes, attribute_groups, │
│                       │  attributes, product_reviews, oem_codes│
├────────────────────────────────────────────────────────────────┤
│  COMPATIBILITY        │  car_makes, car_models, car_           │
│                       │  generations, car_modifications,       │
│                       │  car_engines, product_compatibility    │
├────────────────────────────────────────────────────────────────┤
│  WAREHOUSE (WMS)      │  warehouses, warehouse_zones,          │
│                       │  warehouse_racks, warehouse_shelves,   │
│                       │  warehouse_cells                       │
├────────────────────────────────────────────────────────────────┤
│  INVENTORY            │  inventory_balances, stock_movements,  │
│                       │  stock_reservations, stock_receipts    │
├────────────────────────────────────────────────────────────────┤
│  ORDERS               │  orders, order_items, order_sub_       │
│                       │  orders, order_status_history,         │
│                       │  carts, cart_items, returns            │
├────────────────────────────────────────────────────────────────┤
│  PAYMENTS             │  payments, payment_transactions,       │
│                       │  refunds                               │
├────────────────────────────────────────────────────────────────┤
│  DELIVERY             │  delivery_methods, delivery_zones,     │
│                       │  pickup_points, shipments,             │
│                       │  shipment_tracking, couriers           │
├────────────────────────────────────────────────────────────────┤
│  FINANCE              │  merchant_balances, financial_         │
│                       │  transactions, withdrawal_requests,    │
│                       │  commission_rules, rental_fees,        │
│                       │  invoices                              │
├────────────────────────────────────────────────────────────────┤
│  NOTIFICATIONS        │  notifications, notification_          │
│                       │  templates, notification_preferences   │
├────────────────────────────────────────────────────────────────┤
│  CMS                  │  pages, banners, blog_posts, faq,      │
│                       │  promo_blocks                          │
├────────────────────────────────────────────────────────────────┤
│  AUDIT                │  audit_logs, entity_changes            │
├────────────────────────────────────────────────────────────────┤
│  SYSTEM               │  settings, feature_flags, locales,     │
│                       │  translations                          │
└────────────────────────────────────────────────────────────────┘
```

---

## 1. AUTH & USERS

### Таблица: `users`
Базовая таблица всех пользователей системы.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | UUID v7 |
| `email` | VARCHAR(255) UNIQUE | Email (может быть NULL если регистрация по телефону) |
| `phone` | VARCHAR(20) UNIQUE | Телефон в формате +998XXXXXXXXX |
| `password_hash` | VARCHAR(255) | Argon2 hash |
| `first_name` | VARCHAR(100) | Имя |
| `last_name` | VARCHAR(100) | Фамилия |
| `middle_name` | VARCHAR(100) | Отчество |
| `avatar_url` | TEXT | URL аватара в MinIO |
| `birth_date` | DATE | Дата рождения |
| `gender` | ENUM('MALE','FEMALE','OTHER') | Пол |
| `preferred_language` | VARCHAR(2) | 'ru' или 'uz' |
| `is_active` | BOOLEAN DEFAULT true | Активен ли аккаунт |
| `is_email_verified` | BOOLEAN DEFAULT false | Подтверждён ли email |
| `is_phone_verified` | BOOLEAN DEFAULT false | Подтверждён ли телефон |
| `two_factor_enabled` | BOOLEAN DEFAULT false | Включена ли 2FA |
| `last_login_at` | TIMESTAMPTZ | Последний вход |
| `last_login_ip` | INET | IP последнего входа |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ DEFAULT NOW() | |
| `deleted_at` | TIMESTAMPTZ NULL | Soft delete |

**Индексы**:
- `uq_users_email` (UNIQUE on email WHERE deleted_at IS NULL)
- `uq_users_phone` (UNIQUE on phone WHERE deleted_at IS NULL)
- `idx_users_created_at`

---

### Таблица: `user_roles`
Many-to-many: пользователи и роли. Один пользователь может иметь несколько ролей.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users.id | |
| `role` | ENUM | См. ниже |
| `merchant_id` | UUID FK → merchants.id NULL | Для MERCHANT/MERCHANT_STAFF |
| `granted_by` | UUID FK → users.id NULL | Кто выдал роль |
| `granted_at` | TIMESTAMPTZ DEFAULT NOW() | |
| `expires_at` | TIMESTAMPTZ NULL | Опционально срок действия |

**ENUM `user_role`**:
```sql
CREATE TYPE user_role AS ENUM (
  'CUSTOMER',
  'MERCHANT',
  'MERCHANT_STAFF',
  'ADMIN',
  'SUPER_ADMIN',
  'WAREHOUSE_WORKER',
  'WAREHOUSE_MANAGER',
  'CONTENT_MANAGER',
  'COURIER',
  'FINANCE_MANAGER',
  'SUPPORT_AGENT'
);
```

**Индексы**:
- `idx_user_roles_user_id`
- `idx_user_roles_role`
- `uq_user_roles_user_role_merchant` (UNIQUE: user_id, role, merchant_id)

---

### Таблица: `user_addresses`
Адреса доставки пользователей.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users.id | |
| `title` | VARCHAR(100) | Название ("Дом", "Работа") |
| `recipient_name` | VARCHAR(200) | ФИО получателя |
| `recipient_phone` | VARCHAR(20) | Телефон получателя |
| `region` | VARCHAR(100) | Область (Ташкентская обл.) |
| `city` | VARCHAR(100) | Город (Ташкент) |
| `district` | VARCHAR(100) | Район (Юнусабад) |
| `address_line` | TEXT | Адрес (улица, дом, кв.) |
| `landmark` | TEXT | Ориентир |
| `latitude` | DECIMAL(10,7) | Координаты |
| `longitude` | DECIMAL(10,7) | |
| `is_default` | BOOLEAN DEFAULT false | Адрес по умолчанию |
| `is_legal_entity` | BOOLEAN DEFAULT false | Юр.лицо |
| `company_name` | VARCHAR(255) | Название компании |
| `tax_id` | VARCHAR(50) | ИНН |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |
| `deleted_at` | TIMESTAMPTZ NULL | |

**Индексы**:
- `idx_user_addresses_user_id`

---

### Таблица: `user_garages`
Сохранённые автомобили пользователя (для удобного поиска совместимых запчастей).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users.id | |
| `nickname` | VARCHAR(100) | "Моя ласточка" |
| `vin` | VARCHAR(17) NULL | VIN-код |
| `car_modification_id` | UUID FK → car_modifications.id | Модификация авто |
| `year` | SMALLINT | Год выпуска |
| `license_plate` | VARCHAR(20) | Гос.номер (опционально) |
| `mileage` | INTEGER | Текущий пробег (км) |
| `mileage_updated_at` | TIMESTAMPTZ | |
| `engine_volume` | DECIMAL(3,1) | Объём двигателя |
| `fuel_type` | ENUM | PETROL/DIESEL/GAS/HYBRID/ELECTRIC |
| `transmission` | ENUM | MANUAL/AUTOMATIC/CVT/ROBOT |
| `is_primary` | BOOLEAN DEFAULT false | Основной авто |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Индексы**:
- `idx_user_garages_user_id`
- `idx_user_garages_car_modification`
- `idx_user_garages_vin` (для поиска)

---

### Таблица: `refresh_tokens`
Refresh-токены для JWT.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users.id | |
| `token_hash` | VARCHAR(255) | SHA-256 хэш токена |
| `device_info` | JSONB | { device, browser, os } |
| `ip_address` | INET | |
| `expires_at` | TIMESTAMPTZ | |
| `revoked_at` | TIMESTAMPTZ NULL | |
| `created_at` | TIMESTAMPTZ | |

**Индексы**:
- `idx_refresh_tokens_user_id`
- `idx_refresh_tokens_token_hash` (UNIQUE)
- `idx_refresh_tokens_expires_at` (для очистки)

---

### Таблица: `verification_codes`
SMS / Email коды верификации.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users.id NULL | NULL для регистрации |
| `identifier` | VARCHAR(255) | email или phone |
| `code_hash` | VARCHAR(255) | Хэш кода |
| `purpose` | ENUM | REGISTRATION/LOGIN/PASSWORD_RESET/PHONE_CHANGE |
| `attempts` | SMALLINT DEFAULT 0 | Попытки ввода |
| `expires_at` | TIMESTAMPTZ | |
| `used_at` | TIMESTAMPTZ NULL | |
| `created_at` | TIMESTAMPTZ | |

**Индексы**:
- `idx_verification_codes_identifier`
- `idx_verification_codes_expires_at`

---

## 2. MERCHANTS

### Таблица: `merchants`
Мерчанты (продавцы) на платформе.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users.id | Владелец аккаунта |
| `merchant_type` | ENUM('TYPE_1','TYPE_2') | Тип: склад платформы / свой склад |
| `legal_type` | ENUM('INDIVIDUAL','LLC','IE','OTHER') | ИП / ООО / ЧП |
| `legal_name` | VARCHAR(255) | Юр. название |
| `brand_name` | VARCHAR(255) | Бренд / магазин |
| `slug` | VARCHAR(100) UNIQUE | URL-slug (для страницы магазина) |
| `description` | JSONB | { ru, uz } |
| `logo_url` | TEXT | |
| `cover_url` | TEXT | |
| `tax_id` | VARCHAR(50) | ИНН |
| `registration_number` | VARCHAR(50) | Регистрационный номер |
| `bank_account` | VARCHAR(50) | Расчётный счёт |
| `bank_name` | VARCHAR(255) | Название банка |
| `bank_mfo` | VARCHAR(20) | МФО банка |
| `legal_address` | TEXT | Юр.адрес |
| `actual_address` | TEXT | Фактический адрес |
| `contact_email` | VARCHAR(255) | Контактный email |
| `contact_phone` | VARCHAR(20) | |
| `website` | VARCHAR(255) | |
| `status` | ENUM | См. ниже |
| `verification_status` | ENUM | См. ниже |
| `verified_at` | TIMESTAMPTZ NULL | |
| `verified_by` | UUID FK → users.id NULL | |
| `rating` | DECIMAL(3,2) DEFAULT 0 | Рейтинг от 0 до 5 |
| `total_sales` | INTEGER DEFAULT 0 | Кол-во продаж |
| `total_revenue` | DECIMAL(15,2) DEFAULT 0 | Общая выручка |
| `commission_rate` | DECIMAL(5,2) | Индивидуальная комиссия % |
| `is_active` | BOOLEAN DEFAULT true | |
| `suspended_until` | TIMESTAMPTZ NULL | Приостановка до |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |
| `deleted_at` | TIMESTAMPTZ NULL | |

**ENUM `merchant_status`**:
```sql
CREATE TYPE merchant_status AS ENUM (
  'PENDING',     -- ожидает верификации
  'ACTIVE',      -- активен
  'SUSPENDED',   -- приостановлен
  'BANNED',      -- забанен
  'CLOSED'       -- закрыт
);
```

**ENUM `verification_status`**:
```sql
CREATE TYPE verification_status AS ENUM (
  'NOT_SUBMITTED',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'REQUIRES_UPDATE'
);
```

**Индексы**:
- `uq_merchants_user_id` (UNIQUE)
- `uq_merchants_slug` (UNIQUE)
- `idx_merchants_status`
- `idx_merchants_type`

---

### Таблица: `merchant_documents`
Документы мерчантов (учредительные, лицензии и т.д.)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `merchant_id` | UUID FK → merchants.id | |
| `document_type` | ENUM | См. ниже |
| `file_url` | TEXT | MinIO URL |
| `file_name` | VARCHAR(255) | |
| `file_size` | INTEGER | bytes |
| `mime_type` | VARCHAR(50) | |
| `status` | ENUM('PENDING','APPROVED','REJECTED') | |
| `review_notes` | TEXT | Комментарий админа |
| `reviewed_at` | TIMESTAMPTZ NULL | |
| `reviewed_by` | UUID FK → users.id NULL | |
| `uploaded_at` | TIMESTAMPTZ | |

**ENUM `document_type`**:
- `BUSINESS_LICENSE` — лицензия
- `TAX_CERTIFICATE` — св-во о регистрации в налоговой
- `BANK_STATEMENT` — банковская справка
- `PASSPORT` — паспорт ИП
- `CHARTER` — устав ООО
- `CONTRACT` — договор с платформой
- `OTHER`

---

### Таблица: `merchant_staff`
Сотрудники мерчанта (под-аккаунты).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `merchant_id` | UUID FK → merchants.id | |
| `user_id` | UUID FK → users.id | |
| `position` | VARCHAR(100) | Должность |
| `permissions` | JSONB | Список прав доступа |
| `is_active` | BOOLEAN DEFAULT true | |
| `added_by` | UUID FK → users.id | |
| `created_at` | TIMESTAMPTZ | |

---

### Таблица: `merchant_contracts`
Договоры между мерчантами и платформой.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `merchant_id` | UUID FK → merchants.id | |
| `contract_number` | VARCHAR(50) | |
| `contract_type` | ENUM | TYPE_1/TYPE_2 |
| `commission_rate` | DECIMAL(5,2) | % комиссии |
| `rental_rate_per_month` | DECIMAL(10,2) | Аренда за ячейку/мес (для Тип 1) |
| `subscription_plan` | ENUM('NONE','BASIC','PRO','ENTERPRISE') | |
| `subscription_price` | DECIMAL(10,2) | Цена подписки |
| `signed_at` | DATE | |
| `valid_from` | DATE | |
| `valid_until` | DATE NULL | |
| `file_url` | TEXT | Скан подписанного |
| `status` | ENUM('DRAFT','ACTIVE','EXPIRED','TERMINATED') | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Индексы**:
- `uq_merchant_contracts_number` (UNIQUE)
- `idx_merchant_contracts_merchant_id`
- `idx_merchant_contracts_status`

---

## 3. CATALOG

### Таблица: `categories`
Категории товаров (древовидная иерархия).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `parent_id` | UUID FK → categories.id NULL | Родительская категория |
| `name` | JSONB | { ru, uz } |
| `slug` | VARCHAR(100) UNIQUE | |
| `description` | JSONB NULL | { ru, uz } |
| `icon_url` | TEXT | |
| `image_url` | TEXT | |
| `position` | INTEGER DEFAULT 0 | Порядок отображения |
| `level` | SMALLINT DEFAULT 0 | Уровень вложенности |
| `path` | LTREE | Материализованный путь (1.5.12) |
| `is_active` | BOOLEAN DEFAULT true | |
| `seo_title` | JSONB | { ru, uz } |
| `seo_description` | JSONB | { ru, uz } |
| `meta_keywords` | JSONB | { ru, uz } |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Индексы**:
- `idx_categories_parent_id`
- `idx_categories_path` (GIST для LTREE)
- `uq_categories_slug` (UNIQUE)
- `idx_categories_position`

**Пример иерархии**:
```
Шины и диски (1)
├── Шины (1.1)
│   ├── Летние (1.1.1)
│   ├── Зимние (1.1.2)
│   └── Всесезонные (1.1.3)
└── Диски (1.2)
    ├── Литые (1.2.1)
    └── Штампованные (1.2.2)
Расходные материалы (2)
├── Масла (2.1)
├── Фильтры (2.2)
└── Свечи (2.3)
```

---

### Таблица: `brands`
Бренды (производители).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `name` | VARCHAR(255) UNIQUE | Bosch, Mann, Toyota |
| `slug` | VARCHAR(100) UNIQUE | |
| `logo_url` | TEXT | |
| `description` | JSONB | { ru, uz } |
| `country_of_origin` | VARCHAR(100) | Страна |
| `website` | VARCHAR(255) | |
| `is_active` | BOOLEAN DEFAULT true | |
| `position` | INTEGER DEFAULT 0 | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Индексы**:
- `uq_brands_name`, `uq_brands_slug`
- `idx_brands_is_active`

---

### Таблица: `products`
Товары в каталоге. Это **общая карточка товара** — конкретный товар продаётся разными мерчантами как **product_variants** (см. ниже) или одним мерчантом.

> **Архитектурное решение**: на старте — один продукт = один мерчант (упрощение). На Phase 2 можно вынести общие карточки и связать с мерчантами через `product_offers`.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `merchant_id` | UUID FK → merchants.id | Продавец |
| `category_id` | UUID FK → categories.id | Категория |
| `brand_id` | UUID FK → brands.id NULL | Бренд |
| `sku` | VARCHAR(100) | SKU внутренний |
| `name` | JSONB | { ru, uz } |
| `slug` | VARCHAR(255) | |
| `description` | JSONB | { ru, uz }, поддержка HTML |
| `short_description` | JSONB | { ru, uz } |
| `oem_number` | VARCHAR(100) NULL | Оригинальный номер запчасти |
| `barcode` | VARCHAR(50) NULL | Штрих-код EAN/UPC |
| `manufacturer_part_number` | VARCHAR(100) NULL | Артикул производителя |
| `weight` | DECIMAL(10,3) | Вес в кг (для расчёта доставки) |
| `length` | DECIMAL(10,2) | см |
| `width` | DECIMAL(10,2) | см |
| `height` | DECIMAL(10,2) | см |
| `volume` | DECIMAL(10,3) | м³ (рассчитывается) |
| `price` | DECIMAL(15,2) | Цена продажи (UZS) |
| `compare_at_price` | DECIMAL(15,2) NULL | Цена до скидки |
| `cost_price` | DECIMAL(15,2) NULL | Себестоимость (видна только мерчанту) |
| `currency` | VARCHAR(3) DEFAULT 'UZS' | |
| `vat_rate` | DECIMAL(5,2) DEFAULT 12 | НДС % |
| `status` | ENUM | См. ниже |
| `is_featured` | BOOLEAN DEFAULT false | На главной |
| `is_new` | BOOLEAN DEFAULT false | Метка "Новинка" |
| `is_on_sale` | BOOLEAN DEFAULT false | На распродаже |
| `view_count` | INTEGER DEFAULT 0 | Просмотры |
| `purchase_count` | INTEGER DEFAULT 0 | Сколько раз купили |
| `rating` | DECIMAL(3,2) DEFAULT 0 | Рейтинг |
| `reviews_count` | INTEGER DEFAULT 0 | Кол-во отзывов |
| `seo_title` | JSONB | { ru, uz } |
| `seo_description` | JSONB | { ru, uz } |
| `search_keywords` | JSONB | Доп. ключевые слова |
| `published_at` | TIMESTAMPTZ NULL | Дата публикации |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |
| `deleted_at` | TIMESTAMPTZ NULL | |

**ENUM `product_status`**:
- `DRAFT` — черновик
- `PENDING_REVIEW` — на модерации
- `ACTIVE` — активен
- `INACTIVE` — скрыт
- `OUT_OF_STOCK` — нет в наличии (авто)
- `ARCHIVED` — архивирован
- `REJECTED` — отклонён модератором

**Индексы**:
- `idx_products_merchant_id`
- `idx_products_category_id`
- `idx_products_brand_id`
- `idx_products_status` (для фильтрации)
- `uq_products_merchant_sku` (UNIQUE: merchant_id + sku)
- `idx_products_oem_number` (с pg_trgm)
- `idx_products_slug` (UNIQUE WHERE deleted_at IS NULL)
- `idx_products_price`
- `idx_products_rating`
- `idx_products_published_at`
- `idx_products_search_tsv` (GIN tsvector на name + description)

---

### Таблица: `product_images`
Изображения товара.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `product_id` | UUID FK → products.id | |
| `url` | TEXT | URL изображения |
| `thumbnail_url` | TEXT | Превью |
| `alt_text` | JSONB | { ru, uz } |
| `position` | INTEGER DEFAULT 0 | Порядок |
| `is_primary` | BOOLEAN DEFAULT false | Главное фото |
| `width` | INTEGER | px |
| `height` | INTEGER | px |
| `file_size` | INTEGER | bytes |
| `created_at` | TIMESTAMPTZ | |

**Индексы**:
- `idx_product_images_product_id`

---

### Таблица: `attribute_groups`
Группы атрибутов (Размер, Совместимость, Технические).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `name` | JSONB | { ru, uz } |
| `slug` | VARCHAR(100) UNIQUE | |
| `position` | INTEGER | |

---

### Таблица: `attributes`
Атрибуты (характеристики) — справочник.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `attribute_group_id` | UUID FK → attribute_groups.id | |
| `name` | JSONB | { ru, uz } ("Размер шины") |
| `slug` | VARCHAR(100) UNIQUE | |
| `code` | VARCHAR(50) | Внутренний код ("tire_size") |
| `data_type` | ENUM | STRING/NUMBER/BOOLEAN/ENUM/MULTI_ENUM |
| `unit` | VARCHAR(20) | "мм", "л", "Вт" |
| `is_filterable` | BOOLEAN DEFAULT true | Используется в фильтрах |
| `is_searchable` | BOOLEAN DEFAULT false | В поиске |
| `is_required` | BOOLEAN DEFAULT false | Обязательно для категории |
| `position` | INTEGER | |
| `category_ids` | UUID[] | Категории, где используется |
| `enum_values` | JSONB | Для ENUM: [{value, label:{ru,uz}}] |

**Индексы**:
- `uq_attributes_slug` (UNIQUE)
- `idx_attributes_group_id`
- `idx_attributes_category_ids` (GIN)

---

### Таблица: `product_attributes`
Значения атрибутов для конкретного товара.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `product_id` | UUID FK → products.id | |
| `attribute_id` | UUID FK → attributes.id | |
| `value_string` | TEXT NULL | Для STRING |
| `value_number` | DECIMAL(15,4) NULL | Для NUMBER |
| `value_boolean` | BOOLEAN NULL | Для BOOLEAN |
| `value_enum` | VARCHAR(255) NULL | Для ENUM |
| `value_multi_enum` | TEXT[] NULL | Для MULTI_ENUM |

**Индексы**:
- `uq_product_attributes` (UNIQUE: product_id + attribute_id)
- `idx_product_attributes_attribute_value` (composite для быстрой фильтрации)

---

### Таблица: `oem_codes`
Оригинальные номера запчастей и кросс-номера.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `product_id` | UUID FK → products.id | |
| `oem_number` | VARCHAR(100) | |
| `manufacturer` | VARCHAR(100) | Toyota, BMW |
| `is_primary` | BOOLEAN DEFAULT false | Основной OEM |
| `created_at` | TIMESTAMPTZ | |

**Индексы**:
- `idx_oem_codes_product_id`
- `idx_oem_codes_oem_number` (с pg_trgm для поиска)
- `uq_oem_codes_product_number` (UNIQUE: product_id + oem_number)

---

### Таблица: `product_reviews`
Отзывы покупателей.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `product_id` | UUID FK → products.id | |
| `user_id` | UUID FK → users.id | |
| `order_id` | UUID FK → orders.id NULL | Подтверждение покупки |
| `rating` | SMALLINT | 1-5 |
| `title` | VARCHAR(255) | |
| `comment` | TEXT | |
| `pros` | TEXT | Плюсы |
| `cons` | TEXT | Минусы |
| `images` | TEXT[] | URL фотографий |
| `status` | ENUM('PENDING','APPROVED','REJECTED') | |
| `helpful_count` | INTEGER DEFAULT 0 | Кол-во "полезно" |
| `merchant_reply` | TEXT NULL | Ответ продавца |
| `merchant_replied_at` | TIMESTAMPTZ NULL | |
| `is_verified_purchase` | BOOLEAN DEFAULT false | Подтверждённая покупка |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Индексы**:
- `idx_product_reviews_product_id`
- `idx_product_reviews_user_id`
- `idx_product_reviews_rating`
- `idx_product_reviews_status`

---

## 4. COMPATIBILITY (АВТО)

### Таблица: `car_makes`
Марки авто.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `name` | VARCHAR(100) UNIQUE | Toyota, BMW |
| `slug` | VARCHAR(100) UNIQUE | |
| `logo_url` | TEXT | |
| `country_of_origin` | VARCHAR(100) | |
| `is_popular` | BOOLEAN DEFAULT false | На главной |
| `position` | INTEGER | |
| `created_at` | TIMESTAMPTZ | |

---

### Таблица: `car_models`
Модели авто.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `make_id` | UUID FK → car_makes.id | |
| `name` | VARCHAR(100) | Camry, X5 |
| `slug` | VARCHAR(100) | |
| `body_type` | ENUM | SEDAN/HATCHBACK/SUV/COUPE/WAGON/VAN/PICKUP |
| `image_url` | TEXT | |
| `is_active` | BOOLEAN DEFAULT true | |

**Индексы**:
- `idx_car_models_make_id`
- `uq_car_models_make_slug` (UNIQUE: make_id + slug)

---

### Таблица: `car_generations`
Поколения моделей.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `model_id` | UUID FK → car_models.id | |
| `name` | VARCHAR(100) | "VII (XV40)" |
| `year_from` | SMALLINT | 2006 |
| `year_to` | SMALLINT NULL | 2011 (NULL = ещё в производстве) |
| `restyling_year` | SMALLINT NULL | Рестайлинг |

**Индексы**:
- `idx_car_generations_model_id`

---

### Таблица: `car_modifications`
Конкретные модификации (комплектация двигатель + трансмиссия).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `generation_id` | UUID FK → car_generations.id | |
| `name` | VARCHAR(200) | "2.4 AT (167 л.с.)" |
| `engine_id` | UUID FK → car_engines.id NULL | |
| `transmission` | ENUM | MANUAL/AUTOMATIC/CVT/ROBOT |
| `drive_type` | ENUM | FWD/RWD/AWD/4WD |
| `horsepower` | SMALLINT | л.с. |
| `fuel_type` | ENUM | PETROL/DIESEL/GAS/HYBRID/ELECTRIC |
| `market` | VARCHAR(50) | EU/USA/JP/UZ |

**Индексы**:
- `idx_car_modifications_generation_id`
- `idx_car_modifications_engine_id`

---

### Таблица: `car_engines`
Двигатели (могут быть в нескольких модификациях).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `name` | VARCHAR(100) | "2AZ-FE 2.4" |
| `code` | VARCHAR(50) UNIQUE | "2AZ-FE" |
| `displacement` | DECIMAL(3,1) | Объём (л) |
| `cylinders` | SMALLINT | Кол-во цилиндров |
| `power_hp` | SMALLINT | Мощность (л.с.) |
| `fuel_type` | ENUM | |
| `manufacturer` | VARCHAR(100) | Toyota |

---

### Таблица: `product_compatibility`
Связь товаров и модификаций авто (M:N) — какие товары подходят к каким авто.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `product_id` | UUID FK → products.id | |
| `car_modification_id` | UUID FK → car_modifications.id NULL | |
| `car_model_id` | UUID FK → car_models.id NULL | Если подходит ко всей модели |
| `car_make_id` | UUID FK → car_makes.id NULL | Если подходит ко всей марке (редко) |
| `year_from` | SMALLINT NULL | Доп. ограничение по годам |
| `year_to` | SMALLINT NULL | |
| `notes` | TEXT NULL | "Только для пре-рестайлинг" |
| `created_at` | TIMESTAMPTZ | |

**Индексы**:
- `idx_product_compatibility_product_id`
- `idx_product_compatibility_modification`
- `idx_product_compatibility_model`
- `idx_product_compatibility_make`
- Композитный индекс для быстрого поиска товаров по авто

**Логика**: при поиске по конкретной модификации авто — JOIN на все 3 уровня (модификация / модель / марка) и UNION.

---

**Продолжение в файле `04-DATABASE-SCHEMA-PART2.md`** (Warehouse, Inventory, Orders, Payments, Delivery, Finance, и остальные).
