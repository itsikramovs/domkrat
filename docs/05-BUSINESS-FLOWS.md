# 🔄 05. Бизнес-процессы

Подробное описание ключевых бизнес-процессов системы «Домкрат» — со схемами, состояниями и взаимодействиями между модулями.

---

## 📑 Содержание

1. [Регистрация и onboarding](#1-регистрация-и-onboarding)
2. [Жизненный цикл заказа](#2-жизненный-цикл-заказа)
3. [Складской цикл (приёмка → размещение → отгрузка)](#3-складской-цикл)
4. [Сборка заказа (picking)](#4-сборка-заказа-picking)
5. [Возврат товара](#5-возврат-товара)
6. [Финансовый цикл (комиссии, выплаты)](#6-финансовый-цикл)
7. [Управление неликвидом](#7-управление-неликвидом)
8. [Поиск товара по совместимости](#8-поиск-товара-по-совместимости)

---

## 1. Регистрация и onboarding

### 1.1 Регистрация покупателя

```
[Клиент] → Открыл сайт → "Войти/Регистрация"
    ↓
Ввод телефона +998XXXXXXXXX
    ↓
[Система] → SMS-код на телефон (Eskiz/PlayMobile)
    ↓
[Клиент] → Ввод кода
    ↓
[Система] → Создание user (role=CUSTOMER)
    ↓
Авто-вход → выдача JWT + refresh_token
    ↓
Опционально: заполнение профиля
```

**База**:
- `verification_codes` — код хранится 5 мин
- `users` создаётся при первой верификации
- `user_roles` записывается роль `CUSTOMER`
- `refresh_tokens` сохраняется

### 1.2 Регистрация мерчанта

```
[Мерчант] → "Стать продавцом" → merchant.domkrat.uz/register
    ↓
Заполнение формы (юр.информация + контакты)
    ↓
Загрузка документов (св-во о регистрации, паспорт ИП, лицензия)
    ↓
Выбор типа: TYPE_1 (склад платформы) / TYPE_2 (свой склад)
    ↓
[Система] → merchant создан со статусом PENDING
    ↓
[Админ] → проверка документов → APPROVE / REJECT
    ↓
APPROVE → ACTIVE + создание merchant_balance (баланс = 0)
        → отправка договора на подписание
        → активация кабинета мерчанта
REJECT → notification мерчанту с причиной
```

---

## 2. Жизненный цикл заказа

### 2.1 Полная схема жизни заказа

```
                  ┌──────────────────────────────┐
                  │       Корзина клиента        │
                  └──────────────┬───────────────┘
                                 ↓
                        ┌────────────────┐
                        │   CHECKOUT     │
                        │  выбор адреса  │
                        │   доставки     │
                        │   и оплаты     │
                        └────────┬───────┘
                                 ↓
              [CREATED] — резерв товара на 15 мин
                                 ↓
              ┌──────────────────┴──────────────────┐
              │                                     │
       [pay online]                          [COD - наличными]
              │                                     │
              ↓                                     ↓
   redirect → Click/Payme/Uzum                  [CONFIRMED]
              │                                     │
   webhook → success/fail                          
              │                                     │
              ↓                                     │
            [PAID] ←────────────────────────────────┘
              │
              ↓
        Распределение по мерчантам (split into sub-orders)
              │
              ┌─────────────────────┐
              │  По каждому sub-order:
              ↓                     ↓
        [TYPE 1 — FBO]        [TYPE 2 — FBS]
   Задача складу             Уведомление мерчанту
              │                     │
              ↓                     ↓
        [PROCESSING]          [PROCESSING]
        — Picker берёт        — Мерчант собирает
        задачу, идёт по       сам, обновляет статус
        ячейкам с QR-сканером
              │                     │
              ↓                     ↓
        [ASSEMBLED]           [ASSEMBLED]
              │                     │
              ↓                     ↓
        ┌───────────────────────────┴──────────────┐
        │     Передача в доставку                  │
        │  (Self-pickup / Курьер / Yandex / BTS)   │
        └─────────────────┬────────────────────────┘
                          ↓
                    [SHIPPED]
                          ↓
              [OUT_FOR_DELIVERY] (курьер у клиента)
                          ↓
                  ┌───────┴───────┐
                  ↓               ↓
              [DELIVERED]    Клиент отказался
                  ↓               ↓
            ┌─────┴──────┐    [RETURNED]
            ↓            ↓
       Клиент          Клиент
     подтвердил     не отметил
       приёмку     → авто через 7 дней
            │            │
            └────┬───────┘
                 ↓
            [COMPLETED]
                 ↓
       Финансовое закрытие:
       - Зачисление на баланс мерчанта (subtotal - commission)
       - Удержание комиссии платформы
       - Запись в financial_transactions
```

### 2.2 Состояния заказа (State Machine)

```typescript
enum OrderStatus {
  CREATED = 'CREATED',
  PAID = 'PAID',
  PROCESSING = 'PROCESSING',
  ASSEMBLED = 'ASSEMBLED',
  SHIPPED = 'SHIPPED',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUND_REQUESTED = 'REFUND_REQUESTED',
  REFUNDED = 'REFUNDED',
  RETURNED = 'RETURNED',
}

// Разрешённые переходы
const transitions = {
  CREATED: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'REFUND_REQUESTED'],
  PROCESSING: ['ASSEMBLED', 'CANCELLED'],
  ASSEMBLED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'RETURNED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['COMPLETED', 'RETURNED', 'REFUND_REQUESTED'],
  COMPLETED: ['REFUND_REQUESTED'], // в пределах 14 дней
  REFUND_REQUESTED: ['REFUNDED', 'COMPLETED'],
};
```

### 2.3 Триггеры на изменение статуса

| Переход | Триггеры |
|---------|----------|
| `→ CREATED` | Создать `stock_reservation` (15 мин). Отправить SMS клиенту. |
| `→ PAID` | Подтвердить `stock_reservation`. Создать `sub_orders` по мерчантам. Уведомить мерчантов Type 2. Создать задачи на сборку для Type 1. |
| `→ PROCESSING` | Записать `confirmed_at`. Логи в `order_status_history`. |
| `→ ASSEMBLED` | Создать `shipment`. Назначить курьера или передать в Yandex Go API. |
| `→ SHIPPED` | Списать товар со склада (`stock_movement` type=SHIPMENT). |
| `→ DELIVERED` | Запустить таймер 7 дней для авто-completion. |
| `→ COMPLETED` | **Финансовое закрытие**: перевести деньги с pending на available баланс мерчанта. Записать `financial_transaction` (SALE, COMMISSION). |
| `→ CANCELLED` | Снять резерв товара. Если оплачен — инициировать refund. |

---

## 3. Складской цикл

### 3.1 Полный цикл товара на складе платформы (Type 1)

```
┌──────────────────────────────────────────────────────────────┐
│  1. ЗАКУПКА                                                  │
│  Мерчант → создаёт stock_receipt (DRAFT) в своём кабинете    │
│  Указывает: товары, количество, ожидаемая дата               │
│  Status: DRAFT → SUBMITTED                                   │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  2. ОЖИДАНИЕ                                                 │
│  Status: EXPECTED                                            │
│  Складу видна задача "Ожидается приёмка"                     │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  3. ПРИЁМКА                                                  │
│  Кладовщик принимает товар физически                         │
│  Status: ARRIVED                                             │
│  Сверка: ожидалось vs фактически                             │
│  Заполняет `received_quantity` в `stock_receipt_items`       │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  4. КОНТРОЛЬ КАЧЕСТВА (Quality Check)                        │
│  Status: CHECKING                                            │
│  Проверка целостности, комплектности                         │
│  Заполняет `accepted_quantity` (минус брак)                  │
│  Брак → rejected_quantity, причина                           │
│  Status: quality_check_status = PASSED/PARTIAL/FAILED        │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  5. КОНТЕНТ (для новых товаров)                              │
│  Контент-менеджер:                                           │
│  - Делает фото товара                                        │
│  - Пишет описание                                            │
│  - Заполняет характеристики                                  │
│  - Привязывает совместимость с авто                          │
│  - Указывает OEM-номера                                      │
│  Product → status: PENDING_REVIEW → ACTIVE                   │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  6. РАЗМЕЩЕНИЕ (Putaway)                                     │
│  Status: PLACING                                             │
│  Кладовщик размещает товар в ячейки                          │
│  - Сканирует QR ячейки                                       │
│  - Сканирует QR товара                                       │
│  - Указывает количество                                      │
│  Создаются: stock_movements (RECEIPT), inventory_balances    │
│  Если у мерчанта есть арендованные ячейки → туда            │
│  Иначе → автораспределение по свободным ячейкам              │
│  Status: COMPLETED → товар доступен к продаже                │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  7. ХРАНЕНИЕ                                                 │
│  Мониторинг: cron каждый день                                │
│  - oldest_received_at → если >30 дней → alert WARNING        │
│  - >60 дней → CRITICAL                                       │
│  - >90 дней → CRITICAL + автосписание аренды или предложение │
│             вернуть товар мерчанту                           │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  8. ПРОДАЖА — резерв (см. цикл заказа)                       │
│  inventory_balances.quantity_reserved ↑                      │
│  inventory_balances.quantity_available ↓                     │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  9. ОТБОР И ОТГРУЗКА                                         │
│  Picker → собирает по списку (см. раздел 4)                  │
│  stock_movements (SHIPMENT) → списание с inventory_balances  │
│  inventory_balances.quantity_reserved ↓ (→ 0)                │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 FIFO логика

При резервировании товара под заказ — **выбирается партия с самой ранней датой приёмки**.

```sql
-- Pseudo-SQL: выбор партии по FIFO для резерва
SELECT ib.*
FROM inventory_balances ib
WHERE ib.product_id = :product_id
  AND ib.quantity_available >= :needed_qty
ORDER BY ib.oldest_received_at ASC NULLS LAST
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

**Trade-off**: если нужное количество разбросано по нескольким ячейкам — резерв создаётся на несколько ячеек, picker идёт по нескольким локациям.

---

## 4. Сборка заказа (picking)

### 4.1 Складское задание (для Type 1)

После `→ PAID` → создаётся **picking_task** (можно отдельной таблицей или внутри order_sub_orders).

```
[Picker открывает мобильное приложение]
    ↓
"Доступные задания" → выбирает sub_order
    ↓
Список позиций отсортирован по локациям (оптимальный маршрут):
  • A-01-1-05: Тормозные колодки ×2
  • A-02-3-12: Воздушный фильтр ×1
  • B-04-2-08: Свечи зажигания ×4
    ↓
По каждой позиции:
  1. Сканирует QR ячейки
  2. Сканирует QR товара (барcode на упаковке)
  3. Подтверждает количество
    ↓
Если разные мерчанты → пакеты отдельно
    ↓
Передача в зону отгрузки (packing area)
    ↓
Упаковка → QR на коробке = tracking_number
    ↓
Передача курьеру / в пункт выдачи
    ↓
sub_order → ASSEMBLED → SHIPPED
```

### 4.2 Оптимизация маршрута picker'а

Алгоритм:
1. Группируем позиции по `warehouse_zones` (одна зона = один проход)
2. Внутри зоны сортируем по `racks` → `shelves` → `cells`
3. Используем pre-computed координаты ячеек (если есть GPS на складе)

---

## 5. Возврат товара

### 5.1 Флоу возврата

```
[Клиент] (в течение 14 дней после получения)
    ↓
Кабинет покупателя → "Мои заказы" → выбор заказа → "Вернуть"
    ↓
Указывает: позиции, причина, фото/комментарий
    ↓
[Система] → создаёт return со статусом REQUESTED
    ↓
[Админ / Мерчант (для Type 2)] рассматривает заявку
    ↓
APPROVED → клиент получает инструкции:
  - Самопривоз в пункт выдачи
  - Заказ курьера платформы
    ↓
Клиент возвращает → status: IN_TRANSIT → RECEIVED
    ↓
INSPECTING → проверка состояния товара
    ↓
- Товар в идеале → restock в inventory
- Товар б/у → списание (write_off)
    ↓
REFUNDED → возврат денег:
  - Если онлайн оплата → refund через провайдера
  - Если COD → перевод на карту клиента
    ↓
COMPLETED → financial_transactions:
  - Списание с available_balance мерчанта (-)
  - Списание комиссии платформы (-)
  - +refund к клиенту
```

---

## 6. Финансовый цикл

### 6.1 Расчёт комиссии

При **completed** заказе:

```typescript
function calculateCommission(orderItem: OrderItem): Money {
  const rule = getCommissionRule({
    merchantId: orderItem.merchantId,
    categoryId: orderItem.product.categoryId,
    merchantType: orderItem.merchant.type,
  });

  let commission = orderItem.subtotal * (rule.commission_rate / 100);
  commission += rule.fixed_fee;

  return commission;
}
```

**Приоритет правил комиссии**:
1. Индивидуальное правило мерчанта + категории (`merchant_id + category_id`)
2. Индивидуальное правило мерчанта (`merchant_id`)
3. Правило по типу мерчанта + категории
4. Глобальное правило по категории
5. Глобальное правило по умолчанию

### 6.2 Поступление денег мерчанту

```
Заказ COMPLETED
    ↓
Сумма к зачислению = order_item.subtotal - commission_amount
    ↓
financial_transaction (тип: SALE, direction: CREDIT)
    ↓
merchant_balance.pending_balance → available_balance (после 7 дней)
    ↓
financial_transaction (тип: COMMISSION, direction: DEBIT)
    ↓
total_commission_paid += commission_amount
```

**Hold period**: 7 дней после `COMPLETED` (чтобы исключить риск возвратов). После — деньги становятся доступны к выводу.

### 6.3 Запрос вывода средств (Ручной режим)

```
[Мерчант] → кабинет → "Финансы" → "Запросить вывод"
    ↓
Указывает сумму ≤ available_balance
    ↓
Подтверждает банковские реквизиты
    ↓
withdrawal_request создан со статусом PENDING
    ↓
merchant_balance.available_balance ↓ (зарезервировано)
    ↓
[Финансовый менеджер] → видит в админке → проверяет
    ↓
APPROVED → переводит деньги через банк-клиент
    ↓
Заполняет: external_transaction_id, прикрепляет платёжное поручение
    ↓
Status: PROCESSING → COMPLETED
    ↓
financial_transaction (тип: WITHDRAWAL, direction: DEBIT)
    ↓
merchant_balance.total_withdrawn += amount
    ↓
SMS/Email мерчанту: "Выплата произведена"
```

**REJECTED** → деньги возвращаются на available_balance + комментарий админа.

### 6.4 Начисление аренды (для Type 1)

**Cron задача** — 1-го числа каждого месяца:

```typescript
// Для каждой арендованной ячейки
for (const cell of rentedCells) {
  const fee = cell.monthly_rental_fee;

  // Создать rental_fee запись
  await db.rental_fees.create({
    merchant_id: cell.merchant_id,
    cell_id: cell.id,
    period_start: '2026-06-01',
    period_end: '2026-06-30',
    amount: fee,
    status: 'PENDING',
  });

  // Если у мерчанта достаточно баланса — списать сразу
  if (balance >= fee) {
    await createFinancialTransaction({
      type: 'RENTAL_FEE',
      direction: 'DEBIT',
      amount: fee,
      // ...
    });
    rental_fee.status = 'CHARGED';
  } else {
    // Уведомление: "Пополните баланс, иначе товар будет возвращён"
    rental_fee.status = 'OVERDUE';
    sendNotification(merchant, 'RENTAL_OVERDUE');
  }
}
```

---

## 7. Управление неликвидом

### 7.1 Cron задача (ежедневно)

```typescript
// Проверка всех остатков
async function checkStaleStock() {
  const now = new Date();

  const balances = await db.inventory_balances.findMany({
    where: {
      quantity_available: { gt: 0 },
      oldest_received_at: { not: null },
    },
  });

  for (const balance of balances) {
    const daysOnShelf = differenceInDays(now, balance.oldest_received_at);

    if (daysOnShelf >= 30 && daysOnShelf < 60) {
      createAlert(balance, 'STALE_STOCK_30D', 'WARNING');
    } else if (daysOnShelf >= 60 && daysOnShelf < 90) {
      createAlert(balance, 'STALE_STOCK_60D', 'WARNING');
    } else if (daysOnShelf >= 90) {
      createAlert(balance, 'STALE_STOCK_90D', 'CRITICAL');
      // Уведомление мерчанту
      notifyMerchant(balance.merchant_id, {
        template: 'STALE_STOCK_90D',
        data: {
          product_name: balance.product.name,
          days: daysOnShelf,
          options: [
            'Pay rental for next month',
            'Return goods to merchant',
            'Discount the product',
          ],
        },
      });
    }
  }
}
```

### 7.2 Действия мерчанта при неликвиде

В кабинете мерчанта:

```
"Неликвид" таб (товары >90 дней)
    ↓
Для каждого товара:
  - Текущая цена и количество
  - Дни без продаж
  - Накопленная аренда
  ↓
3 действия:
  1. ↓ "Сделать скидку" (-10%, -20%, -30%)
  2. ↺ "Запросить возврат товара"
  3. ✓ "Оплатить аренду" (если денег нет)
```

---

## 8. Поиск товара по совместимости

### 8.1 По марке/модели/году

```
[Покупатель] → "Шины" → фильтр "Подобрать к авто"
    ↓
Выбирает: Toyota → Camry → 2010 → 2.4 AT
    ↓
[Backend] получает car_modification_id
    ↓
SELECT DISTINCT p.* FROM products p
JOIN product_compatibility pc ON pc.product_id = p.id
WHERE p.category_id IN (тут шины и подкатегории)
  AND (
    pc.car_modification_id = :mod_id OR
    pc.car_model_id = :model_id OR
    pc.car_make_id = :make_id
  )
  AND (pc.year_from IS NULL OR pc.year_from <= 2010)
  AND (pc.year_to IS NULL OR pc.year_to >= 2010)
  AND p.status = 'ACTIVE'
ORDER BY p.rating DESC;
```

### 8.2 По VIN-коду

```
[Покупатель] → ввод VIN: JTHBJ46G292XXXXXX
    ↓
[Backend] → запрос к VIN-decoder API (CarVX или аналог)
    ↓
Получено: Toyota Camry 2010, 2.4L, AT, FWD
    ↓
Маппинг на car_modification в нашей БД
    ↓
Сохраняем в user_garage (если авторизован)
    ↓
Дальше — как по марке/модели (см. 8.1)
```

### 8.3 По артикулу / OEM

```
[Покупатель] → ввод "04465-33450"
    ↓
[Backend] → поиск в нескольких полях с pg_trgm для опечаток:
  - products.oem_number
  - products.manufacturer_part_number
  - oem_codes.oem_number
  - products.sku
  - products.barcode
    ↓
Возврат с relevance score:
  1. Точное совпадение OEM → 100%
  2. Аналоги (через oem_codes) → 80%
  3. Похожие по триграммам → 60%+
```

---

## 9. Уведомления (отправка)

### 9.1 События → уведомления

| Событие | Получатель | Каналы | Шаблон |
|---------|------------|--------|--------|
| Заказ создан | Покупатель | SMS, Push | `order_created` |
| Заказ оплачен | Покупатель | SMS, Email | `order_paid` |
| Заказ оплачен | Мерчант | Email, In-app | `merchant_new_order` |
| Заказ собран | Покупатель | SMS | `order_assembled` |
| Курьер выехал | Покупатель | SMS, Push | `out_for_delivery` |
| Заказ доставлен | Покупатель | SMS | `order_delivered` |
| Низкий остаток | Мерчант | Email, In-app | `low_stock` |
| Неликвид 90д | Мерчант | Email, In-app | `stale_stock_critical` |
| Выплата произведена | Мерчант | SMS, Email | `withdrawal_completed` |
| Регистрация | Все | Email | `welcome` |

### 9.2 Очередь уведомлений через BullMQ

```typescript
// При событии
eventEmitter.emit('order.paid', { orderId });

// Listener
@OnEvent('order.paid')
async handleOrderPaid(event: OrderPaidEvent) {
  await this.notificationQueue.add('send_notification', {
    userId: event.order.userId,
    templateCode: 'order_paid',
    channel: ['sms', 'email'],
    data: { order: event.order },
  });
}

// Worker
@Processor('notifications')
async sendNotification(job) {
  const { userId, templateCode, channel, data } = job.data;
  const user = await this.usersService.findById(userId);
  const template = await this.templatesService.findByCode(templateCode);

  for (const ch of channel) {
    if (!user.preferences.isEnabled(templateCode, ch)) continue;
    await this.channels[ch].send(user, template, data);
  }
}
```

---

**Далее**: см. `06-API-SPECIFICATION.md` для REST API endpoints.
