# Domkrat 🚗

Маркетплейс автотоваров и запчастей для Узбекистана.

> **Документация продукта** — в [`docs/`](./docs/).
> **Контекст для AI-разработки** — в [`CLAUDE.md`](./CLAUDE.md) и [`docs/claude-code/`](./docs/claude-code/).

---

## Стек

NestJS 10 · Next.js 14 · PostgreSQL 16 · Prisma · Redis · Meilisearch · MinIO · Docker Compose · pnpm workspaces · Turborepo

## Структура

```
apps/
  api/         NestJS API (port 3001)
  web/         Next.js customer storefront (port 3000)
  merchant/    Next.js merchant cabinet (port 3002)
  admin/       Next.js admin panel (port 3003)
packages/
  config/      shared ESLint, Prettier, tsconfig presets
  ui/          shared UI components (shadcn/ui — будет в задаче 1.9)
  shared-types/  общие TS типы между API и фронтами
  i18n/        локали и утилиты (ru/uz)
infrastructure/docker/
  docker-compose.dev.yml   postgres, redis, meilisearch, minio, mailhog
docs/          продуктовая документация (01-10)
docs/claude-code/  планы и промпты для AI-разработки
```

## Требования

- Node.js **20.10+** (см. `.nvmrc`)
- pnpm **10.34.1+**
- Docker + Docker Compose v2
- 8 ГБ RAM (рекомендуется 4 ГБ swap)

## Первый запуск

```bash
# 1. Установить зависимости (все workspace проекты)
pnpm install

# 2. Поднять инфраструктуру (PostgreSQL, Redis, Meili, MinIO, MailHog)
pnpm docker:up

# 3. Применить миграции БД и сгенерировать Prisma client
pnpm db:migrate          # создаст начальную миграцию
pnpm db:generate         # обновит @prisma/client (выполняется auto после migrate)

# 4. Скопировать env примеры (если ещё не сделано)
cp apps/api/.env.example apps/api/.env

# 5. Запустить всё одновременно (API + 3 фронта)
pnpm dev
```

После старта, **с Windows-машины** (через `http://192.168.1.8:<PORT>`):

| URL | Что |
|---|---|
| `http://192.168.1.8:3000` | Customer web |
| `http://192.168.1.8:3001/api/v1/health` | API liveness |
| `http://192.168.1.8:3001/api/v1/health/db` | API + DB readiness |
| `http://192.168.1.8:3001/api/docs` | Swagger UI |
| `http://192.168.1.8:3002` | Merchant cabinet |
| `http://192.168.1.8:3003` | Admin panel |
| `http://192.168.1.8:8025` | MailHog (inbox для писем) |
| `http://192.168.1.8:9001` | MinIO console (login `minioadmin` / `minioadmin_dev`) |
| `http://192.168.1.8:7700` | Meilisearch |
| `http://192.168.1.8:5555` | Prisma Studio (через `pnpm db:studio`) |

## Команды

```bash
# Разработка
pnpm dev                # все 4 приложения через Turborepo
pnpm dev:api            # только NestJS API
pnpm dev:web            # только customer web
pnpm dev:merchant
pnpm dev:admin

# Сборка / проверки
pnpm build              # production build всех
pnpm lint
pnpm type-check
pnpm test               # unit-тесты
pnpm format             # prettier --write

# Инфраструктура
pnpm docker:up
pnpm docker:down
pnpm docker:logs
pnpm docker:ps

# База данных
pnpm db:migrate         # prisma migrate dev (apps/api)
pnpm db:generate        # prisma generate
pnpm db:studio          # GUI на http://192.168.1.8:5555
pnpm db:seed            # пока заглушка — задача 1.3
```

## Текущий статус

Это **Phase 0 Bootstrap** — каркас монорепо. Реальный функционал (auth, каталог, заказы, склад) появляется в Sprint 1+. Полный план: [`docs/claude-code/CLAUDE-CODE-PLAN.md`](./docs/claude-code/CLAUDE-CODE-PLAN.md).

Prisma schema сейчас содержит только модель `HealthCheck` для проверки соединения. Полная схема ~80 моделей создаётся в задаче 1.1.

## Конвенции

См. [`CLAUDE.md`](./CLAUDE.md) — там описаны правила безопасности, naming, тестирование, антипаттерны.
