# 🗄️ 04. Схема БД (часть 2)

Продолжение `04-DATABASE-SCHEMA.md`. Складская система, заказы, платежи, доставка, финансы.

---

## 5. WAREHOUSE (WMS)

Архитектура: **полная иерархия** `Warehouse → Zone → Rack → Shelf → Cell`.

```
Warehouse "Ташкент Главный"
├── Zone "A" (Шины и диски)
│   ├── Rack "A-01"
│   │   ├── Shelf "A-01-1"
│   │   │   ├── Cell "A-01-1-01"
│   │   │   ├── Cell "A-01-1-02"
│   │   │   └── ...
│   │   ├── Shelf "A-01-2"
│   │   └── Shelf "A-01-3"
│   └── Rack "A-02"
├── Zone "B" (Расходные материалы)
└── Zone "C" (Кузовные запчасти)
```

### Таблица: `warehouses`
Склады (для мультискладовости в будущем).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `code` | VARCHAR(20) UNIQUE | "TASH-01" |
| `name` | JSONB | { ru, uz } |
| `type` | ENUM | PLATFORM/MERCHANT/PARTNER |
| `merchant_id` | UUID FK → merchants.id NULL | Если склад мерчанта |
| `address` | TEXT | |
| `region` | VARCHAR(100) | |
| `city` | VARCHAR(100) | |
| `latitude` | DECIMAL(10,7) | |
| `longitude` | DECIMAL(10,7) | |
| `contact_phone` | VARCHAR(20) | |
| `working_hours` | JSONB | {"mon": "9:00-18:00", ...} |
| `total_area` | DECIMAL(10,2) | м² |
| `is_active` | BOOLEAN DEFAULT true | |
| `is_pickup_point` | BOOLEAN DEFAULT false | Можно забрать самовывоз |
| `created_at` | TIMESTAMPTZ | |

**Индексы**:
- `uq_warehouses_code`
- `idx_warehouses_type`
- `idx_warehouses_merchant_id`

---

### Таблица: `warehouse_zones`
Зоны склада (Шины, Расходники, Кузовные...).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `warehouse_id` | UUID FK → warehouses.id | |
| `code` | VARCHAR(10) | "A", "B" |
| `name` | JSONB | { ru, uz } |
| `description` | TEXT | |
| `temperature_min` | DECIMAL(4,1) NULL | Для химии/масел |
| `temperature_max` | DECIMAL(4,1) NULL | |
| `humidity_max` | DECIMAL(4,1) NULL | |
| `category_restrictions` | UUID[] | Какие категории товаров можно |
| `is_hazardous` | BOOLEAN DEFAULT false | Опасные грузы |
| `is_active` | BOOLEAN DEFAULT true | |
| `position` | INTEGER | |

**Индексы**:
- `uq_warehouse_zones_code` (UNIQUE: warehouse_id + code)
- `idx_warehouse_zones_warehouse_id`

---

### Таблица: `warehouse_racks`
Стеллажи в зоне.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `zone_id` | UUID FK → warehouse_zones.id | |
| `code` | VARCHAR(20) | "A-01" |
| `position` | INTEGER | |
| `max_weight_kg` | DECIMAL(10,2) | Макс. нагрузка |
| `is_active` | BOOLEAN DEFAULT true | |

**Индексы**:
- `uq_warehouse_racks_code` (UNIQUE: zone_id + code)
- `idx_warehouse_racks_zone_id`

---

### Таблица: `warehouse_shelves`
Полки в стеллаже.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `rack_id` | UUID FK → warehouse_racks.id | |
| `code` | VARCHAR(30) | "A-01-1" |
| `level` | SMALLINT | Уровень снизу |
| `height_cm` | DECIMAL(6,2) | Высота полки |
| `max_weight_kg` | DECIMAL(10,2) | |
| `is_active` | BOOLEAN DEFAULT true | |

**Индексы**:
- `uq_warehouse_shelves_code` (UNIQUE: rack_id + code)
- `idx_warehouse_shelves_rack_id`

---

### Таблица: `warehouse_cells`
Ячейки на полке — конечная точка хранения.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `shelf_id` | UUID FK → warehouse_shelves.id | |
| `code` | VARCHAR(40) UNIQUE | "A-01-1-01" (полный код) |
| `qr_code` | VARCHAR(100) UNIQUE | Для сканирования |
| `barcode` | VARCHAR(50) UNIQUE | |
| `cell_type` | ENUM | STANDARD/OVERSIZED/FRAGILE/PALLETTE |
| `length_cm` | DECIMAL(6,2) | |
| `width_cm` | DECIMAL(6,2) | |
| `height_cm` | DECIMAL(6,2) | |
| `volume_cm3` | DECIMAL(12,2) | Рассчитываемое |
| `max_weight_kg` | DECIMAL(10,2) | |
| `is_active` | BOOLEAN DEFAULT true | |
| `is_blocked` | BOOLEAN DEFAULT false | Заблокирована (ремонт) |
| `blocked_reason` | TEXT NULL | |
| `merchant_id` | UUID FK → merchants.id NULL | Если арендована конкретным мерчантом |
| `monthly_rental_fee` | DECIMAL(10,2) NULL | Цена аренды/мес |
| `rented_from` | DATE NULL | |
| `rented_until` | DATE NULL | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Индексы**:
- `uq_warehouse_cells_code` (UNIQUE)
- `uq_warehouse_cells_qr_code` (UNIQUE)
- `idx_warehouse_cells_shelf_id`
- `idx_warehouse_cells_merchant_id`
- `idx_warehouse_cells_is_active`

**Важно**: для аренды Тип-1 мерчантов — `merchant_id` присваивается ячейкам, и потом считается аренда.

---

## 6. INVENTORY

### Таблица: `inventory_balances`
**Read model** — текущие остатки. Денормализованная таблица для быстрого чтения.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `product_id` | UUID FK → products.id | |
| `merchant_id` | UUID FK → merchants.id | Кому принадлежит |
| `warehouse_id` | UUID FK → warehouses.id NULL | На каком складе (NULL для Type 2) |
| `cell_id` | UUID FK → warehouse_cells.id NULL | В какой ячейке (NULL для Type 2) |
| `quantity_available` | INTEGER DEFAULT 0 | Доступно к продаже |
| `quantity_reserved` | INTEGER DEFAULT 0 | Зарезервировано под заказы |
| `quantity_total` | INTEGER GENERATED | available + reserved |
| `last_received_at` | TIMESTAMPTZ NULL | Дата последней приёмки (для FIFO) |
| `oldest_received_at` | TIMESTAMPTZ NULL | Дата самой старой партии (для неликвида) |
| `last_sold_at` | TIMESTAMPTZ NULL | Последняя продажа |
| `updated_at` | TIMESTAMPTZ | |

**Индексы**:
- `uq_inventory_balances` (UNIQUE: product_id + merchant_id + cell_id) — для Type 1
- `uq_inventory_balances_type2` (UNIQUE: product_id + merchant_id WHERE cell_id IS NULL) — для Type 2
- `idx_inventory_balances_product_id`
- `idx_inventory_balances_merchant_id`
- `idx_inventory_balances_warehouse_id`
- `idx_inventory_balances_cell_id`
- `idx_inventory_balances_oldest_received` (для алертов о неликвиде)

---

### Таблица: `stock_movements`
**Event log** — все движения товаров. Append-only таблица (Event Sourcing).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | BIGSERIAL PK | |
| `product_id` | UUID FK → products.id | |
| `merchant_id` | UUID FK → merchants.id | |
| `movement_type` | ENUM | См. ниже |
| `quantity` | INTEGER | Может быть положительным или отрицательным |
| `from_cell_id` | UUID FK → warehouse_cells.id NULL | Откуда |
| `to_cell_id` | UUID FK → warehouse_cells.id NULL | Куда |
| `reference_type` | VARCHAR(50) NULL | "order", "receipt", "adjustment" |
| `reference_id` | UUID NULL | ID источника |
| `unit_cost` | DECIMAL(15,2) NULL | Себестоимость на момент операции |
| `notes` | TEXT NULL | |
| `performed_by` | UUID FK → users.id | Кто выполнил |
| `performed_at` | TIMESTAMPTZ DEFAULT NOW() | |

**ENUM `stock_movement_type`**:
```sql
CREATE TYPE stock_movement_type AS ENUM (
  'RECEIPT',          -- приёмка (приход)
  'RESERVE',          -- резерв под заказ
  'UNRESERVE',        -- снятие резерва
  'SHIPMENT',         -- отгрузка (по заказу)
  'TRANSFER',         -- перемещение между ячейками
  'RETURN',           -- возврат от клиента (приход)
  'ADJUSTMENT_PLUS',  -- корректировка +
  'ADJUSTMENT_MINUS', -- корректировка -
  'WRITE_OFF',        -- списание
  'INVENTORY'         -- инвентаризация
);
```

**Индексы**:
- `idx_stock_movements_product_id`
- `idx_stock_movements_merchant_id`
- `idx_stock_movements_type`
- `idx_stock_movements_reference` (composite: reference_type + reference_id)
- `idx_stock_movements_performed_at`
- `idx_stock_movements_cells` (composite from/to)

**Партиционирование**: по `performed_at` (по месяцам) — для огромных объёмов данных.

---

### Таблица: `stock_reservations`
Активные резервы под заказы. Когда заказ оформлен, но не отгружен.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `order_item_id` | UUID FK → order_items.id | |
| `product_id` | UUID FK → products.id | |
| `merchant_id` | UUID FK → merchants.id | |
| `cell_id` | UUID FK → warehouse_cells.id NULL | |
| `quantity` | INTEGER | |
| `reserved_at` | TIMESTAMPTZ | |
| `expires_at` | TIMESTAMPTZ NULL | Авто-снятие (для неоплаченных) |
| `released_at` | TIMESTAMPTZ NULL | Снят |
| `released_reason` | VARCHAR(100) NULL | "order_cancelled", "expired", "shipped" |

**Индексы**:
- `idx_stock_reservations_order_item`
- `idx_stock_reservations_product_id`
- `idx_stock_reservations_expires_at` (для cron очистки)

---

### Таблица: `stock_receipts`
Документы приёмки товаров от мерчантов (для Тип 1).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `receipt_number` | VARCHAR(50) UNIQUE | "RCT-2026-00001" |
| `merchant_id` | UUID FK → merchants.id | |
| `warehouse_id` | UUID FK → warehouses.id | |
| `status` | ENUM | См. ниже |
| `total_items` | INTEGER | |
| `total_quantity` | INTEGER | |
| `total_value` | DECIMAL(15,2) | Общая стоимость |
| `expected_at` | TIMESTAMPTZ | Ожидаемая дата приёмки |
| `received_at` | TIMESTAMPTZ NULL | Фактическая |
| `quality_check_status` | ENUM('PENDING','PASSED','FAILED','PARTIAL') | |
| `quality_check_notes` | TEXT | |
| `placement_status` | ENUM('PENDING','IN_PROGRESS','COMPLETED') | Размещение по ячейкам |
| `received_by` | UUID FK → users.id NULL | Кладовщик |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**ENUM `receipt_status`**:
- `DRAFT` — черновик от мерчанта
- `SUBMITTED` — подтверждён мерчантом
- `EXPECTED` — ожидается на складе
- `IN_TRANSIT` — в пути
- `ARRIVED` — прибыл
- `CHECKING` — проверка качества
- `PLACING` — размещение
- `COMPLETED` — оприходован
- `REJECTED` — отказ

**Индексы**:
- `uq_stock_receipts_number`
- `idx_stock_receipts_merchant_id`
- `idx_stock_receipts_status`
- `idx_stock_receipts_warehouse_id`

---

### Таблица: `stock_receipt_items`
Позиции в приёмке.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `receipt_id` | UUID FK → stock_receipts.id | |
| `product_id` | UUID FK → products.id | |
| `expected_quantity` | INTEGER | Ожидалось |
| `received_quantity` | INTEGER | Фактически принято |
| `accepted_quantity` | INTEGER | После контроля качества |
| `rejected_quantity` | INTEGER DEFAULT 0 | Брак |
| `rejection_reason` | TEXT | |
| `unit_cost` | DECIMAL(15,2) | Себестоимость единицы |
| `placed_in_cells` | JSONB | [{cell_id, quantity}, ...] |
| `created_at` | TIMESTAMPTZ | |

**Индексы**:
- `idx_stock_receipt_items_receipt_id`
- `idx_stock_receipt_items_product_id`

---

### Таблица: `inventory_alerts`
Алерты по складу (неликвид, низкий остаток).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `product_id` | UUID FK → products.id | |
| `merchant_id` | UUID FK → merchants.id | |
| `alert_type` | ENUM | См. ниже |
| `severity` | ENUM('INFO','WARNING','CRITICAL') | |
| `message` | JSONB | { ru, uz } |
| `data` | JSONB | Доп. данные |
| `status` | ENUM('ACTIVE','RESOLVED','DISMISSED') | |
| `resolved_at` | TIMESTAMPTZ NULL | |
| `resolved_by` | UUID FK → users.id NULL | |
| `created_at` | TIMESTAMPTZ | |

**ENUM `alert_type`**:
- `LOW_STOCK` — мало товара
- `OUT_OF_STOCK` — закончился
- `STALE_STOCK_30D` — лежит >30 дней
- `STALE_STOCK_60D` — лежит >60 дней
- `STALE_STOCK_90D` — лежит >90 дней (неликвид!)
- `RENTAL_DUE` — пора оплачивать аренду
- `RENTAL_OVERDUE` — просрочена аренда

---

## 7. ORDERS

### Таблица: `carts`
Корзины (для авторизованных пользователей; гостевые в Redis).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users.id NULL | NULL для гостей |
| `session_id` | VARCHAR(100) NULL | Для гостей |
| `currency` | VARCHAR(3) DEFAULT 'UZS' | |
| `subtotal` | DECIMAL(15,2) DEFAULT 0 | |
| `discount` | DECIMAL(15,2) DEFAULT 0 | |
| `total` | DECIMAL(15,2) DEFAULT 0 | |
| `promo_code` | VARCHAR(50) NULL | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |
| `expires_at` | TIMESTAMPTZ | Авто-очистка через 30 дней |

**Индексы**:
- `idx_carts_user_id`
- `idx_carts_session_id`
- `idx_carts_expires_at`

---

### Таблица: `cart_items`
Позиции в корзине.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `cart_id` | UUID FK → carts.id ON DELETE CASCADE | |
| `product_id` | UUID FK → products.id | |
| `quantity` | INTEGER CHECK quantity > 0 | |
| `price_at_added` | DECIMAL(15,2) | Цена на момент добавления |
| `created_at` | TIMESTAMPTZ | |

**Индексы**:
- `idx_cart_items_cart_id`
- `uq_cart_items_cart_product` (UNIQUE: cart_id + product_id)

---

### Таблица: `orders`
Главная таблица заказов.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `order_number` | VARCHAR(20) UNIQUE | "DK-2026-000001" |
| `user_id` | UUID FK → users.id | Покупатель |
| `customer_email` | VARCHAR(255) | Снапшот email |
| `customer_phone` | VARCHAR(20) | Снапшот телефона |
| `customer_name` | VARCHAR(255) | Снапшот ФИО |
| `status` | ENUM | См. ниже |
| `payment_status` | ENUM | См. ниже |
| `subtotal` | DECIMAL(15,2) | Сумма товаров |
| `discount_amount` | DECIMAL(15,2) DEFAULT 0 | Скидка |
| `delivery_cost` | DECIMAL(15,2) DEFAULT 0 | Стоимость доставки |
| `total_amount` | DECIMAL(15,2) | Итого к оплате |
| `currency` | VARCHAR(3) DEFAULT 'UZS' | |
| `vat_amount` | DECIMAL(15,2) | НДС |
| `paid_amount` | DECIMAL(15,2) DEFAULT 0 | Сколько оплачено |
| `delivery_method` | ENUM | SELF_PICKUP/PLATFORM_COURIER/EXTERNAL_DELIVERY/MERCHANT_DELIVERY |
| `delivery_address_id` | UUID FK → user_addresses.id NULL | |
| `delivery_address_snapshot` | JSONB | Снапшот адреса |
| `pickup_point_id` | UUID FK → pickup_points.id NULL | Для самовывоза |
| `payment_method` | ENUM | CLICK/PAYME/UZUM/COD/BANK_TRANSFER |
| `promo_code` | VARCHAR(50) NULL | |
| `customer_notes` | TEXT | |
| `internal_notes` | TEXT | Видны только админу |
| `is_legal_entity` | BOOLEAN DEFAULT false | Юр. лицо |
| `tax_id` | VARCHAR(50) NULL | ИНН |
| `language` | VARCHAR(2) | ru/uz |
| `source` | ENUM('WEB','MOBILE','ADMIN','API') | |
| `referral_source` | VARCHAR(100) | utm_source |
| `placed_at` | TIMESTAMPTZ | Дата оформления |
| `paid_at` | TIMESTAMPTZ NULL | Дата оплаты |
| `confirmed_at` | TIMESTAMPTZ NULL | Дата подтверждения мерчантом/складом |
| `shipped_at` | TIMESTAMPTZ NULL | Отгружен |
| `delivered_at` | TIMESTAMPTZ NULL | Доставлен |
| `completed_at` | TIMESTAMPTZ NULL | Закрыт |
| `cancelled_at` | TIMESTAMPTZ NULL | Отменён |
| `cancellation_reason` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**ENUM `order_status`**:
```sql
CREATE TYPE order_status AS ENUM (
  'CREATED',         -- создан, ожидает оплаты
  'PAID',            -- оплачен
  'PROCESSING',      -- в обработке (мерчант/склад)
  'ASSEMBLED',       -- собран
  'SHIPPED',         -- передан в доставку
  'OUT_FOR_DELIVERY',-- курьер у клиента
  'DELIVERED',       -- доставлен
  'COMPLETED',       -- завершён (клиент подтвердил приёмку)
  'CANCELLED',       -- отменён
  'REFUND_REQUESTED',
  'REFUNDED',
  'RETURNED'
);
```

**ENUM `payment_status`**:
```sql
CREATE TYPE payment_status AS ENUM (
  'UNPAID',
  'PENDING',         -- ожидает подтверждения от провайдера
  'PAID',
  'PARTIALLY_PAID',
  'REFUNDED',
  'FAILED'
);
```

**Индексы**:
- `uq_orders_number`
- `idx_orders_user_id`
- `idx_orders_status`
- `idx_orders_payment_status`
- `idx_orders_placed_at`
- `idx_orders_customer_phone` (для поиска)
- `idx_orders_status_placed_at` (composite)

**Партиционирование**: по `placed_at` (по месяцам) для долгосрочного хранения.

---

### Таблица: `order_sub_orders`
Подзаказы по мерчантам. Один заказ покупателя может содержать товары от разных мерчантов — каждый идёт как **sub-order** в обработке.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `order_id` | UUID FK → orders.id | |
| `merchant_id` | UUID FK → merchants.id | |
| `sub_order_number` | VARCHAR(30) UNIQUE | "DK-2026-000001-M1" |
| `status` | ENUM | Аналогично order_status |
| `subtotal` | DECIMAL(15,2) | Сумма по этому мерчанту |
| `commission_amount` | DECIMAL(15,2) | Комиссия платформы |
| `merchant_payout` | DECIMAL(15,2) | К выплате мерчанту |
| `fulfillment_type` | ENUM | FBO (Type 1) / FBS (Type 2) |
| `confirmed_at` | TIMESTAMPTZ NULL | |
| `assembled_at` | TIMESTAMPTZ NULL | |
| `shipped_at` | TIMESTAMPTZ NULL | |
| `completed_at` | TIMESTAMPTZ NULL | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Индексы**:
- `idx_order_sub_orders_order_id`
- `idx_order_sub_orders_merchant_id`
- `idx_order_sub_orders_status`

---

### Таблица: `order_items`
Позиции заказа.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `order_id` | UUID FK → orders.id | |
| `sub_order_id` | UUID FK → order_sub_orders.id | |
| `product_id` | UUID FK → products.id | |
| `merchant_id` | UUID FK → merchants.id | |
| `product_snapshot` | JSONB | Снапшот товара (name, image, sku, oem) |
| `quantity` | INTEGER | |
| `unit_price` | DECIMAL(15,2) | Цена за единицу |
| `discount` | DECIMAL(15,2) DEFAULT 0 | Скидка на эту позицию |
| `subtotal` | DECIMAL(15,2) | quantity * unit_price - discount |
| `vat_rate` | DECIMAL(5,2) | НДС % |
| `vat_amount` | DECIMAL(15,2) | НДС |
| `commission_rate` | DECIMAL(5,2) | Комиссия % на момент покупки |
| `commission_amount` | DECIMAL(15,2) | Сумма комиссии |
| `status` | ENUM | PENDING/RESERVED/PICKED/SHIPPED/CANCELLED |
| `picked_from_cell_id` | UUID FK → warehouse_cells.id NULL | Откуда забрали (для Тип 1) |
| `picked_at` | TIMESTAMPTZ NULL | |
| `picked_by` | UUID FK → users.id NULL | Кладовщик |

**Индексы**:
- `idx_order_items_order_id`
- `idx_order_items_sub_order_id`
- `idx_order_items_product_id`
- `idx_order_items_merchant_id`
- `idx_order_items_status`

---

### Таблица: `order_status_history`
История изменений статусов (для аудита и отображения клиенту).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | BIGSERIAL PK | |
| `order_id` | UUID FK → orders.id | |
| `sub_order_id` | UUID FK → order_sub_orders.id NULL | |
| `from_status` | VARCHAR(50) | |
| `to_status` | VARCHAR(50) | |
| `changed_by` | UUID FK → users.id NULL | |
| `changed_by_role` | VARCHAR(50) | |
| `reason` | TEXT | |
| `metadata` | JSONB | |
| `created_at` | TIMESTAMPTZ | |

**Индексы**:
- `idx_order_status_history_order_id`

---

### Таблица: `returns`
Возвраты товаров.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `return_number` | VARCHAR(30) UNIQUE | "RET-2026-00001" |
| `order_id` | UUID FK → orders.id | |
| `user_id` | UUID FK → users.id | |
| `reason` | ENUM | См. ниже |
| `reason_description` | TEXT | |
| `status` | ENUM | См. ниже |
| `refund_amount` | DECIMAL(15,2) | |
| `images` | TEXT[] | Фото товара/упаковки |
| `pickup_method` | ENUM | CUSTOMER_BRING/COURIER_PICKUP |
| `pickup_address_snapshot` | JSONB | |
| `requested_at` | TIMESTAMPTZ | |
| `approved_at` | TIMESTAMPTZ NULL | |
| `approved_by` | UUID FK → users.id NULL | |
| `received_at` | TIMESTAMPTZ NULL | |
| `refunded_at` | TIMESTAMPTZ NULL | |
| `rejected_reason` | TEXT | |

**ENUM `return_reason`**:
- `DEFECTIVE` — брак
- `WRONG_ITEM` — не тот товар
- `NOT_FITTING` — не подошло (не та модель авто)
- `CHANGED_MIND` — передумал
- `LATE_DELIVERY` — пришёл слишком поздно
- `DAMAGED_IN_TRANSIT` — повреждён при доставке
- `OTHER`

**ENUM `return_status`**:
- `REQUESTED` — заявка подана
- `APPROVED` — одобрена
- `REJECTED` — отклонена
- `IN_TRANSIT` — в пути обратно
- `RECEIVED` — получили
- `INSPECTING` — проверяют
- `REFUNDED` — деньги вернули
- `COMPLETED`

---

### Таблица: `return_items`
Позиции в возврате.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `return_id` | UUID FK → returns.id | |
| `order_item_id` | UUID FK → order_items.id | |
| `quantity` | INTEGER | |
| `condition` | ENUM('NEW','USED','DAMAGED','UNUSABLE') | Состояние при получении |
| `restocked` | BOOLEAN DEFAULT false | Вернули на склад |

---

## 8. PAYMENTS

### Таблица: `payments`
Платежи (агрегатор).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `order_id` | UUID FK → orders.id | |
| `user_id` | UUID FK → users.id | |
| `payment_method` | ENUM | CLICK/PAYME/UZUM/COD/BANK_TRANSFER |
| `amount` | DECIMAL(15,2) | |
| `currency` | VARCHAR(3) DEFAULT 'UZS' | |
| `status` | ENUM | См. ниже |
| `provider_payment_id` | VARCHAR(255) NULL | ID на стороне Click/Payme |
| `description` | TEXT | |
| `metadata` | JSONB | Доп. данные провайдера |
| `failure_reason` | TEXT NULL | |
| `initiated_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ NULL | |
| `expired_at` | TIMESTAMPTZ NULL | |
| `created_at` | TIMESTAMPTZ | |

**ENUM `payment_provider_status`**:
- `INITIATED` — создан
- `PENDING` — ожидает действия пользователя
- `PROCESSING` — на стороне провайдера
- `SUCCESS` — успех
- `FAILED` — ошибка
- `CANCELLED` — отменён
- `EXPIRED` — истёк
- `REFUNDED` — возвращён

**Индексы**:
- `idx_payments_order_id`
- `idx_payments_user_id`
- `idx_payments_status`
- `idx_payments_provider_id`

---

### Таблица: `payment_transactions`
Атомарные транзакции (один платёж может иметь несколько попыток).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `payment_id` | UUID FK → payments.id | |
| `provider` | ENUM | CLICK/PAYME/UZUM |
| `transaction_type` | ENUM | CHARGE/REFUND/VERIFY |
| `provider_transaction_id` | VARCHAR(255) | |
| `amount` | DECIMAL(15,2) | |
| `status` | ENUM | SUCCESS/FAILED/PENDING |
| `request_payload` | JSONB | Что отправили |
| `response_payload` | JSONB | Что получили |
| `created_at` | TIMESTAMPTZ | |

**Индексы**:
- `idx_payment_transactions_payment_id`
- `idx_payment_transactions_provider_id`

---

### Таблица: `refunds`
Возвраты денег.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `payment_id` | UUID FK → payments.id | |
| `return_id` | UUID FK → returns.id NULL | |
| `amount` | DECIMAL(15,2) | |
| `reason` | TEXT | |
| `status` | ENUM | PENDING/PROCESSING/COMPLETED/FAILED |
| `provider_refund_id` | VARCHAR(255) NULL | |
| `processed_at` | TIMESTAMPTZ NULL | |
| `processed_by` | UUID FK → users.id NULL | |
| `created_at` | TIMESTAMPTZ | |

---

## 9. DELIVERY

### Таблица: `delivery_methods`
Способы доставки.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `code` | VARCHAR(50) UNIQUE | |
| `name` | JSONB | { ru, uz } |
| `description` | JSONB | { ru, uz } |
| `type` | ENUM | SELF_PICKUP/PLATFORM_COURIER/EXTERNAL_DELIVERY/MERCHANT_DELIVERY |
| `provider` | VARCHAR(50) | yandex_go / bts / internal |
| `base_cost` | DECIMAL(10,2) | Базовая стоимость |
| `cost_per_kg` | DECIMAL(10,2) DEFAULT 0 | Доплата за кг |
| `min_delivery_days` | SMALLINT | |
| `max_delivery_days` | SMALLINT | |
| `is_active` | BOOLEAN DEFAULT true | |
| `position` | INTEGER | |

---

### Таблица: `delivery_zones`
Зоны доставки (регионы Узбекистана).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `name` | JSONB | { ru, uz } |
| `region_code` | VARCHAR(20) | "TASH", "SAM", "BUKH" |
| `cities` | TEXT[] | Список городов |
| `created_at` | TIMESTAMPTZ | |

---

### Таблица: `delivery_method_zones`
Связь способов доставки и зон с тарифами.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `delivery_method_id` | UUID FK → delivery_methods.id | |
| `delivery_zone_id` | UUID FK → delivery_zones.id | |
| `cost` | DECIMAL(10,2) | Стоимость для этой зоны |
| `delivery_days` | SMALLINT | |
| `is_available` | BOOLEAN DEFAULT true | |

---

### Таблица: `pickup_points`
Пункты выдачи (свои + партнёрские).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `code` | VARCHAR(50) UNIQUE | |
| `name` | JSONB | { ru, uz } |
| `address` | TEXT | |
| `region` | VARCHAR(100) | |
| `city` | VARCHAR(100) | |
| `latitude` | DECIMAL(10,7) | |
| `longitude` | DECIMAL(10,7) | |
| `phone` | VARCHAR(20) | |
| `working_hours` | JSONB | |
| `is_active` | BOOLEAN DEFAULT true | |
| `warehouse_id` | UUID FK → warehouses.id NULL | Если совмещён со складом |
| `created_at` | TIMESTAMPTZ | |

---

### Таблица: `shipments`
Отгрузки/посылки.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `tracking_number` | VARCHAR(50) UNIQUE | |
| `order_id` | UUID FK → orders.id | |
| `sub_order_id` | UUID FK → order_sub_orders.id NULL | |
| `delivery_method_id` | UUID FK → delivery_methods.id | |
| `carrier` | VARCHAR(50) | yandex_go / bts / internal |
| `external_tracking_number` | VARCHAR(100) NULL | Tracking у внешнего провайдера |
| `status` | ENUM | См. ниже |
| `from_warehouse_id` | UUID FK → warehouses.id NULL | |
| `to_address_snapshot` | JSONB | |
| `weight_kg` | DECIMAL(10,3) | |
| `dimensions` | JSONB | { length, width, height } |
| `cost` | DECIMAL(10,2) | |
| `courier_id` | UUID FK → couriers.id NULL | Для PLATFORM_COURIER |
| `estimated_delivery_at` | TIMESTAMPTZ | |
| `shipped_at` | TIMESTAMPTZ NULL | |
| `delivered_at` | TIMESTAMPTZ NULL | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**ENUM `shipment_status`**:
- `PREPARING` — собирается
- `READY_FOR_PICKUP` — готов к передаче курьеру
- `PICKED_UP` — забран курьером
- `IN_TRANSIT` — в пути
- `OUT_FOR_DELIVERY` — у курьера для клиента
- `DELIVERED` — доставлен
- `FAILED_DELIVERY` — не удалось доставить
- `RETURNED` — вернулся отправителю

**Индексы**:
- `uq_shipments_tracking_number`
- `idx_shipments_order_id`
- `idx_shipments_status`
- `idx_shipments_courier_id`

---

### Таблица: `shipment_tracking`
События доставки (для tracking timeline).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | BIGSERIAL PK | |
| `shipment_id` | UUID FK → shipments.id | |
| `event_type` | VARCHAR(50) | "picked_up", "in_transit", etc. |
| `description` | JSONB | { ru, uz } |
| `location` | VARCHAR(255) | "Ташкент, склад-сортировка" |
| `latitude` | DECIMAL(10,7) | |
| `longitude` | DECIMAL(10,7) | |
| `external_event_data` | JSONB | От Яндекса/BTS |
| `occurred_at` | TIMESTAMPTZ | |

---

### Таблица: `couriers`
Курьеры платформы.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users.id | |
| `employee_id` | VARCHAR(50) UNIQUE | Табельный |
| `vehicle_type` | ENUM | BICYCLE/MOTORCYCLE/CAR/VAN/TRUCK |
| `license_plate` | VARCHAR(20) | |
| `current_location` | GEOGRAPHY(POINT) | Текущая GPS-локация |
| `is_available` | BOOLEAN DEFAULT true | На смене |
| `is_active` | BOOLEAN DEFAULT true | |
| `phone` | VARCHAR(20) | |
| `rating` | DECIMAL(3,2) DEFAULT 0 | |
| `total_deliveries` | INTEGER DEFAULT 0 | |
| `created_at` | TIMESTAMPTZ | |

**Индексы**:
- `idx_couriers_user_id`
- `idx_couriers_is_available`
- `idx_couriers_location` (GIST для геозапросов)

---

## 10. FINANCE

### Таблица: `merchant_balances`
Балансы мерчантов.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `merchant_id` | UUID FK → merchants.id | |
| `available_balance` | DECIMAL(15,2) DEFAULT 0 | Доступно к выводу |
| `pending_balance` | DECIMAL(15,2) DEFAULT 0 | Заморожено (заказы не закрыты) |
| `total_earned` | DECIMAL(15,2) DEFAULT 0 | Всего заработано |
| `total_withdrawn` | DECIMAL(15,2) DEFAULT 0 | Всего выведено |
| `total_commission_paid` | DECIMAL(15,2) DEFAULT 0 | |
| `total_rental_paid` | DECIMAL(15,2) DEFAULT 0 | |
| `currency` | VARCHAR(3) DEFAULT 'UZS' | |
| `updated_at` | TIMESTAMPTZ | |

**Индексы**:
- `uq_merchant_balances_merchant_id` (UNIQUE)

---

### Таблица: `financial_transactions`
Финансовые транзакции (бухгалтерия).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `merchant_id` | UUID FK → merchants.id | |
| `transaction_type` | ENUM | См. ниже |
| `direction` | ENUM('CREDIT','DEBIT') | + или - |
| `amount` | DECIMAL(15,2) | |
| `balance_after` | DECIMAL(15,2) | Баланс после операции |
| `currency` | VARCHAR(3) | |
| `reference_type` | VARCHAR(50) | "order", "withdrawal", "rental" |
| `reference_id` | UUID | |
| `description` | TEXT | |
| `metadata` | JSONB | |
| `performed_by` | UUID FK → users.id NULL | Для ручных операций |
| `created_at` | TIMESTAMPTZ | |

**ENUM `financial_transaction_type`**:
- `SALE` — продажа товара
- `COMMISSION` — удержание комиссии
- `RENTAL_FEE` — списание аренды
- `SUBSCRIPTION_FEE` — списание подписки
- `WITHDRAWAL` — вывод средств
- `REFUND` — возврат
- `ADJUSTMENT` — ручная корректировка
- `BONUS` — бонус мерчанту

**Индексы**:
- `idx_financial_transactions_merchant_id`
- `idx_financial_transactions_type`
- `idx_financial_transactions_reference` (composite)
- `idx_financial_transactions_created_at`

**Партиционирование**: по `created_at` (по месяцам).

---

### Таблица: `withdrawal_requests`
Запросы мерчантов на вывод средств.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `request_number` | VARCHAR(30) UNIQUE | "WD-2026-00001" |
| `merchant_id` | UUID FK → merchants.id | |
| `amount` | DECIMAL(15,2) | |
| `currency` | VARCHAR(3) | |
| `bank_account` | VARCHAR(50) | |
| `bank_name` | VARCHAR(255) | |
| `bank_mfo` | VARCHAR(20) | |
| `recipient_name` | VARCHAR(255) | |
| `status` | ENUM | См. ниже |
| `notes` | TEXT | От мерчанта |
| `admin_notes` | TEXT | От админа |
| `rejection_reason` | TEXT | |
| `processed_by` | UUID FK → users.id NULL | |
| `processed_at` | TIMESTAMPTZ NULL | |
| `payment_proof_url` | TEXT NULL | Скан платёжного поручения |
| `external_transaction_id` | VARCHAR(100) NULL | ID банковской операции |
| `requested_at` | TIMESTAMPTZ | |

**ENUM `withdrawal_status`**:
- `PENDING` — ожидает рассмотрения
- `APPROVED` — одобрен админом
- `PROCESSING` — в обработке (отправлен в банк)
- `COMPLETED` — выполнен
- `REJECTED` — отклонён
- `CANCELLED` — отменён мерчантом

**Индексы**:
- `uq_withdrawal_requests_number`
- `idx_withdrawal_requests_merchant_id`
- `idx_withdrawal_requests_status`

---

### Таблица: `commission_rules`
Правила комиссий (могут быть индивидуальные или по категориям).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `name` | VARCHAR(255) | |
| `merchant_id` | UUID FK → merchants.id NULL | NULL = общее правило |
| `category_id` | UUID FK → categories.id NULL | NULL = для всех категорий |
| `merchant_type` | ENUM NULL | TYPE_1/TYPE_2 |
| `commission_rate` | DECIMAL(5,2) | % |
| `fixed_fee` | DECIMAL(10,2) DEFAULT 0 | Фиксированная сумма |
| `min_amount` | DECIMAL(15,2) NULL | Минимальная сумма заказа |
| `priority` | INTEGER DEFAULT 0 | Чем выше, тем приоритетнее |
| `valid_from` | DATE | |
| `valid_until` | DATE NULL | |
| `is_active` | BOOLEAN DEFAULT true | |
| `created_at` | TIMESTAMPTZ | |

---

### Таблица: `rental_fees`
Начисления за аренду ячеек.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `merchant_id` | UUID FK → merchants.id | |
| `cell_id` | UUID FK → warehouse_cells.id | |
| `period_start` | DATE | Период аренды |
| `period_end` | DATE | |
| `amount` | DECIMAL(10,2) | |
| `status` | ENUM('PENDING','CHARGED','OVERDUE','PAID','WAIVED') | |
| `charged_at` | TIMESTAMPTZ NULL | Когда списано с баланса |
| `paid_at` | TIMESTAMPTZ NULL | |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

**Индексы**:
- `idx_rental_fees_merchant_id`
- `idx_rental_fees_cell_id`
- `idx_rental_fees_status`
- `idx_rental_fees_period` (composite)

---

### Таблица: `invoices`
Счета-фактуры (для бухгалтерии).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `invoice_number` | VARCHAR(30) UNIQUE | |
| `merchant_id` | UUID FK → merchants.id NULL | Если для мерчанта |
| `order_id` | UUID FK → orders.id NULL | Если для заказа |
| `invoice_type` | ENUM | CUSTOMER/MERCHANT_PAYOUT/COMMISSION/RENTAL |
| `amount` | DECIMAL(15,2) | |
| `vat_amount` | DECIMAL(15,2) | |
| `total` | DECIMAL(15,2) | |
| `status` | ENUM | DRAFT/ISSUED/PAID/CANCELLED |
| `file_url` | TEXT NULL | PDF |
| `issued_at` | TIMESTAMPTZ | |
| `due_at` | TIMESTAMPTZ NULL | |
| `paid_at` | TIMESTAMPTZ NULL | |
| `created_at` | TIMESTAMPTZ | |

---

## 11. NOTIFICATIONS

### Таблица: `notification_templates`
Шаблоны уведомлений.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `code` | VARCHAR(100) UNIQUE | "order_confirmed", "low_stock_alert" |
| `name` | VARCHAR(255) | |
| `channel` | ENUM | EMAIL/SMS/PUSH/IN_APP |
| `subject_template` | JSONB | { ru, uz } — для email |
| `body_template` | JSONB | { ru, uz } |
| `variables` | TEXT[] | Доступные переменные |
| `is_active` | BOOLEAN DEFAULT true | |
| `created_at` | TIMESTAMPTZ | |

---

### Таблица: `notifications`
Лог отправленных уведомлений.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users.id NULL | |
| `template_code` | VARCHAR(100) | |
| `channel` | ENUM | |
| `recipient` | VARCHAR(255) | email/phone/device_id |
| `subject` | TEXT NULL | |
| `body` | TEXT | |
| `language` | VARCHAR(2) | |
| `status` | ENUM | PENDING/SENT/FAILED/READ |
| `error_message` | TEXT NULL | |
| `metadata` | JSONB | provider response |
| `sent_at` | TIMESTAMPTZ NULL | |
| `read_at` | TIMESTAMPTZ NULL | |
| `created_at` | TIMESTAMPTZ | |

**Индексы**:
- `idx_notifications_user_id`
- `idx_notifications_status`
- `idx_notifications_created_at`

**Партиционирование**: по `created_at` (по месяцам).

---

### Таблица: `notification_preferences`
Настройки уведомлений пользователя.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users.id | |
| `notification_type` | VARCHAR(100) | "order_updates", "promotions" |
| `email_enabled` | BOOLEAN DEFAULT true | |
| `sms_enabled` | BOOLEAN DEFAULT true | |
| `push_enabled` | BOOLEAN DEFAULT true | |
| `in_app_enabled` | BOOLEAN DEFAULT true | |
| `updated_at` | TIMESTAMPTZ | |

**Индексы**:
- `uq_notification_preferences` (UNIQUE: user_id + notification_type)

---

## 12. CMS & CONTENT

### Таблица: `pages`
Статические страницы (О нас, Доставка, Возврат).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `slug` | VARCHAR(100) UNIQUE | |
| `title` | JSONB | { ru, uz } |
| `content` | JSONB | { ru, uz } — HTML/MDX |
| `seo_title` | JSONB | |
| `seo_description` | JSONB | |
| `is_published` | BOOLEAN DEFAULT false | |
| `published_at` | TIMESTAMPTZ NULL | |
| `created_by` | UUID FK → users.id | |
| `updated_by` | UUID FK → users.id NULL | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

### Таблица: `banners`
Баннеры на главной и категориях.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `title` | JSONB | { ru, uz } |
| `subtitle` | JSONB | { ru, uz } |
| `image_url_desktop` | TEXT | |
| `image_url_mobile` | TEXT | |
| `link_url` | TEXT | |
| `position` | ENUM | HOME_MAIN/HOME_SECONDARY/CATEGORY_TOP/SIDEBAR |
| `category_id` | UUID FK → categories.id NULL | |
| `sort_order` | INTEGER | |
| `valid_from` | TIMESTAMPTZ | |
| `valid_until` | TIMESTAMPTZ NULL | |
| `is_active` | BOOLEAN DEFAULT true | |
| `click_count` | INTEGER DEFAULT 0 | |
| `view_count` | INTEGER DEFAULT 0 | |
| `created_at` | TIMESTAMPTZ | |

---

### Таблица: `promo_codes`
Промокоды.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `code` | VARCHAR(50) UNIQUE | "WELCOME2026" |
| `description` | JSONB | |
| `discount_type` | ENUM | PERCENTAGE/FIXED |
| `discount_value` | DECIMAL(10,2) | |
| `max_discount_amount` | DECIMAL(15,2) NULL | Для PERCENTAGE |
| `min_order_amount` | DECIMAL(15,2) NULL | |
| `usage_limit` | INTEGER NULL | NULL = безлимит |
| `usage_count` | INTEGER DEFAULT 0 | |
| `per_user_limit` | SMALLINT NULL | |
| `valid_from` | TIMESTAMPTZ | |
| `valid_until` | TIMESTAMPTZ | |
| `is_active` | BOOLEAN DEFAULT true | |
| `applicable_categories` | UUID[] | NULL = все |
| `applicable_merchants` | UUID[] | NULL = все |
| `created_at` | TIMESTAMPTZ | |

---

### Таблица: `promo_code_usages`
Использования промокодов.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `promo_code_id` | UUID FK → promo_codes.id | |
| `user_id` | UUID FK → users.id | |
| `order_id` | UUID FK → orders.id | |
| `discount_amount` | DECIMAL(15,2) | |
| `used_at` | TIMESTAMPTZ | |

---

### Таблица: `blog_posts`
Блог (статьи).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `slug` | VARCHAR(255) UNIQUE | |
| `title` | JSONB | |
| `excerpt` | JSONB | |
| `content` | JSONB | |
| `cover_image_url` | TEXT | |
| `category` | VARCHAR(100) | |
| `tags` | TEXT[] | |
| `author_id` | UUID FK → users.id | |
| `views_count` | INTEGER DEFAULT 0 | |
| `is_published` | BOOLEAN DEFAULT false | |
| `published_at` | TIMESTAMPTZ NULL | |
| `seo_title` | JSONB | |
| `seo_description` | JSONB | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

### Таблица: `faqs`
Часто задаваемые вопросы.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `category` | VARCHAR(100) | "delivery", "payment", "returns" |
| `question` | JSONB | |
| `answer` | JSONB | |
| `position` | INTEGER | |
| `is_active` | BOOLEAN DEFAULT true | |
| `views_count` | INTEGER DEFAULT 0 | |
| `helpful_count` | INTEGER DEFAULT 0 | |
| `created_at` | TIMESTAMPTZ | |

---

## 13. AUDIT & LOGS

### Таблица: `audit_logs`
Аудит критичных действий.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | BIGSERIAL PK | |
| `user_id` | UUID FK → users.id NULL | |
| `action` | VARCHAR(100) | "order.status.changed", "merchant.created" |
| `entity_type` | VARCHAR(50) | "Order", "Merchant" |
| `entity_id` | UUID | |
| `old_values` | JSONB | До изменения |
| `new_values` | JSONB | После изменения |
| `ip_address` | INET | |
| `user_agent` | TEXT | |
| `metadata` | JSONB | |
| `created_at` | TIMESTAMPTZ | |

**Индексы**:
- `idx_audit_logs_user_id`
- `idx_audit_logs_entity` (composite: entity_type + entity_id)
- `idx_audit_logs_action`
- `idx_audit_logs_created_at`

**Партиционирование**: по `created_at` (по месяцам).

---

## 14. SYSTEM

### Таблица: `settings`
Системные настройки.

| Поле | Тип | Описание |
|------|-----|----------|
| `key` | VARCHAR(100) PK | "default_commission_rate" |
| `value` | JSONB | |
| `description` | TEXT | |
| `category` | VARCHAR(50) | "general", "payment", "delivery" |
| `is_public` | BOOLEAN DEFAULT false | Видно во фронте |
| `updated_at` | TIMESTAMPTZ | |
| `updated_by` | UUID FK → users.id NULL | |

---

### Таблица: `feature_flags`
Feature flags для A/B тестов и постепенного включения функций.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID PK | |
| `name` | VARCHAR(100) UNIQUE | "new_checkout" |
| `description` | TEXT | |
| `is_enabled` | BOOLEAN DEFAULT false | |
| `rollout_percentage` | SMALLINT DEFAULT 0 | 0-100% |
| `target_roles` | TEXT[] | Для каких ролей |
| `target_user_ids` | UUID[] | Конкретные пользователи |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

## Ключевые индексы

### GIN индексы (полнотекстовый поиск)
```sql
-- Поиск по имени и описанию товара
CREATE INDEX idx_products_search ON products
  USING GIN (to_tsvector('russian',
    (name->>'ru') || ' ' || COALESCE(description->>'ru', '')));

CREATE INDEX idx_products_search_uz ON products
  USING GIN (to_tsvector('simple',
    (name->>'uz') || ' ' || COALESCE(description->>'uz', '')));
```

### pg_trgm индексы (нечёткий поиск)
```sql
CREATE EXTENSION pg_trgm;

CREATE INDEX idx_products_oem_trgm ON products USING GIN (oem_number gin_trgm_ops);
CREATE INDEX idx_oem_codes_trgm ON oem_codes USING GIN (oem_number gin_trgm_ops);
CREATE INDEX idx_products_sku_trgm ON products USING GIN (sku gin_trgm_ops);
```

### LTREE для категорий
```sql
CREATE EXTENSION ltree;

CREATE INDEX idx_categories_path_gist ON categories USING GIST (path);
CREATE INDEX idx_categories_path_btree ON categories USING BTREE (path);
```

### GEOGRAPHY для геолокации
```sql
CREATE EXTENSION postgis;

CREATE INDEX idx_couriers_location_gist ON couriers USING GIST (current_location);
CREATE INDEX idx_warehouses_location ON warehouses
  USING GIST (ST_Point(longitude, latitude));
```

### Составные индексы для частых запросов
```sql
-- Поиск товаров в каталоге с фильтром
CREATE INDEX idx_products_category_status_price
  ON products (category_id, status, price)
  WHERE deleted_at IS NULL;

-- Заказы мерчанта по статусу
CREATE INDEX idx_sub_orders_merchant_status_date
  ON order_sub_orders (merchant_id, status, created_at DESC);

-- Активные остатки
CREATE INDEX idx_inventory_active
  ON inventory_balances (merchant_id, product_id)
  WHERE quantity_available > 0;

-- Совместимость по авто
CREATE INDEX idx_compatibility_modification_product
  ON product_compatibility (car_modification_id, product_id);
```

---

## Партиционирование больших таблиц

### Стратегия по дате (Range Partitioning)

```sql
-- Stock movements: партиции по месяцам
CREATE TABLE stock_movements (
  id BIGSERIAL,
  -- ... поля
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (performed_at);

CREATE TABLE stock_movements_2026_01 PARTITION OF stock_movements
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE stock_movements_2026_02 PARTITION OF stock_movements
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- ... автоматизация через pg_partman
```

Партиционируем:
- `stock_movements` — по месяцам
- `orders` — по месяцам (Phase 2)
- `audit_logs` — по месяцам
- `notifications` — по месяцам
- `financial_transactions` — по месяцам

---

## Prisma Schema

Полный файл `schema.prisma` будет создан отдельно в репозитории и содержит:
- ~80 моделей
- Все relations с `onDelete` стратегиями
- Все индексы через `@@index` и `@@unique`
- Enum типы как `enum` в Prisma
- Generated columns где нужно

Пример небольшого фрагмента для понимания структуры — см. файл `prisma-schema-sample.prisma` в репозитории.

---

**Далее**: см. `05-BUSINESS-FLOWS.md` для бизнес-процессов.
