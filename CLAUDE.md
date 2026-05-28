# CLAUDE.md — Контекст для Claude Code

> **Этот файл читается Claude Code автоматически при работе с проектом.**
> Он содержит критичные правила, конвенции и контекст для AI-разработки.

> 🤝 **В новой сессии прочитай [`docs/CLAUDE-HANDOFF.md`](docs/CLAUDE-HANDOFF.md)** —
> там актуальный статус проекта, что готово, что нет, и приоритезированный план следующих задач.

---

## 🔒 ИНФРАСТРУКТУРА (зафиксировано)

- **Сервер**: домашний, Ubuntu 24.04, Intel i5-6400, 8GB RAM, 256GB SSD
- **Локальный IP**: 192.168.1.8 (за NAT, серый IP)
- **Пользователь**: samandar
- **Путь проекта**: `/var/www/domkrat`
- **Доступ разработчика**: VS Code Remote-SSH с Windows
- **Где работает Claude Code**: ПРЯМО НА СЕРВЕРЕ (команда `claude`)
- **Публичный доступ**: Cloudflare Tunnel (когда будет домен; сейчас домена нет)
- **HTTPS**: через Cloudflare Tunnel — НЕ настраивать Nginx+SSL/certbot

### КРИТИЧНО для работы:

1. **Все приложения слушают `0.0.0.0`** (не localhost!) — чтобы разработчик открывал с Windows по `http://192.168.1.8:ПОРТ`. Например: `app.listen(3001, '0.0.0.0')`.
2. **CORS** должен включать `http://192.168.1.8:3000/3002/3003` и localhost-варианты.
3. **Frontend env**: API URL пока `http://192.168.1.8:3001/api` (позже сменится на домен).
4. **Swap 4GB** настроен (важно для 8GB RAM при сборках).
5. **Окружение уже подготовлено**: Docker, Docker Compose, Node 20, pnpm, git, swap, UFW — установлены вручную. НЕ переустанавливать без необходимости.

### Порты:

web 3000, api 3001, merchant 3002, admin 3003, mailhog 8025, minio 9000/9001, meilisearch 7700, prisma studio 5555.

### Пароли dev (docker-compose.dev.yml):

postgres `domkrat`/`domkrat_dev_pass` (db: domkrat_dev), redis `redis_dev_pass`, minio `minioadmin`/`minioadmin_dev`, meili `meili_dev_key`.

### MVP-подход (работает без внешних API):

- **Auth**: email + пароль, подтверждение через MailHog (НЕ SMS)
- **SMS**: mock-провайдер (Eskiz позже через .env)
- **Email**: nodemailer → MailHog (реальный SMTP позже)
- **Платежи**: MockPaymentProvider (авто-успех) + COD; Click/Payme/Uzum — классы-заглушки с TODO
- Все провайдеры подключаются позже сменой `.env` (SMS_PROVIDER, PAYMENT_PROVIDERS) без переписывания кода

---

## 🎯 О проекте

**Домкрат** — маркетплейс автотоваров и запчастей для Узбекистана.

- **Backend**: NestJS 10 (Node.js 20 + TypeScript) + Prisma + PostgreSQL 16
- **Frontend**: Next.js 14 (App Router) + Tailwind + shadcn/ui
- **Кэш/очереди**: Redis 7 + BullMQ
- **Поиск**: Meilisearch
- **Файлы**: MinIO (S3-совместимое)
- **Языки UI**: Русский (default) + Узбекский
- **Платежи**: Click, Payme, Uzum, COD

Полная документация — в папке `docs/`:

- `docs/01-PROJECT-OVERVIEW.md` — обзор
- `docs/03-ARCHITECTURE.md` — архитектура
- `docs/04-DATABASE-SCHEMA.md` + `PART2.md` — схема БД
- `docs/05-BUSINESS-FLOWS.md` — бизнес-процессы
- `docs/06-API-SPECIFICATION.md` — API endpoints
- `docs/07-ROLES-PERMISSIONS.md` — права доступа

---

## 🚨 Критические правила (ВСЕГДА следовать)

### 1. Безопасность

❌ **НИКОГДА**:

- Не коммитить секреты в Git (`.env`, API keys, пароли)
- Не использовать `eval()`, `exec()`, `Function()` с пользовательским вводом
- Не делать `SELECT * FROM users WHERE id = '${userId}'` (SQL injection)
- Не возвращать `password_hash`, токены в API responses
- Не доверять `req.body` без валидации
- Не использовать `any` в TypeScript (только если ОЧЕНЬ обоснованно)

✅ **ВСЕГДА**:

- Использовать Prisma queries (параметризованные)
- Валидировать DTO через `class-validator`
- Хэшировать пароли через **argon2** (НЕ bcrypt)
- Использовать `@Sensitive()` декоратор для скрытия полей
- Проверять права через CASL перед операцией

### 2. Деньги

❌ **НИКОГДА**:

- Не использовать `number` для денежных сумм
- Не делать `price * 1.12` (НДС) — потеря точности

✅ **ВСЕГДА**:

- Использовать `Decimal` из Prisma (`DECIMAL(15,2)`)
- Использовать библиотеку `decimal.js` для вычислений
- Хранить суммы в одной валюте (UZS = сумы)
- Payme — суммы в **тийинах** (×100), внимание!

```typescript
// ❌ ПЛОХО
const total = price * quantity + price * quantity * 0.12;

// ✅ ХОРОШО
import { Decimal } from 'decimal.js';
const subtotal = new Decimal(price).times(quantity);
const vat = subtotal.times(0.12);
const total = subtotal.plus(vat);
```

### 3. Многоязычность

Все пользовательские тексты — JSONB с ключами `ru` и `uz`:

```typescript
// ❌ ПЛОХО
name: string;

// ✅ ХОРОШО
name: {
  ru: string;
  uz: string;
}
```

### 4. Multi-tenancy (мерчанты)

Любой запрос данных мерчанта **ОБЯЗАТЕЛЬНО** фильтруется по `merchant_id`:

```typescript
// ❌ КАТАСТРОФА (мерчант увидит ВСЕ заказы)
async getMyOrders() {
  return this.prisma.order.findMany();
}

// ✅ ХОРОШО
async getMyOrders(merchantId: string) {
  return this.prisma.order.findMany({
    where: { sub_orders: { some: { merchant_id: merchantId } } }
  });
}
```

### 5. Авторизация

Каждый endpoint **должен** иметь:

- `@UseGuards(JwtAuthGuard)` — проверка авторизации
- `@Roles(...)` или `@CheckAbility(...)` — проверка прав
- Декоратор Swagger для документации

```typescript
@Post('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER')
@ApiOperation({ summary: 'Create new order' })
async createOrder(@Body() dto: CreateOrderDto, @CurrentUser() user: User) {
  return this.ordersService.create(dto, user.id);
}
```

### 6. Идемпотентность

Все мутирующие endpoints (`POST`, `PATCH`, `DELETE`) поддерживают `Idempotency-Key` header.

---

## 📐 Конвенции кода

### Naming

| Что                  | Стиль                           | Пример                                   |
| -------------------- | ------------------------------- | ---------------------------------------- |
| Файлы                | kebab-case                      | `user-roles.service.ts`                  |
| Папки                | kebab-case                      | `order-items/`                           |
| Классы               | PascalCase                      | `OrdersService`                          |
| Интерфейсы           | PascalCase + `I` префикс ❌ НЕТ | `OrderRepository`, не `IOrderRepository` |
| Типы (DTO)           | PascalCase + суффикс            | `CreateOrderDto`, `OrderResponse`        |
| Переменные / функции | camelCase                       | `getUserById`, `totalAmount`             |
| Константы            | SCREAMING_SNAKE                 | `MAX_CART_ITEMS = 100`                   |
| Enum значения        | SCREAMING_SNAKE                 | `OrderStatus.PAID`                       |
| БД таблицы           | snake_case, plural              | `order_items`                            |
| БД колонки           | snake_case                      | `created_at`                             |
| API URL              | kebab-case                      | `/order-items`                           |
| API JSON поля        | camelCase                       | `{ createdAt: ... }`                     |

### Структура модуля NestJS

Каждый бизнес-модуль (например, `orders`) имеет такую структуру:

```
apps/api/src/modules/orders/
├── orders.module.ts          # @Module() — главный
├── controllers/
│   ├── orders.controller.ts        # REST для CUSTOMER
│   ├── merchant-orders.controller.ts  # REST для MERCHANT
│   └── admin-orders.controller.ts     # REST для ADMIN
├── services/
│   ├── orders.service.ts            # основная бизнес-логика
│   ├── order-status.service.ts      # state machine
│   └── order-pricing.service.ts     # расчёт стоимости
├── repositories/
│   └── orders.repository.ts         # обёртка над Prisma
├── dto/
│   ├── create-order.dto.ts
│   ├── update-order.dto.ts
│   └── order-response.dto.ts
├── events/
│   ├── order-created.event.ts
│   ├── order-paid.event.ts
│   └── order-cancelled.event.ts
├── listeners/
│   └── order.listener.ts            # @OnEvent('order.created')
├── guards/
│   └── order-ownership.guard.ts     # доступ к своему заказу
└── tests/
    ├── orders.service.spec.ts
    └── orders.controller.e2e-spec.ts
```

### Принципы кода

1. **Single Responsibility** — один класс = одна ответственность
2. **DRY** — не повторяться, выносить в shared/
3. **Fail fast** — валидация на входе, throw ASAP
4. **Никаких magic strings** — используем enum / const
5. **JSDoc** для публичных методов сервисов (для autocomplete)
6. **Никаких `console.log`** в production коде — только `Logger`
7. **Async/await**, не `.then().catch()`
8. **Один `await` на строку** — для читаемости стектрейсов
9. **Early return** вместо вложенных `if`

### Структура файла Service

```typescript
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  /**
   * Create a new order from cart items.
   * @throws {NotFoundException} if cart is empty
   * @throws {ConflictException} if items are out of stock
   */
  async create(dto: CreateOrderDto, userId: string): Promise<OrderResponse> {
    this.logger.log(`Creating order for user ${userId}`);

    // 1. Validation
    const cart = await this.getCartOrFail(userId);

    // 2. Business logic
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({ ... });
      await this.inventoryService.reserve(order.items, tx);

      // 3. Side effects
      this.eventEmitter.emit('order.created', new OrderCreatedEvent(order));

      return this.toResponse(order);
    });
  }

  private toResponse(order: Order): OrderResponse {
    return { /* mapping */ };
  }

  private async getCartOrFail(userId: string): Promise<Cart> {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart || cart.items.length === 0) {
      throw new NotFoundException('Cart is empty');
    }
    return cart;
  }
}
```

---

## 🧪 Правила тестирования

**Каждый PR должен включать тесты**. Это часть Definition of Done.

### Что тестируем

| Слой           | Тип                 | Coverage           |
| -------------- | ------------------- | ------------------ |
| Services       | Unit tests          | 80%+               |
| Controllers    | Integration tests   | критичные сценарии |
| Repositories   | Через service tests | —                  |
| Critical flows | E2E tests           | обязательно        |

### Что MUST_HAVE покрыть тестами

- ✅ Создание заказа (полный флоу)
- ✅ Расчёт стоимости с НДС и скидкой
- ✅ Резервирование товара (race condition)
- ✅ Изменение статусов (state machine)
- ✅ Платежи (mock провайдера)
- ✅ Возврат товара
- ✅ Расчёт комиссии
- ✅ Все CASL правила (попытки несанкционированного доступа)
- ✅ Multi-tenancy (мерчант не видит чужие данные)

### Пример unit-теста

```typescript
describe('OrdersService.create', () => {
  let service: OrdersService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: mockDeep<PrismaService>() }],
    }).compile();

    service = module.get(OrdersService);
    prisma = module.get(PrismaService);
  });

  it('should throw if cart is empty', async () => {
    prisma.cart.findUnique.mockResolvedValue(null);

    await expect(service.create(dto, 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('should calculate VAT correctly', async () => {
    // ...
    const order = await service.create({ items: [{ price: 100000, qty: 2 }] }, 'user-1');

    expect(order.subtotal).toBe('200000.00');
    expect(order.vatAmount).toBe('24000.00');
    expect(order.totalAmount).toBe('224000.00');
  });
});
```

---

## 📋 Перед каждым коммитом

Запустить:

```bash
pnpm lint                # ESLint
pnpm type-check          # TypeScript
pnpm test                # Unit tests
pnpm test:e2e:affected   # E2E (только затронутые)
pnpm prisma format       # Форматирование schema.prisma
```

Все должны пройти. Иначе — **не коммитить**.

### Pre-commit hook (Husky)

Уже настроен — запускается автоматически:

```
.husky/pre-commit:
  pnpm lint-staged
  pnpm type-check
```

---

## 🚀 Git workflow

### Branch naming

- `feature/DKR-123-create-orders-module`
- `fix/DKR-456-payment-webhook-bug`
- `refactor/DKR-789-extract-pricing-service`
- `docs/DKR-101-api-swagger`

### Commit messages — Conventional Commits

```
feat(orders): add order creation flow
fix(payments): handle Payme webhook duplicate
docs(readme): update installation steps
refactor(catalog): extract product variant logic
test(orders): add unit tests for OrdersService
chore(deps): bump nestjs to 10.3.0
```

### Pull Request чеклист

В описании PR:

- [ ] Связан с задачей: `DKR-123`
- [ ] Все тесты проходят локально
- [ ] Покрытие тестами не упало
- [ ] Документация обновлена (если нужно)
- [ ] Миграция БД создана (если нужно)
- [ ] Нет TODO без задачи в трекере
- [ ] Скриншоты UI (если фронт)
- [ ] Что-то ломаемое? — указать в `BREAKING CHANGES`

---

## 🗃️ Работа с БД

### Миграции

❌ **НИКОГДА**:

- Не редактировать существующую миграцию (только создавать новую)
- Не делать `db push` в production-БД
- Не удалять колонки без deprecation периода

✅ **ВСЕГДА**:

- Создавать миграции через `pnpm prisma migrate dev --name descriptive_name`
- Тестировать миграцию на копии prod-данных
- Писать обратимые миграции где возможно
- Для больших данных — миграции в job (BullMQ), не в migration файле

### Транзакции

Используем для **многошаговых** изменений данных:

```typescript
// ✅ ХОРОШО
await this.prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data: { ... } });
  await tx.stockMovement.create({ data: { ... } });
  await tx.merchantBalance.update({ where: { ... }, data: { ... } });
});
```

### N+1 предотвращение

❌ **ПЛОХО**:

```typescript
const orders = await prisma.order.findMany();
for (const order of orders) {
  const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
  // N+1!
}
```

✅ **ХОРОШО**:

```typescript
const orders = await prisma.order.findMany({
  include: { items: true },
});
```

---

## 🌐 Локализация

### Backend ответы

Возвращаем мультиязычные поля как есть:

```json
{
  "name": { "ru": "Тормозные колодки", "uz": "Tormoz kolodkalari" }
}
```

Фронт сам выбирает язык на основе `Accept-Language` или настроек пользователя.

### Системные сообщения (ошибки, шаблоны SMS/email)

Через `nestjs-i18n`:

```typescript
throw new BadRequestException(this.i18n.t('errors.insufficient_stock', { lang: 'ru' }));
```

Файлы переводов: `apps/api/src/i18n/{ru,uz}/`.

---

## 🔐 Работа с secrets

### Локально

`.env` файл — **не коммитим** (в `.gitignore`).

```env
DATABASE_URL=postgresql://...
REDIS_PASSWORD=...
JWT_SECRET=...
CLICK_SECRET_KEY=...
```

### Production

Secrets через **Vault** или **K8s Secrets** — никогда не в коде.

В коде использовать `@nestjs/config`:

```typescript
constructor(private configService: ConfigService) {
  const secret = this.configService.get<string>('JWT_SECRET');
}
```

---

## 📦 Зависимости

### Добавление новой библиотеки

Перед добавлением:

1. Проверить, нет ли уже похожей в проекте
2. Проверить активность на npm (downloads, last update)
3. Проверить уязвимости: `pnpm audit`
4. Проверить size: https://bundlephobia.com (для frontend)

### Версии

- **Major upgrades** только через PR с обоснованием
- **Patch / Minor** — Renovate / Dependabot автоматически

---

## ⚠️ Что НЕ делать (антипаттерны)

### 1. Прямой доступ к Prisma в Controllers

❌ Controller вызывает `this.prisma.user.findMany()`
✅ Controller → Service → Repository → Prisma

### 2. Бизнес-логика в Controllers

❌ Условия, расчёты, циклы в controllers
✅ Controllers — только парсинг request → вызов service → return response

### 3. Циклические зависимости между модулями

❌ `OrdersModule` импортирует `PaymentsModule`, который импортирует `OrdersModule`
✅ Через события (`EventEmitter`)

### 4. Хардкод URL-ов и значений

❌ `axios.get('https://api.click.uz/...')`
✅ `axios.get(this.configService.get('CLICK_API_URL'))`

### 5. Скрытые сайд-эффекты

❌ Метод `getOrder()` обновляет статус
✅ Метод `getOrder()` — чистый getter, обновление в `updateOrderStatus()`

### 6. Слишком большие методы

❌ Метод на 200 строк
✅ Разбить на private методы, каждый — 10-30 строк

### 7. Глобальные изменения без миграций

❌ Изменить тип колонки в `schema.prisma` без миграции
✅ `pnpm prisma migrate dev --name change_column_type`

---

## 🎨 Frontend конвенции (Next.js)

### Server vs Client Components

**По умолчанию — Server Component**. Client только когда нужно:

- Хуки (`useState`, `useEffect`)
- Браузерные API (`window`, `localStorage`)
- Event handlers (`onClick`, `onChange`)

```tsx
// ✅ Server Component (default)
export default async function ProductsPage() {
  const products = await fetchProducts(); // прямой await
  return <ProductsList products={products} />;
}

// ✅ Client Component (только когда нужен)
('use client');
export function AddToCartButton({ productId }: Props) {
  const [loading, setLoading] = useState(false);
  // ...
}
```

### State management

- **Локальный**: `useState`
- **Серверный кэш**: TanStack Query
- **Глобальный клиентский**: Zustand (только для UI-state: theme, cart preview)
- **НЕ использовать Redux** в этом проекте

### Стилизация

- **Tailwind utility classes** — primary
- **CSS modules** — для сложных кейсов (анимации)
- **НЕ использовать**: inline styles (кроме динамических значений), styled-components

### Формы

`react-hook-form` + `zod` для валидации:

```tsx
const schema = z.object({
  phone: z.string().regex(/^\+998\d{9}$/),
  password: z.string().min(8),
});

const {
  register,
  handleSubmit,
  formState: { errors },
} = useForm({
  resolver: zodResolver(schema),
});
```

---

## 🤖 Специальные инструкции для Claude Code

### При получении задачи

1. **Прочитай связанные docs** (`docs/03-ARCHITECTURE.md`, `docs/04-DATABASE-SCHEMA.md`, и т.д.)
2. **Изучи существующий код** похожих модулей перед началом
3. **План перед написанием кода** — кратко описать что будешь делать
4. **Маленькие коммиты** — лучше 5 маленьких PR, чем 1 огромный

### При сомнениях — спросить

Не пиши код, если непонятно:

- Что должно произойти при граничных случаях
- Какие права нужны для endpoint
- Что считать ошибкой / валидным состоянием
- Должно ли это быть синхронным или асинхронным
- Какие события должны эмититься

### Структурированный ответ

При выполнении задачи отчёт:

```
## Что сделано
- ...

## Какие файлы изменены
- ...

## Тесты
- ...

## Следующие шаги (если есть)
- ...

## Открытые вопросы
- ...
```

### Если что-то выглядит подозрительно — сообщи

Например:

- "Замечу, что в требованиях написано X, но это противоречит существующей логике в Y. Уточни?"
- "Здесь возможен race condition при одновременных заказах — добавить Redis lock?"
- "Это поле не индексировано, при таблице >100k записей будет медленно. Создать индекс?"

### Использование инструментов

- **Tests** — запускай после каждой существенной правки
- **Linter** — запускай перед окончанием задачи
- **TypeScript** — проверяй типы постоянно
- **Prisma Studio** — для проверки структуры БД

---

## 📚 Ссылки на полезные ресурсы

- [NestJS Docs](https://docs.nestjs.com)
- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [BullMQ Docs](https://docs.bullmq.io)
- [Meilisearch Docs](https://docs.meilisearch.com)
- Внутренняя документация: `docs/`

---

## ⚡ Quick commands

```bash
# Запуск разработки
pnpm dev                                    # все приложения
pnpm --filter api dev                       # только API
pnpm --filter web dev                       # только web

# База данных
pnpm --filter api prisma migrate dev        # новая миграция
pnpm --filter api prisma generate           # сгенерить клиент
pnpm --filter api prisma studio             # GUI БД
pnpm --filter api prisma db seed            # тестовые данные

# Тесты
pnpm test                                   # все unit
pnpm test:e2e                               # все e2e
pnpm test:watch                             # watch mode
pnpm test:cov                               # с coverage

# Линт
pnpm lint                                   # проверка
pnpm lint:fix                               # авто-фикс

# Билд
pnpm build                                  # все приложения
pnpm --filter api build                     # только API

# Docker (для зависимостей)
docker-compose -f docker-compose.dev.yml up -d
docker-compose -f docker-compose.dev.yml logs -f postgres
docker-compose -f docker-compose.dev.yml down
```

---

**Этот файл — живой документ. При появлении новых правил/конвенций — обновляй его.**
