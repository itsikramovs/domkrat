# 🔗 08. Интеграции

Внешние сервисы, с которыми интегрируется платформа «Домкрат».

---

## 📑 Содержание

1. [Платёжные системы](#платёжные-системы)
2. [SMS-провайдеры](#sms-провайдеры)
3. [Доставка](#доставка)
4. [VIN-декодер](#vin-декодер)
5. [Карты и геокодинг](#карты-и-геокодинг)
6. [Email](#email)
7. [Push-уведомления](#push-уведомления)
8. [Аналитика](#аналитика)
9. [Безопасность интеграций](#безопасность-интеграций)

---

## Платёжные системы

### Архитектура

Используется паттерн **Provider Adapter** — общий интерфейс с реализациями для каждого провайдера.

```typescript
// Общий интерфейс
export interface PaymentProvider {
  initiate(params: InitiatePaymentParams): Promise<PaymentInitiationResult>;
  verify(transactionId: string): Promise<PaymentStatus>;
  refund(transactionId: string, amount: number): Promise<RefundResult>;
  handleWebhook(payload: any, signature: string): Promise<WebhookResult>;
}

// Реализации
export class ClickProvider implements PaymentProvider { ... }
export class PaymeProvider implements PaymentProvider { ... }
export class UzumProvider implements PaymentProvider { ... }
```

### 1. Click (click.uz)

**Документация**: https://docs.click.uz

**Используем**: Click Pass API (новый стандарт)

#### Настройки
```env
CLICK_SERVICE_ID=12345
CLICK_MERCHANT_ID=12345
CLICK_SECRET_KEY=secret
CLICK_API_URL=https://api.click.uz/v2
```

#### Флоу оплаты
```
1. [Пользователь] выбирает Click → POST /api/orders/:id/payment {provider:'click'}
2. [Backend] создаёт payment запись, генерирует подпись
3. [Backend] возвращает redirect URL:
   https://my.click.uz/services/pay?service_id=...&merchant_id=...&amount=...&transaction_param=ORDER_ID&return_url=...
4. [Пользователь] → редирект на Click
5. [Пользователь] вводит карту, OTP, оплачивает
6. [Click] → отправляет 2 webhook'а на наш backend:
   - PREPARE: проверка возможности оплаты
   - COMPLETE: подтверждение успешной оплаты
7. [Backend] обрабатывает webhook, обновляет payment.status и order.status
8. [Click] → редирект пользователя на наш return_url
9. [Backend] показывает страницу успеха
```

#### Webhook PREPARE
```
POST /webhooks/click/prepare

Click отправляет:
- click_trans_id
- service_id
- click_paydoc_id
- merchant_trans_id (наш order_id)
- amount
- action (0 = prepare)
- sign_time
- sign_string (HMAC проверка)

Мы должны вернуть:
{
  "click_trans_id": "...",
  "merchant_trans_id": "...",
  "merchant_prepare_id": "...", // наш ID
  "error": 0,
  "error_note": "Success"
}
```

#### Webhook COMPLETE
```
POST /webhooks/click/complete

Click отправляет аналогично, но action=1
Мы переводим payment в PAID, order в PAID
```

#### Проверка подписи
```typescript
const sign = md5(
  click_trans_id + service_id + secret_key +
  merchant_trans_id + amount + action + sign_time
);
if (sign !== sign_string) throw new ForbiddenException();
```

---

### 2. Payme (payme.uz)

**Документация**: https://developer.help.paycom.uz

**Используем**: Merchant API (JSON-RPC)

#### Настройки
```env
PAYME_MERCHANT_ID=...
PAYME_SECRET_KEY=...
PAYME_API_URL=https://checkout.paycom.uz/api
```

#### Особенности
Payme работает **обратно**: пользователь сначала уходит на checkout с параметрами, а Payme затем дёргает наш API через JSON-RPC.

#### Endpoint от Payme
```
POST /webhooks/payme/notify

Тело: JSON-RPC запрос
Methods:
- CheckPerformTransaction
- CreateTransaction
- PerformTransaction
- CancelTransaction
- CheckTransaction
- GetStatement
```

#### Реализация methods
```typescript
@Post('webhooks/payme/notify')
async paymeNotify(@Body() body, @Headers('authorization') auth) {
  // Проверка Basic Auth
  const decoded = Buffer.from(auth.split(' ')[1], 'base64').toString();
  const [login, password] = decoded.split(':');
  if (password !== process.env.PAYME_SECRET_KEY) throw new ForbiddenException();

  switch (body.method) {
    case 'CheckPerformTransaction':
      return this.payme.checkPerformTransaction(body.params, body.id);
    case 'CreateTransaction':
      return this.payme.createTransaction(body.params, body.id);
    case 'PerformTransaction':
      return this.payme.performTransaction(body.params, body.id);
    case 'CancelTransaction':
      return this.payme.cancelTransaction(body.params, body.id);
    case 'CheckTransaction':
      return this.payme.checkTransaction(body.params, body.id);
    case 'GetStatement':
      return this.payme.getStatement(body.params, body.id);
  }
}
```

#### Создание ссылки на оплату
```
https://checkout.paycom.uz/{base64({m:merchant_id;ac.order_id:ORDER_ID;a:AMOUNT_IN_TIYIN;l:ru;c:return_url})}
```

> **Важно**: суммы в Payme **в тийинах** (1 сум = 100 тийинов).

---

### 3. Uzum Bank / Apelsin

**Документация**: https://docs.apelsin.uz (Apelsin) или https://developer.uzumbank.uz

#### Настройки
```env
UZUM_API_KEY=...
UZUM_SECRET=...
UZUM_TERMINAL_ID=...
UZUM_API_URL=https://api.apelsin.uz/api/v1
```

#### Флоу аналогичен Click
- Создание счёта через API
- Redirect на платёжную страницу
- Webhook о завершении
- Проверка подписи

---

### 4. COD (Cash on Delivery)

**Не требует интеграции** — статус сразу `PROCESSING`, оплата собирается курьером при доставке.

Backend:
```typescript
if (paymentMethod === 'COD') {
  await this.ordersService.updateStatus(orderId, 'CONFIRMED');
  // Оплата подтвердится при доставке вручную курьером
}
```

При успешной доставке курьер в мобильном приложении нажимает "Оплачено" → payment.status = PAID.

---

### Общая обработка платежей

```typescript
@Injectable()
export class PaymentsService {
  constructor(
    private clickProvider: ClickProvider,
    private paymeProvider: PaymeProvider,
    private uzumProvider: UzumProvider,
  ) {}

  getProvider(method: PaymentMethod): PaymentProvider {
    switch (method) {
      case 'CLICK': return this.clickProvider;
      case 'PAYME': return this.paymeProvider;
      case 'UZUM': return this.uzumProvider;
      default: throw new BadRequestException();
    }
  }

  async initiatePayment(orderId: string, method: PaymentMethod) {
    const order = await this.ordersService.findById(orderId);
    const provider = this.getProvider(method);

    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        userId: order.userId,
        amount: order.totalAmount,
        paymentMethod: method,
        status: 'INITIATED',
      },
    });

    const result = await provider.initiate({
      paymentId: payment.id,
      amount: order.totalAmount,
      orderId,
      description: `Оплата заказа ${order.orderNumber}`,
      returnUrl: `${process.env.APP_URL}/orders/${orderId}/payment-result`,
    });

    return { paymentUrl: result.url, paymentId: payment.id };
  }
}
```

---

## SMS-провайдеры

### 1. Eskiz.uz (основной)

**Документация**: https://documenter.getpostman.com/view/663428/RzfmES4z

#### Настройки
```env
ESKIZ_EMAIL=...
ESKIZ_PASSWORD=...
ESKIZ_API_URL=https://notify.eskiz.uz/api
ESKIZ_SENDER=4546
```

#### Получение токена (1 раз, потом обновляем)
```http
POST /auth/login
Body: { email, password }
Response: { data: { token } }
```

Токен живёт ~30 дней — обновляем через cron.

#### Отправка SMS
```typescript
async sendSms(phone: string, message: string) {
  return axios.post(`${this.apiUrl}/message/sms/send`, {
    mobile_phone: phone.replace('+', ''), // 998901234567
    message,
    from: this.sender,
  }, {
    headers: { Authorization: `Bearer ${this.token}` },
  });
}
```

#### Шаблоны
Eskiz требует **одобренные шаблоны** для рассылки. Заранее регистрируем:
- "Domkrat: код подтверждения {code}. Не сообщайте никому."
- "Domkrat: заказ #{order_number} оплачен. Спасибо!"
- "Domkrat: заказ #{order_number} собран и передан в доставку."
- "Domkrat: заказ #{order_number} доставлен. Подтвердите получение в приложении."

### 2. PlayMobile.uz (резервный)

При сбое Eskiz — переключаемся на PlayMobile через circuit breaker.

```typescript
@Injectable()
export class SmsService {
  constructor(
    private eskiz: EskizProvider,
    private playMobile: PlayMobileProvider,
  ) {}

  async send(phone: string, message: string) {
    try {
      return await this.eskiz.send(phone, message);
    } catch (e) {
      this.logger.warn('Eskiz failed, falling back to PlayMobile');
      return await this.playMobile.send(phone, message);
    }
  }
}
```

---

## Доставка

### 1. Yandex Go (доставка)

**Документация**: https://yandex.ru/dev/logistics/api/

**API**: Yandex Cargo Claims API

#### Настройки
```env
YANDEX_GO_TOKEN=...
YANDEX_GO_API_URL=https://b2b.taxi.yandex.net/b2b/cargo/integration/v2
```

#### Создание заявки
```typescript
async createClaim(order: Order, sender: Address, recipient: Address) {
  const response = await axios.post(`${this.apiUrl}/claims/create`, {
    items: [{
      title: `Заказ ${order.orderNumber}`,
      cost_value: order.totalAmount.toString(),
      cost_currency: 'UZS',
      quantity: 1,
      weight: order.totalWeight,
      pickup_point: 1,
      droppof_point: 2,
    }],
    route_points: [
      {
        point_id: 1,
        visit_order: 1,
        address: { fullname: sender.address, coordinates: [sender.lng, sender.lat] },
        contact: { name: sender.name, phone: sender.phone },
        type: 'source',
      },
      {
        point_id: 2,
        visit_order: 2,
        address: { fullname: recipient.address, coordinates: [recipient.lng, recipient.lat] },
        contact: { name: recipient.name, phone: recipient.phone },
        type: 'destination',
      },
    ],
    skip_door_to_door: false,
    requirements: {
      taxi_class: 'express',
    },
    callback_properties: {
      callback_url: `${process.env.API_URL}/webhooks/yandex-go/status-update`,
    },
  }, {
    headers: { 'Authorization': `Bearer ${this.token}` },
  });

  return response.data; // claim_id, status, ...
}
```

#### Webhook от Yandex Go
```
POST /webhooks/yandex-go/status-update

Body:
{
  "claim_id": "...",
  "status": "performer_found" | "pickuped" | "delivered" | ...,
  "updated_ts": "...",
  "version": 1
}
```

Маппинг статусов:
- `performer_found` → courier_assigned
- `pickuped` → IN_TRANSIT
- `delivering` → OUT_FOR_DELIVERY
- `delivered` → DELIVERED
- `failed` → FAILED_DELIVERY

### 2. BTS Logistics

**Документация**: запрос у BTS (нет публичной)

Используем для доставки **по всему Узбекистану** (Самарканд, Бухара, Фергана и т.д.).

#### Флоу
1. Создание накладной через их API
2. Получение tracking number
3. Передача отправления в их пункт приёма
4. Webhook о статусах (или периодический pull)

### 3. Курьеры платформы (Ташкент)

Свой собственный софт:
- Мобильное приложение для курьера (PWA)
- Назначение заявок в админ-панели или автоматически (по геолокации)
- Tracking через WebSocket

```typescript
@Cron('*/30 * * * * *') // каждые 30 сек
async updateCourierLocations() {
  const couriers = await this.couriersService.findAvailable();
  for (const courier of couriers) {
    if (courier.lastLocationUpdate < new Date(Date.now() - 5 * 60 * 1000)) {
      // Курьер не обновляет геолокацию >5 мин — пометить offline
      await this.couriersService.markOffline(courier.id);
    }
  }
}
```

---

## VIN-декодер

### Варианты

#### 1. CarVX API (платный, точный)
**URL**: https://api.carvx.jp/

```
GET /vin-decoder?vin=JTHBJ46G292XXXXXX&apikey=...

Response:
{
  "make": "Toyota",
  "model": "Camry",
  "year": 2010,
  "engine": "2.4L",
  "transmission": "AT",
  ...
}
```

#### 2. Vin-decoder.org API (бесплатный, ограниченный)
Менее точный, но бесплатный — для MVP.

#### 3. Собственная база
На Phase 2 — собираем VIN-сегменты популярных моделей в Узбекистане и матчим локально.

### Маппинг с нашей БД
```typescript
async decodeVin(vin: string): Promise<CarModification | null> {
  // 1. Запрос к внешнему API
  const decoded = await this.carvxClient.decode(vin);

  // 2. Поиск в нашей БД
  const make = await this.carMakes.findByName(decoded.make);
  const model = await this.carModels.findByName(make.id, decoded.model);
  const modification = await this.carModifications.find({
    modelId: model.id,
    year: decoded.year,
    engineVolume: decoded.engineVolume,
    transmission: decoded.transmission,
  });

  return modification;
}
```

---

## Карты и геокодинг

### 1. Yandex Maps API

Для Узбекистана — лучшее покрытие.

**Используем**:
- **JavaScript API** на фронте — отображение карт
- **Geocoder API** — преобразование адрес ↔ координаты
- **Routing API** — построение маршрутов курьеров

```env
YANDEX_MAPS_API_KEY=...
```

#### Geocoding (адрес → координаты)
```typescript
async geocode(address: string) {
  const response = await axios.get('https://geocode-maps.yandex.ru/1.x/', {
    params: {
      apikey: process.env.YANDEX_MAPS_API_KEY,
      geocode: address,
      format: 'json',
      lang: 'ru_RU',
    },
  });

  const point = response.data.response.GeoObjectCollection
    .featureMember[0]?.GeoObject.Point.pos;

  if (point) {
    const [lng, lat] = point.split(' ').map(Number);
    return { lat, lng };
  }
  return null;
}
```

### 2. 2GIS API (запасной)

Для точных адресов внутри городов. Используется когда у Яндекса нет данных.

---

## Email

### SMTP-провайдер

**Опции**:
1. **Mailgun** (международный, удобный)
2. **Brevo (Sendinblue)** (бесплатный лимит)
3. **Свой SMTP** через локального провайдера

Для MVP — Mailgun.

```env
MAILGUN_API_KEY=...
MAILGUN_DOMAIN=mg.domkrat.uz
EMAIL_FROM=noreply@domkrat.uz
EMAIL_FROM_NAME=Domkrat
```

### Шаблоны
Используем **MJML** для responsive HTML email + **Handlebars** для переменных.

```typescript
@Injectable()
export class EmailService {
  async send(to: string, templateCode: string, data: any, language: 'ru' | 'uz') {
    const template = await this.templatesService.findByCode(templateCode);

    const subject = this.compile(template.subject[language], data);
    const html = this.compile(template.body[language], data);

    return this.mailgun.messages.create(process.env.MAILGUN_DOMAIN, {
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html,
    });
  }

  private compile(template: string, data: any): string {
    return handlebars.compile(template)(data);
  }
}
```

---

## Push-уведомления

### Web Push (для PWA)
- **VAPID keys** для подписки
- Хранение subscription в БД

### Mobile Push (Phase 3)
- **Firebase Cloud Messaging (FCM)** — для iOS и Android
- Регистрация device tokens

```env
FCM_SERVER_KEY=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

---

## Аналитика

### Google Analytics 4
Для покупательского веб-сайта.

```env
GA_MEASUREMENT_ID=G-XXXXXXX
```

### Yandex Metrica
Дополнительно — местная аудитория UZ.

```env
YANDEX_METRICA_ID=...
```

### Внутренняя аналитика
Записываем события сами в БД для собственной аналитики:
- `product_view`
- `add_to_cart`
- `checkout_started`
- `order_placed`
- `search_performed`

---

## Безопасность интеграций

### 1. Хранение секретов
- **Никогда** не коммитим в Git
- Используем `.env` локально, **Vault** или K8s Secrets в prod
- Регулярная ротация ключей (каждые 90 дней)

### 2. Whitelist IP-адресов webhooks
```typescript
@Injectable()
export class WebhookIpGuard implements CanActivate {
  private allowedIps = {
    click: ['185.74.4.0/24', '195.158.0.0/16'],
    payme: ['185.116.193.0/24'],
    // ...
  };

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provider = request.params.provider;
    const ip = request.ip;
    return this.isIpAllowed(ip, this.allowedIps[provider]);
  }
}
```

### 3. Идемпотентность
Все webhooks имеют `event_id` — мы храним их в Redis 24ч, чтобы не обработать дважды.

### 4. Логирование запросов/ответов
Все взаимодействия с внешними API логируются в `payment_transactions.request_payload` и `response_payload` для аудита и отладки.

### 5. Circuit Breaker
Используем библиотеку `opossum` для защиты от каскадных сбоев:

```typescript
const breaker = new CircuitBreaker(this.eskiz.send.bind(this.eskiz), {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});

breaker.fallback((phone, msg) => this.playMobile.send(phone, msg));
```

### 6. Retry с exponential backoff
Для transient failures внешних API.

```typescript
@Retry({ attempts: 3, backoff: 'exponential', maxDelay: 5000 })
async callExternalApi() { ... }
```

---

## Sandbox / тестовые окружения

| Провайдер | Sandbox | Note |
|-----------|---------|------|
| Click | https://api.click.uz/v2/ (есть тестовые карты) | Тестовые карты: 8600 0000 0000 0001, OTP: 1111 |
| Payme | Тестовый кабинет в payme.uz | Тестовые карты в документации |
| Uzum | Sandbox env | По запросу |
| Eskiz | demo-сервер с лимитом 30 SMS/день | |
| Yandex Go | testing.b2b.taxi.yandex.net | Реальные тесты с настоящей доставкой |

---

## Мониторинг интеграций

В Grafana — отдельный дашборд:
- Response time каждого внешнего API
- Error rate
- Webhook delivery rate
- Outstanding webhooks (зависшие)
- SMS sent / failed / cost

Алерты в Telegram:
- Error rate > 5% на любом провайдере
- Время ответа > 10s
- Платёжный webhook не обрабатывается >5 мин

---

**Далее**: см. `09-DEPLOYMENT-GUIDE.md` для развёртывания.
