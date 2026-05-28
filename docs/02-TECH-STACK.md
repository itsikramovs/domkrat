# 🛠️ 02. Технологический стек

## Обоснование выбора

Для маркетплейса с такими требованиями (WMS, multi-tenant мерчанты, интеграции с локальными платежами, масштабируемость) выбран следующий стек:

---

## 🎯 Краткий итог стека

| Слой | Технология | Версия |
|------|------------|--------|
| **Backend** | NestJS (Node.js + TypeScript) | 10.x |
| **Frontend (web)** | Next.js (React) | 14.x (App Router) |
| **База данных** | PostgreSQL | 16.x |
| **Кэш / Pub-Sub** | Redis | 7.x |
| **Очереди** | BullMQ (Redis-based) | latest |
| **Поиск** | Meilisearch / OpenSearch | latest |
| **Файлы / Картинки** | MinIO (S3-совместимое) | latest |
| **Контейнеризация** | Docker + Docker Compose | latest |
| **Оркестрация (Phase 3)** | Kubernetes | 1.30+ |
| **CI/CD** | GitHub Actions / GitLab CI | — |
| **Мониторинг** | Prometheus + Grafana | latest |
| **Логирование** | Pino + Loki | latest |
| **Reverse Proxy** | Nginx / Traefik | latest |

---

## 🧱 Backend: NestJS + TypeScript

### Почему NestJS?

✅ **Модульная архитектура из коробки** — идеально подходит для сложного маркетплейса
✅ **TypeScript first** — типизация на каждом уровне
✅ **DI (Dependency Injection)** — тестируемость и SOLID
✅ **Готовые интеграции**: TypeORM/Prisma, Passport, Swagger, BullMQ, Microservices
✅ **Активное сообщество** и enterprise-grade
✅ **Декораторы** для clean code (Guards, Interceptors, Pipes)
✅ **WebSockets** из коробки (для уведомлений в реальном времени)

### Ключевые библиотеки backend

```json
{
  "dependencies": {
    "@nestjs/core": "^10.0.0",
    "@nestjs/common": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/jwt": "^10.0.0",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/swagger": "^7.0.0",
    "@nestjs/throttler": "^5.0.0",
    "@nestjs/bullmq": "^10.0.0",
    "@nestjs/websockets": "^10.0.0",
    "@nestjs/microservices": "^10.0.0",
    "@nestjs/event-emitter": "^2.0.0",
    "@prisma/client": "^5.0.0",
    "prisma": "^5.0.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.0",
    "bcrypt": "^5.0.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.0",
    "argon2": "^0.31.0",
    "pino": "^8.0.0",
    "nestjs-pino": "^4.0.0",
    "ioredis": "^5.0.0",
    "bullmq": "^5.0.0",
    "meilisearch": "^0.40.0",
    "minio": "^7.0.0",
    "i18next": "^23.0.0",
    "nestjs-i18n": "^10.0.0",
    "@aws-sdk/client-s3": "^3.0.0",
    "sharp": "^0.33.0",
    "qrcode": "^1.5.0",
    "uuid": "^9.0.0",
    "dayjs": "^1.11.0",
    "axios": "^1.0.0"
  }
}
```

---

## ⚛️ Frontend: Next.js 14 (App Router)

### Почему Next.js?

✅ **SSR/SSG/ISR** — критично для SEO маркетплейса (продуктовые страницы должны индексироваться)
✅ **App Router + Server Components** — оптимальная производительность
✅ **Image optimization** — встроенная для миллионов фото товаров
✅ **i18n** — поддержка нескольких языков (RU/UZ)
✅ **API Routes** для BFF паттерна
✅ **Edge runtime** — быстрая работа из CDN
✅ **Streaming SSR** для долгих операций

### Ключевые библиотеки frontend

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@tanstack/react-query": "^5.0.0",
    "axios": "^1.0.0",
    "zustand": "^4.0.0",
    "react-hook-form": "^7.0.0",
    "zod": "^3.0.0",
    "@hookform/resolvers": "^3.0.0",
    "tailwindcss": "^3.0.0",
    "@radix-ui/react-*": "latest",
    "lucide-react": "^0.300.0",
    "next-intl": "^3.0.0",
    "next-themes": "^0.2.0",
    "framer-motion": "^11.0.0",
    "swiper": "^11.0.0",
    "react-image-gallery": "^1.0.0",
    "recharts": "^2.0.0",
    "date-fns": "^3.0.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "sonner": "^1.0.0"
  }
}
```

### UI-компоненты — shadcn/ui

Используем **shadcn/ui** (на Radix UI + Tailwind) — это не библиотека, а коллекция копируемых компонентов:
- Полная кастомизация под бренд «Домкрат»
- Доступность (a11y) из коробки
- TypeScript типы
- Лёгкость обновления

---

## 🐘 База данных: PostgreSQL 16

### Почему PostgreSQL?

✅ **JSON/JSONB поля** — гибкое хранение характеристик товаров
✅ **Полнотекстовый поиск** (как backup для Meilisearch)
✅ **Расширения**: PostGIS (геоданные доставки), pg_trgm (нечёткий поиск)
✅ **Транзакции и foreign keys** — критично для финансов
✅ **Партиционирование** — для масштабирования (заказы, логи)
✅ **Row-level security** — для multi-tenant мерчантов

### ORM: Prisma

✅ Type-safe queries
✅ Автогенерация типов из схемы
✅ Удобные миграции
✅ Хороший DX (Developer Experience)
✅ Поддержка raw SQL когда нужна максимальная производительность

---

## 🔴 Redis 7 + BullMQ

### Применение Redis:
1. **Кэш** (категории, популярные товары, корзины)
2. **Сессии** (refresh tokens, lockouts)
3. **Pub/Sub** (real-time уведомления)
4. **Rate limiting**
5. **Распределённые блокировки** (резерв товара)

### BullMQ — асинхронные задачи:
- Отправка SMS/Email
- Обработка платежей webhooks
- Генерация отчётов
- Индексация в Meilisearch
- Уведомления о неликвиде (cron)
- Backup задачи

---

## 🔍 Meilisearch — поисковый движок

### Почему Meilisearch?

✅ **Скорость**: <50ms на миллионах записей
✅ **Typo-tolerance** — поиск с опечатками (критично для запчастей)
✅ **Faceted search** — фильтры по марке/модели/цене/мерчанту
✅ **Multilingual** — RU + UZ из коробки
✅ **Synonyms** — для запчастей (свеча/spark plug, ремень/belt)
✅ **Простой API** — проще ElasticSearch

### Альтернатива на будущее
OpenSearch (форк Elastic) — если потребуется аналитика и сложные агрегации.

---

## 📦 MinIO — хранилище файлов

### Применение:
- Фотографии товаров (несколько на каждый, разные размеры)
- Сканы документов мерчантов
- Накладные и акты в PDF
- Изображения категорий и баннеров

### Почему MinIO?
✅ **S3-совместимый API** — легко перейти на AWS S3 если потребуется
✅ **Self-hosted** — данные клиентов в Узбекистане (требования по локализации данных)
✅ **Производительность** — оптимизирован для миллионов объектов

---

## 🐳 Инфраструктура

### Phase 1 (MVP) — Docker Compose

```yaml
# docker-compose.yml (упрощённо)
services:
  postgres:
    image: postgres:16-alpine
  redis:
    image: redis:7-alpine
  meilisearch:
    image: getmeili/meilisearch:latest
  minio:
    image: minio/minio:latest
  api:
    build: ./apps/api
  web:
    build: ./apps/web
  merchant:
    build: ./apps/merchant
  admin:
    build: ./apps/admin
  nginx:
    image: nginx:alpine
```

### Phase 2-3 — Kubernetes

- **Kubernetes** (managed: DigitalOcean / Yandex Cloud / Hetzner)
- **Helm charts** для каждого сервиса
- **HPA** (Horizontal Pod Autoscaler)
- **Ingress NGINX** + **cert-manager** для SSL

---

## 🔐 Аутентификация и безопасность

### Стратегия
- **JWT** (access tokens, 15 мин) + **Refresh tokens** (Redis, 30 дней)
- **Argon2** для хэширования паролей
- **2FA через SMS** (опционально, для админов обязательно)
- **OAuth 2.0** (Google, Apple — Phase 2)
- **RBAC** через Guards в NestJS
- **CASL** для атрибутивного доступа (например, мерчант видит только свои заказы)

### Защита
- **Rate limiting** через @nestjs/throttler
- **CORS** strict
- **CSRF** для cookies-based аутентификации
- **Content Security Policy** headers
- **SQL injection** защита через Prisma (параметризованные запросы)
- **XSS** защита через React (auto-escaping) + DOMPurify для богатого контента

---

## 📡 Интеграции

### Платёжные системы
- **Click** — Click Pass API (для UZ)
- **Payme** — Merchant API (UZ)
- **Uzum** — UzumPay API (UZ)

### Доставка
- **Yandex Go (Доставка)** — API для курьеров
- **BTS Logistics** — REST API
- Собственный API курьеров платформы

### SMS
- **Eskiz.uz** — основной (UZ)
- **PlayMobile.uz** — резервный

### VIN-поиск (Phase 2)
- **CarVX** / **VIN Decoder API** — для расшифровки VIN
- Альтернатива: собственная база данных авто

### Карты
- **Yandex Maps** (для Узбекистана, лучшее покрытие)
- **2GIS** (для точных адресов)

---

## 📊 Мониторинг и логирование

### Stack
- **Prometheus** — метрики
- **Grafana** — дашборды
- **Loki** — логи (агрегация)
- **Pino** — структурированное логирование в JSON
- **Sentry** — отслеживание ошибок (фронт и бэк)
- **OpenTelemetry** — distributed tracing (Phase 2)

### Дашборды Grafana
1. **Бизнес-метрики**: заказы, GMV, конверсия, активные пользователи
2. **Системные метрики**: CPU/RAM, response time, error rate
3. **Складские метрики**: остатки, оборачиваемость, неликвид
4. **Финансовые**: балансы мерчантов, выплаты, комиссии

---

## 🧪 Тестирование

### Backend (NestJS)
- **Jest** — unit + integration тесты
- **Supertest** — e2e API тесты
- **Testcontainers** — изолированная PostgreSQL для тестов
- **k6** — нагрузочное тестирование

### Frontend (Next.js)
- **Vitest** — unit тесты
- **React Testing Library** — component тесты
- **Playwright** — e2e тесты
- **Storybook** — изоляция компонентов

---

## 🌍 Локализация (i18n)

### Backend
**nestjs-i18n** для:
- Email/SMS шаблонов
- Ошибок API (response messages)
- Названий категорий и системных сущностей

### Frontend
**next-intl** для:
- UI элементов (кнопки, формы, навигация)
- Форматирование чисел (узбекский: 1 000 000 сум)
- Форматирование дат (RU/UZ календарь)

### Данные в БД
Для **переводимого контента** (товары, категории, описания):
```typescript
// Структура мультиязычного поля
{
  ru: "Тормозные колодки передние",
  uz: "Old tormoz kolodkalari"
}
```
Хранится как **JSONB** в PostgreSQL — гибко и быстро.

---

## 🚀 Производительность

### Backend
- **Кэширование** Redis для часто запрашиваемых данных (категории, фильтры)
- **Database indexing** — продуманная стратегия (см. `04-DATABASE-SCHEMA.md`)
- **Connection pooling** — pgBouncer
- **Read replicas** — для read-heavy запросов каталога (Phase 2)
- **N+1 queries** — DataLoader / Prisma include

### Frontend
- **ISR** (Incremental Static Regeneration) для страниц товаров
- **Image optimization** — Next.js Image + Sharp
- **Code splitting** — автоматический в Next.js
- **CDN** — Cloudflare для статики
- **Service Worker** — кэш на мобильных (PWA)

---

## 📱 Мобильные клиенты

### Phase 1
**PWA** (Progressive Web App) для:
- Покупателей (через web)
- Склад работников
- Курьеров

### Phase 3
**React Native** (Expo) — нативные приложения iOS/Android для покупателей.

---

## ✅ Сводная диаграмма архитектуры

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                     │
├──────────────────────────────────────────────────────────────────────┤
│  Customer Web  │ Merchant Web │ Admin Web │ Warehouse PWA / Mobile  │
└────────┬─────────────┬─────────────┬────────────────┬────────────────┘
         │             │             │                │
         ▼             ▼             ▼                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        Nginx / Traefik (LB + SSL)                    │
└────────┬─────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        NestJS API (Modular Monolith)                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ ┌─────────┐           │
│  │Catalog │ │ Orders │ │  WMS   │ │Merchants │ │Payments │   …       │
│  └────────┘ └────────┘ └────────┘ └──────────┘ └─────────┘           │
└──┬──────┬──────────┬─────────┬─────────────┬───────────────┬─────────┘
   │      │          │         │             │               │
   ▼      ▼          ▼         ▼             ▼               ▼
┌──────┐ ┌──────┐ ┌─────────┐ ┌──────┐ ┌──────────┐ ┌──────────────┐
│ PG16 │ │Redis │ │Meilisrch│ │MinIO │ │ BullMQ   │ │External APIs │
│      │ │      │ │         │ │ (S3) │ │ Workers  │ │Click/Payme/  │
│      │ │      │ │         │ │      │ │          │ │ SMS/Yandex   │
└──────┘ └──────┘ └─────────┘ └──────┘ └──────────┘ └──────────────┘
```

---

**Далее**: см. `03-ARCHITECTURE.md` для деталей по модулям и слоям.
