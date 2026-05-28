# 🔐 07. Роли и права доступа

## RBAC + CASL для атрибутивного доступа

В системе используется двухуровневая авторизация:
1. **RBAC** (Role-Based Access Control) — базовые права по ролям
2. **CASL** (Casl Abilities) — атрибутивный доступ (например, мерчант видит только свои заказы)

---

## 📑 Содержание

1. [Все роли системы](#все-роли-системы)
2. [Описание каждой роли](#описание-каждой-роли)
3. [Матрица прав по модулям](#матрица-прав-по-модулям)
4. [CASL правила](#casl-правила)
5. [Реализация в NestJS](#реализация-в-nestjs)

---

## Все роли системы

| Код | Название | Уровень доступа |
|-----|----------|-----------------|
| `CUSTOMER` | Покупатель | Свои данные + публичный каталог |
| `MERCHANT` | Мерчант (владелец) | Все данные своего магазина |
| `MERCHANT_STAFF` | Сотрудник мерчанта | Делегированные права от MERCHANT |
| `ADMIN` | Администратор платформы | Управление контентом, заказами, мерчантами |
| `SUPER_ADMIN` | Главный администратор | Всё + управление настройками, ролями, финансами |
| `WAREHOUSE_WORKER` | Складской работник | Складские операции (приёмка, отбор) |
| `WAREHOUSE_MANAGER` | Менеджер склада | Управление складом + всё что у WORKER |
| `CONTENT_MANAGER` | Контент-менеджер | Карточки товаров, контент, баннеры |
| `COURIER` | Курьер платформы | Свои доставки |
| `FINANCE_MANAGER` | Финансовый менеджер | Выплаты мерчантам, отчёты, комиссии |
| `SUPPORT_AGENT` | Агент поддержки | Просмотр заказов, помощь клиентам (только чтение) |

> **Важно**: один пользователь может иметь несколько ролей. Например, ADMIN может одновременно быть FINANCE_MANAGER. CUSTOMER может стать MERCHANT (зарегистрировал магазин).

---

## Описание каждой роли

### 👤 CUSTOMER (Покупатель)

**Назначение**: обычный покупатель на сайте.

**Может**:
- Просматривать публичный каталог
- Регистрироваться, входить, восстанавливать пароль
- Управлять своим профилем, адресами, гаражом
- Использовать корзину, оформлять заказы
- Просматривать историю своих заказов
- Отслеживать статус доставки
- Оставлять отзывы (только на купленные товары)
- Запрашивать возвраты в течение 14 дней
- Использовать промокоды
- Управлять своим избранным
- Подписываться на уведомления

**НЕ может**:
- Видеть чужие заказы, адреса, профили
- Изменять цены, остатки, статусы заказов
- Управлять каталогом

---

### 🏪 MERCHANT (Мерчант — владелец магазина)

**Назначение**: продавец на платформе. Управляет своим магазином.

**Может (в рамках своего магазина — все данные с `merchant_id = self`)**:
- Управлять своим профилем, документами, договором
- Приглашать и управлять сотрудниками (MERCHANT_STAFF)
- Создавать и редактировать свои товары
- Загружать фото товаров
- Настраивать совместимость с авто
- Просматривать остатки своих товаров
- Создавать приёмки на склад платформы (для TYPE_1)
- Видеть свои заказы и подтверждать их (TYPE_2)
- Управлять отгрузкой (для TYPE_2)
- Видеть свои финансы: баланс, история, комиссии
- Запрашивать вывод средств
- Видеть отчёты и аналитику по своему магазину
- Отвечать на отзывы своих товаров
- Получать уведомления

**НЕ может**:
- Видеть чужих мерчантов, их продажи, балансы
- Изменять системные настройки
- Утверждать собственные документы
- Самостоятельно подтверждать вывод средств
- Изменять статус "верификации" (только админ)

---

### 👨‍💼 MERCHANT_STAFF (Сотрудник мерчанта)

**Назначение**: помощник мерчанта (бухгалтер, менеджер, склад мерчанта Type 2).

**Может** (с делегацией от MERCHANT, настраивается через permissions JSONB):
- Все возможности из MERCHANT — но ограничено по permissions

**Делегируемые права**:
- `products.manage` — управление товарами
- `products.create_only` — только создавать (но не цены)
- `orders.process` — обработка заказов
- `inventory.view` — просмотр остатков
- `inventory.update` — обновление остатков (для Type 2)
- `finance.view` — просмотр финансов
- `analytics.view` — просмотр аналитики
- `staff.manage` — управление сотрудниками (для замов)

**НЕ может (по умолчанию)**:
- Изменять профиль мерчанта
- Запрашивать вывод средств
- Удалять других сотрудников

---

### 🛡️ ADMIN (Администратор платформы)

**Назначение**: оперативное управление платформой.

**Может**:
- Просматривать всех пользователей и мерчантов
- Активировать/блокировать аккаунты
- Утверждать или отклонять регистрацию мерчантов
- Проверять документы мерчантов
- Модерировать товары (APPROVED/REJECTED)
- Управлять каталогом: категории, бренды, атрибуты
- Управлять справочником авто (марки, модели)
- Видеть все заказы, отменять, выставлять на возврат
- Управлять складом: создавать ячейки, зоны
- Управлять CMS: страницы, баннеры, FAQ, блог
- Создавать промокоды
- Видеть аналитику по всей платформе
- Видеть логи аудита
- Управлять уведомлениями (шаблоны)

**НЕ может (без роли SUPER_ADMIN)**:
- Изменять системные настройки и feature flags
- Утверждать выплаты мерчантам (нужна роль FINANCE_MANAGER или SUPER_ADMIN)
- Назначать роли ADMIN другим пользователям
- Удалять данные (только архивировать)

---

### 👑 SUPER_ADMIN (Главный администратор)

**Назначение**: владелец платформы или CTO. Полный контроль.

**Может**:
- Всё что ADMIN +
- Управлять системными настройками
- Управлять feature flags
- Назначать роли ADMIN, SUPER_ADMIN другим
- Удалять данные физически (hard delete)
- Доступ к API ключам и секретам
- Управлять интеграциями (платёжные системы, доставка)
- Финансовые операции включая правила комиссий

**Не должен** использоваться для повседневных задач — обычно операции через ADMIN.

---

### 📦 WAREHOUSE_WORKER (Складской работник)

**Назначение**: физический работник склада.

**Может**:
- Войти в мобильное приложение
- Видеть назначенные задачи
- Брать доступные задачи
- Выполнять приёмку товаров
- Сканировать QR/штрих-коды
- Подтверждать количество товаров
- Размещать товары в ячейки
- Собирать заказы (picking)
- Выполнять контроль качества
- Участвовать в инвентаризации
- Видеть структуру склада (карта зон/стеллажей)

**НЕ может**:
- Изменять данные товаров или мерчантов
- Видеть финансовую информацию
- Утверждать списания

---

### 📦👔 WAREHOUSE_MANAGER (Менеджер склада)

**Назначение**: управляющий складом.

**Может**:
- Всё что WAREHOUSE_WORKER +
- Назначать задачи работникам
- Видеть отчёты по работе склада
- Создавать корректировки остатков (требует согласования)
- Управлять инвентаризациями (запускать)
- Видеть аналитику склада (оборачиваемость, неликвид)
- Утверждать списания товаров (брак)
- Назначать ячейки в аренду мерчантам

**НЕ может**:
- Создавать новые зоны/стеллажи (нужен ADMIN)
- Изменять данные мерчантов

---

### 🎨 CONTENT_MANAGER (Контент-менеджер)

**Назначение**: редактор каталога, заполняет карточки товаров.

**Может**:
- Редактировать любые товары (название, описание, фото)
- Загружать и обрабатывать фото
- Управлять категориями (редактирование)
- Управлять атрибутами товаров
- Управлять справочником авто
- Управлять блогом и страницами CMS
- Создавать баннеры
- Управлять SEO-метаданными
- Заполнять совместимость товаров с авто

**НЕ может**:
- Видеть финансы
- Изменять цены товаров (это право только у мерчанта)
- Видеть личные данные пользователей

---

### 🚴 COURIER (Курьер)

**Назначение**: доставка заказов клиентам.

**Может**:
- Войти в мобильное приложение
- Видеть назначенные ему доставки
- Получать заказы со склада/у мерчанта
- Обновлять статус доставки
- Отправлять GPS-координаты
- Подтверждать получение клиентом (с фото и подписью)
- Отмечать неудачные доставки
- Видеть оптимизированный маршрут

**НЕ может**:
- Видеть стоимость товаров или комиссии
- Изменять данные заказа
- Видеть чужие доставки

---

### 💰 FINANCE_MANAGER (Финансовый менеджер)

**Назначение**: управление выплатами и финансами.

**Может**:
- Видеть все финансы платформы
- Просматривать балансы мерчантов
- Утверждать/отклонять запросы на вывод
- Отмечать выплаты как выполненные (после банк-операции)
- Загружать платёжные поручения
- Управлять правилами комиссий
- Запускать ручное начисление аренды
- Видеть финансовые отчёты
- Выгружать данные для бухгалтерии (1С, Excel)
- Создавать корректировки балансов (с обоснованием)

**НЕ может**:
- Изменять цены товаров или статусы заказов
- Изменять системные настройки

---

### 🎧 SUPPORT_AGENT (Агент поддержки)

**Назначение**: первая линия поддержки клиентов.

**Может (только чтение)**:
- Просматривать заказы клиентов
- Видеть профили клиентов (без чувствительных данных)
- Видеть статусы оплат и доставок
- Просматривать историю чатов (если будет live chat)
- Создавать тикеты эскалации в ADMIN

**НЕ может**:
- Изменять заказы (только эскалация)
- Видеть финансы
- Видеть данные мерчантов

---

## Матрица прав по модулям

| Модуль / Действие | CUSTOMER | MERCHANT | MERCHANT_STAFF | ADMIN | SUPER_ADMIN | WH_WORKER | WH_MANAGER | CONTENT | COURIER | FINANCE | SUPPORT |
|-------------------|----------|----------|----------------|-------|-------------|-----------|------------|---------|---------|---------|---------|
| **Users**         |          |          |                |       |             |           |            |         |         |         |         |
| Просмотр себя | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Просмотр других | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Управление | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Назначение ролей | ❌ | ❌ | ❌ | ⚠️* | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Merchants**     |          |          |                |       |             |           |            |         |         |         |         |
| Регистрация своего | ✅ | — | — | — | — | — | — | — | — | — | — |
| Просмотр своего | — | ✅ | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — |
| Просмотр всех | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Утверждение | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Заморозка/бан | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Products**      |          |          |                |       |             |           |            |         |         |         |         |
| Просмотр публичных | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Создание своих | ❌ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Редакт. своих | ❌ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Редакт. любых | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Модерация | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Удаление | ❌ | ✅* | ❌ | ⚠️ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Catalog (categories, brands, attributes)** |          |          |                |       |             |           |            |         |         |         |         |
| Просмотр | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Управление | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Cars (справочник)** |          |          |                |       |             |           |            |         |         |         |         |
| Просмотр | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Управление | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Orders**        |          |          |                |       |             |           |            |         |         |         |         |
| Создание | ✅ | ❌ | ❌ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Просмотр своих | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅* | ✅* | ❌ | ✅* | ❌ | ✅ |
| Просмотр всех | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Отмена своих | ✅ | ⚠️ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Изменение статуса | ❌ | ⚠️* | ⚠️ | ✅ | ✅ | ⚠️* | ⚠️* | ❌ | ⚠️* | ❌ | ❌ |
| Возврат денег | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Cart**          |          |          |                |       |             |           |            |         |         |         |         |
| Своя корзина | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Inventory**     |          |          |                |       |             |           |            |         |         |         |         |
| Просмотр своих остатков | ❌ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Просмотр всех | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Обновление (Type 2) | ❌ | ✅ | ⚠️ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Корректировка склад. | ❌ | ❌ | ❌ | ⚠️ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Warehouse (склад)** |          |          |                |       |             |           |            |         |         |         |         |
| Складские операции | ❌ | ❌ | ❌ | ⚠️ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Управление зонами/ячейками | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ |
| Назначение ячеек в аренду | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Payments**      |          |          |                |       |             |           |            |         |         |         |         |
| Создание (своя оплата) | ✅ | ❌ | ❌ | ⚠️ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Просмотр своих | ✅ | ✅ | ⚠️ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Просмотр всех | ❌ | ❌ | ❌ | ⚠️ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Refund | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Finance**       |          |          |                |       |             |           |            |         |         |         |         |
| Баланс свой (мерчант) | ❌ | ✅ | ⚠️ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Балансы всех | ❌ | ❌ | ❌ | ⚠️ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Запрос вывода | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Утверждение вывода | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Правила комиссий | ❌ | ❌ | ❌ | ⚠️ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Аренда (cron) | ❌ | ❌ | ❌ | ⚠️ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **CMS**           |          |          |                |       |             |           |            |         |         |         |         |
| Просмотр публичного | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Управление страниц/баннеров | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Промокоды | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ⚠️ | ❌ | ❌ | ❌ |
| **Settings**      |          |          |                |       |             |           |            |         |         |         |         |
| Просмотр публичных | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Управление | ❌ | ❌ | ❌ | ⚠️ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Feature Flags** |          |          |                |       |             |           |            |         |         |         |         |
| Управление | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Audit Logs**    |          |          |                |       |             |           |            |         |         |         |         |
| Просмотр | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ⚠️ |
| **Notifications (шаблоны)** |          |          |                |       |             |           |            |         |         |         |         |
| Управление | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Массовая рассылка | ❌ | ❌ | ❌ | ⚠️ | ✅ | ❌ | ❌ | ⚠️ | ❌ | ❌ | ❌ |

**Легенда**:
- ✅ — полный доступ
- ❌ — нет доступа
- ⚠️ — частичный / условный доступ
- ⚠️* — только в своей зоне ответственности (свои заказы, свои товары)
- ✅* — только связанные данные (например, courier видит только свои доставки)
- — — неприменимо

---

## CASL правила

CASL позволяет описывать **атрибутивный доступ** — например, "пользователь может редактировать заказ, если он его создатель".

### Пример определения abilities

```typescript
// libs/shared/ability/ability.factory.ts
import { AbilityBuilder, Ability } from '@casl/ability';

@Injectable()
export class AbilityFactory {
  defineAbility(user: User): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(Ability);

    if (user.hasRole('SUPER_ADMIN')) {
      can('manage', 'all');
      return build();
    }

    // CUSTOMER
    if (user.hasRole('CUSTOMER')) {
      // Может управлять своим профилем
      can('read', 'User', { id: user.id });
      can('update', 'User', { id: user.id });

      // Может управлять своими адресами
      can('manage', 'UserAddress', { userId: user.id });

      // Может управлять своим гаражом
      can('manage', 'UserGarage', { userId: user.id });

      // Корзина
      can('manage', 'Cart', { userId: user.id });

      // Заказы
      can('create', 'Order');
      can('read', 'Order', { userId: user.id });
      can('cancel', 'Order', { userId: user.id, status: { $in: ['CREATED', 'PAID'] } });

      // Отзывы только на купленные товары
      can('create', 'ProductReview', (review) => {
        return review.isVerifiedPurchase && review.userId === user.id;
      });
    }

    // MERCHANT
    if (user.hasRole('MERCHANT')) {
      const merchantId = user.merchantId;

      // Свои товары
      can('manage', 'Product', { merchantId });
      cannot('moderate', 'Product');

      // Свои заказы (sub-orders)
      can('read', 'OrderSubOrder', { merchantId });
      can('update', 'OrderSubOrder', {
        merchantId,
        status: { $in: ['PAID', 'PROCESSING'] }
      });

      // Свои финансы
      can('read', 'MerchantBalance', { merchantId });
      can('read', 'FinancialTransaction', { merchantId });
      can('create', 'WithdrawalRequest', { merchantId });

      // Свой профиль мерчанта
      can('read', 'Merchant', { id: merchantId });
      can('update', 'Merchant', { id: merchantId });
      cannot('update', 'Merchant', ['verificationStatus', 'commissionRate']);

      // Сотрудники
      can('manage', 'MerchantStaff', { merchantId });
    }

    // MERCHANT_STAFF
    if (user.hasRole('MERCHANT_STAFF')) {
      const merchantId = user.merchantId;
      const permissions = user.merchantStaffPermissions; // JSONB

      if (permissions.products?.manage) {
        can('manage', 'Product', { merchantId });
      } else if (permissions.products?.create_only) {
        can('create', 'Product', { merchantId });
        can('read', 'Product', { merchantId });
      }

      if (permissions.orders?.process) {
        can('read', 'OrderSubOrder', { merchantId });
        can('update', 'OrderSubOrder', { merchantId });
      }

      // и так далее по permissions...
    }

    // ADMIN
    if (user.hasRole('ADMIN')) {
      can('read', 'all');
      can(['update', 'create'], [
        'User', 'Merchant', 'Product', 'Category', 'Brand',
        'CarMake', 'CarModel', 'Banner', 'Page', 'PromoCode',
        'WarehouseZone', 'WarehouseRack', 'WarehouseShelf', 'WarehouseCell',
      ]);
      can('moderate', 'Product');
      can('approve', 'Merchant');
      can('cancel', 'Order');
      cannot('manage', 'Settings');
      cannot('manage', 'FeatureFlag');
      cannot('approve', 'WithdrawalRequest');
    }

    // FINANCE_MANAGER
    if (user.hasRole('FINANCE_MANAGER')) {
      can('read', [
        'MerchantBalance', 'FinancialTransaction',
        'WithdrawalRequest', 'CommissionRule',
        'RentalFee', 'Invoice', 'Payment', 'Refund',
        'Merchant', 'Order',
      ]);
      can(['update', 'approve', 'reject'], 'WithdrawalRequest');
      can('manage', 'CommissionRule');
      can('create', 'Refund');
      can('create', 'FinancialTransaction', { transactionType: 'ADJUSTMENT' });
    }

    // WAREHOUSE_WORKER
    if (user.hasRole('WAREHOUSE_WORKER')) {
      can('read', ['Warehouse', 'WarehouseZone', 'WarehouseCell']);
      can('read', 'StockReceipt');
      can('update', 'StockReceipt', { status: { $in: ['ARRIVED', 'CHECKING', 'PLACING'] } });
      can('create', 'StockMovement');
      can('read', 'InventoryBalance');
      can('read', 'OrderSubOrder', { fulfillmentType: 'FBO' });
      can('update', 'OrderItem', { status: 'RESERVED' }); // pick
    }

    // WAREHOUSE_MANAGER
    if (user.hasRole('WAREHOUSE_MANAGER')) {
      // Всё что worker +
      can('read', 'StockMovement');
      can('create', 'StockMovement', { movement_type: { $in: ['ADJUSTMENT_PLUS', 'ADJUSTMENT_MINUS', 'WRITE_OFF'] } });
      can('manage', 'InventoryAlert');
      can('update', 'WarehouseCell', ['merchant_id', 'monthly_rental_fee']);
    }

    // CONTENT_MANAGER
    if (user.hasRole('CONTENT_MANAGER')) {
      can('manage', ['Category', 'Brand', 'Attribute', 'CarMake', 'CarModel', 'CarGeneration', 'CarModification']);
      can(['read', 'update'], 'Product');
      can('manage', ['Banner', 'Page', 'BlogPost', 'Faq']);
      can('create', 'PromoCode');
    }

    // COURIER
    if (user.hasRole('COURIER')) {
      can('read', 'Shipment', { courierId: user.courierId });
      can('update', 'Shipment', { courierId: user.courierId });
      can('create', 'ShipmentTracking', { shipmentId: { $in: user.assignedShipmentIds } });
    }

    // SUPPORT_AGENT (только чтение)
    if (user.hasRole('SUPPORT_AGENT')) {
      can('read', ['Order', 'User', 'Shipment', 'Payment', 'Return', 'ProductReview']);
      cannot('update', 'all');
    }

    return build();
  }
}
```

---

## Реализация в NestJS

### 1. JWT Strategy

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException();
    return user; // → req.user
  }
}
```

### 2. Roles Guard (RBAC)

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRole[]>('roles', context.getHandler());
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some(role => user.hasRole(role));
  }
}

// Декоратор
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);

// Использование
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminUsersController { ... }
```

### 3. Ability Guard (CASL)

```typescript
@Injectable()
export class AbilityGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private abilityFactory: AbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rules = this.reflector.get<AbilityRule[]>('abilities', context.getHandler());
    if (!rules) return true;

    const { user } = context.switchToHttp().getRequest();
    const ability = this.abilityFactory.defineAbility(user);

    return rules.every(({ action, subject }) => ability.can(action, subject));
  }
}

// Декоратор
export const CheckAbility = (...rules: AbilityRule[]) => SetMetadata('abilities', rules);

// Использование
@Get(':id')
@CheckAbility({ action: 'read', subject: 'Order' })
async getOrder(@Param('id') id: string, @Req() req) {
  const order = await this.ordersService.findById(id);
  const ability = this.abilityFactory.defineAbility(req.user);
  ForbiddenError.from(ability).throwUnlessCan('read', order); // проверка на конкретной сущности
  return order;
}
```

### 4. Query Filter для multi-tenancy

Автоматическое добавление фильтра `merchant_id` к запросам мерчанта:

```typescript
@Injectable()
export class MerchantTenancyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const user = req.user as User;
    if (user?.hasRole('MERCHANT') || user?.hasRole('MERCHANT_STAFF')) {
      req['merchantId'] = user.merchantId;
    }
    next();
  }
}

// В сервисах
async findAllProducts(merchantId: string | undefined) {
  return this.prisma.product.findMany({
    where: merchantId ? { merchantId } : {},
  });
}
```

---

## Стратегия аудита прав

Все попытки несанкционированного доступа логируются:

```typescript
@Catch(ForbiddenException)
export class ForbiddenLoggingFilter implements ExceptionFilter {
  catch(exception: ForbiddenException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    this.auditLogger.warn({
      type: 'ACCESS_DENIED',
      userId: request.user?.id,
      path: request.path,
      method: request.method,
      ip: request.ip,
      timestamp: new Date(),
    });

    response.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied',
      },
    });
  }
}
```

---

**Далее**: см. `08-INTEGRATIONS.md` для деталей интеграций.
