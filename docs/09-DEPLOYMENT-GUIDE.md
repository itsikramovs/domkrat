# 🚀 09. Deployment Guide

Руководство по развёртыванию проекта «Домкрат» — от локальной разработки до production.

---

## 📑 Содержание

1. [Локальная разработка](#локальная-разработка)
2. [Окружения](#окружения)
3. [Docker и Docker Compose](#docker-и-docker-compose)
4. [CI/CD Pipeline](#cicd-pipeline)
5. [Production развёртывание](#production-развёртывание)
6. [Kubernetes (Phase 3)](#kubernetes-phase-3)
7. [Резервное копирование](#резервное-копирование)
8. [Мониторинг и логи](#мониторинг-и-логи)
9. [Чеклист безопасности](#чеклист-безопасности)
10. [Disaster Recovery](#disaster-recovery)

---

## Локальная разработка

### Требования
- **Node.js** 20+ (LTS)
- **pnpm** 9+ (для монорепо)
- **Docker** + **Docker Compose** 2+
- **Git**
- 16+ ГБ RAM на машине разработчика
- IDE: **VS Code** (рекомендуется) или **WebStorm**

### Установка проекта

```bash
# 1. Клонировать репозиторий
git clone git@github.com:domkrat/domkrat.git
cd domkrat

# 2. Установить зависимости (всего монорепо)
pnpm install

# 3. Скопировать .env файлы
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/merchant/.env.example apps/merchant/.env
cp apps/admin/.env.example apps/admin/.env

# 4. Запустить инфраструктуру в Docker
docker-compose -f docker-compose.dev.yml up -d
# Поднимется: PostgreSQL, Redis, Meilisearch, MinIO, MailHog

# 5. Применить миграции БД
pnpm --filter api prisma migrate dev

# 6. Заполнить тестовыми данными
pnpm --filter api prisma db seed

# 7. Запустить все приложения
pnpm dev
```

После запуска доступны:
- API: http://localhost:3000
- Web: http://localhost:3001
- Merchant: http://localhost:3002
- Admin: http://localhost:3003
- Swagger: http://localhost:3000/docs
- MailHog UI: http://localhost:8025
- MinIO Console: http://localhost:9001 (login: minioadmin/minioadmin)
- Meilisearch: http://localhost:7700

### Полезные команды

```bash
# Запуск только одного приложения
pnpm --filter api dev
pnpm --filter web dev

# Linting
pnpm lint
pnpm lint:fix

# Type checking
pnpm type-check

# Тесты
pnpm test
pnpm test:e2e

# Сборка
pnpm build

# Prisma команды
pnpm --filter api prisma studio          # GUI для БД
pnpm --filter api prisma migrate dev     # Создать миграцию
pnpm --filter api prisma migrate deploy  # Применить миграции (prod)
pnpm --filter api prisma generate        # Сгенерировать клиент

# Docker
docker-compose -f docker-compose.dev.yml logs -f postgres
docker-compose -f docker-compose.dev.yml restart redis
docker-compose -f docker-compose.dev.yml down -v   # с удалением volumes
```

---

## Окружения

| Окружение | URL | База | Использование |
|-----------|-----|------|---------------|
| **Local** | localhost | docker | Разработка |
| **Dev** | dev.domkrat.uz | shared dev DB | Тестирование фичей разработчиками |
| **Staging** | staging.domkrat.uz | копия prod | QA, UAT, нагрузочные тесты |
| **Production** | domkrat.uz | prod DB | Боевое окружение |

### Конфигурация переменных по окружениям

Используем **dotenv-flow** для иерархии:
- `.env` — общие настройки
- `.env.development` — для dev
- `.env.staging`
- `.env.production`
- `.env.local` — локальные оверрайды (не коммитим)

В production — **никаких .env файлов**, всё через Vault или K8s Secrets.

---

## Docker и Docker Compose

### Структура Dockerfile (для NestJS API)

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Стадия 1: установка зависимостей
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages ./packages
RUN pnpm install --frozen-lockfile

# Стадия 2: сборка
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter api build
RUN pnpm --filter api prisma generate

# Стадия 3: production-образ
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Создаём непривилегированного пользователя
RUN addgroup -g 1001 nodejs && adduser -S -u 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./

USER nestjs
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### docker-compose.dev.yml (упрощённо)

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: domkrat
      POSTGRES_PASSWORD: domkrat
      POSTGRES_DB: domkrat_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infrastructure/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U domkrat"]
      interval: 5s

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass devpass
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  meilisearch:
    image: getmeili/meilisearch:v1.6
    environment:
      MEILI_MASTER_KEY: devmasterkey
      MEILI_ENV: development
    volumes:
      - meili_data:/meili_data
    ports:
      - "7700:7700"

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

  mailhog:
    image: mailhog/mailhog
    ports:
      - "1025:1025"
      - "8025:8025"

volumes:
  postgres_data:
  redis_data:
  meili_data:
  minio_data:
```

### docker-compose.prod.yml (Phase 1 production)

Production деплой через Docker Compose на одном или двух серверах (для MVP):

```yaml
version: '3.9'

services:
  api:
    image: registry.domkrat.uz/domkrat/api:${VERSION}
    restart: unless-stopped
    env_file: /etc/domkrat/api.env
    depends_on:
      - postgres
      - redis
    networks:
      - domkrat-internal
    deploy:
      resources:
        limits: { cpus: '2', memory: 2G }

  api-worker:
    image: registry.domkrat.uz/domkrat/api:${VERSION}
    command: ["node", "dist/worker.js"]
    restart: unless-stopped
    env_file: /etc/domkrat/api.env
    depends_on:
      - postgres
      - redis
    deploy:
      replicas: 2  # несколько воркеров для BullMQ

  web:
    image: registry.domkrat.uz/domkrat/web:${VERSION}
    restart: unless-stopped
    networks:
      - domkrat-internal

  merchant:
    image: registry.domkrat.uz/domkrat/merchant:${VERSION}
    restart: unless-stopped

  admin:
    image: registry.domkrat.uz/domkrat/admin:${VERSION}
    restart: unless-stopped

  postgres:
    image: postgres:16
    restart: unless-stopped
    volumes:
      - /data/postgres:/var/lib/postgresql/data
    env_file: /etc/domkrat/postgres.env
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 1gb --maxmemory-policy allkeys-lru
    volumes:
      - /data/redis:/data

  meilisearch:
    image: getmeili/meilisearch:v1.6
    restart: unless-stopped
    volumes:
      - /data/meili:/meili_data
    env_file: /etc/domkrat/meili.env

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    volumes:
      - /data/minio:/data
    env_file: /etc/domkrat/minio.env

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - api
      - web
      - merchant
      - admin

networks:
  domkrat-internal:
    driver: bridge
```

### nginx.conf (упрощённо)

```nginx
events {
  worker_connections 1024;
}

http {
  upstream api { server api:3000; }
  upstream web { server web:3001; }
  upstream merchant { server merchant:3002; }
  upstream admin { server admin:3003; }

  # Customer site
  server {
    listen 443 ssl http2;
    server_name domkrat.uz www.domkrat.uz;
    ssl_certificate /etc/letsencrypt/live/domkrat.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/domkrat.uz/privkey.pem;

    location / {
      proxy_pass http://web;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }

  # API
  server {
    listen 443 ssl http2;
    server_name api.domkrat.uz;
    ssl_certificate /etc/letsencrypt/live/api.domkrat.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.domkrat.uz/privkey.pem;

    client_max_body_size 50M;

    location / {
      proxy_pass http://api;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
      proxy_pass http://api;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
    }
  }

  # Merchant
  server {
    listen 443 ssl http2;
    server_name merchant.domkrat.uz;
    # ...
    location / { proxy_pass http://merchant; }
  }

  # Admin
  server {
    listen 443 ssl http2;
    server_name admin.domkrat.uz;
    # ... + IP whitelist
    allow 1.2.3.4;  # Офис
    deny all;
    location / { proxy_pass http://admin; }
  }

  # Редирект HTTP → HTTPS
  server {
    listen 80 default_server;
    return 301 https://$host$request_uri;
  }
}
```

---

## CI/CD Pipeline

### GitHub Actions (или GitLab CI)

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  REGISTRY: registry.domkrat.uz
  IMAGE_PREFIX: domkrat

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s
        ports: [5432:5432]
      redis:
        image: redis:7
        ports: [6379:6379]

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm --filter api prisma generate
      - run: pnpm test
      - run: pnpm test:e2e
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379

  build-and-push:
    needs: lint-and-test
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [api, web, merchant, admin]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3

      - name: Login to registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ secrets.REGISTRY_USER }}
          password: ${{ secrets.REGISTRY_PASSWORD }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/${{ matrix.app }}/Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.app }}:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.app }}:${{ github.ref_name }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    needs: build-and-push
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy to staging
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: deploy
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/domkrat
            export VERSION=${{ github.sha }}
            docker-compose pull
            docker-compose up -d --remove-orphans
            docker-compose exec -T api npx prisma migrate deploy
            docker-compose exec -T api node dist/scripts/post-deploy.js

  deploy-production:
    needs: build-and-push
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production  # требует ручного approve
    steps:
      - name: Deploy to production
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: deploy
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/domkrat
            export VERSION=${{ github.sha }}
            ./deploy.sh
```

### Стратегия релизов

1. **feature/*** branches → PR → автоматический build + tests
2. **develop** branch → авто-deploy на staging
3. **main** branch → ручной approve → deploy на production
4. **Tags v1.x.x** для значимых релизов

### Rollback стратегия

```bash
# Production deploy с возможностью отката
./deploy.sh
# В случае проблемы:
./rollback.sh v1.2.3
# Восстановит предыдущую версию + миграции БД (если откатываемые)
```

---

## Production развёртывание

### Phase 1 — Single Server (MVP, до ~1000 заказов/день)

**Минимальная конфигурация**:
- 1 сервер: 8 vCPU, 32 ГБ RAM, 500 ГБ SSD NVMe
- Provider: DigitalOcean / Hetzner / Yandex Cloud (для UZ — лучше локальный)
- ОС: Ubuntu 24.04 LTS
- Docker + Docker Compose
- Все сервисы на одной машине

Стоимость: ~$80-150/мес.

### Phase 2 — Multi-Server (1000-10000 заказов/день)

**Конфигурация**:
- 2× **App Server** (NestJS + Next.js): 4 vCPU, 16 ГБ RAM
- 1× **Database Server**: 8 vCPU, 32 ГБ RAM, 1 ТБ NVMe — PostgreSQL master
- 1× **Database Replica**: 4 vCPU, 16 ГБ RAM — read replica
- 1× **Cache/Queue Server**: 4 vCPU, 16 ГБ RAM — Redis + BullMQ + Meilisearch
- 1× **Storage Server**: MinIO с 2+ ТБ дискового пространства
- 1× **Monitoring Server**: Prometheus + Grafana + Loki
- Load balancer (Cloudflare + Nginx)

Стоимость: ~$500-800/мес.

### Phase 3 — Kubernetes (10000+ заказов/день)

См. раздел [Kubernetes](#kubernetes-phase-3).

### Установка на чистый сервер

```bash
# 1. SSH
ssh root@server.ip
# Создать non-root пользователя
adduser deploy
usermod -aG sudo deploy

# 2. Базовые пакеты
apt update && apt upgrade -y
apt install -y curl git ufw fail2ban htop

# 3. Файервол
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable

# 4. Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy

# 5. SSL (Let's Encrypt)
apt install -y certbot
certbot certonly --standalone -d domkrat.uz -d www.domkrat.uz -d api.domkrat.uz -d merchant.domkrat.uz -d admin.domkrat.uz

# Авто-обновление
echo "0 3 * * * certbot renew --quiet --post-hook 'docker-compose -f /var/www/domkrat/docker-compose.yml restart nginx'" | crontab -

# 6. Структура папок
mkdir -p /var/www/domkrat
mkdir -p /data/{postgres,redis,meili,minio}
chown -R deploy:deploy /var/www/domkrat /data

# 7. Клонировать конфиги
su - deploy
cd /var/www/domkrat
git clone https://github.com/domkrat/infrastructure.git .

# 8. Создать .env файлы в /etc/domkrat/ (только root)
# (никогда не коммитить!)

# 9. Запустить
docker-compose pull
docker-compose up -d
docker-compose exec api npx prisma migrate deploy
docker-compose exec api node dist/scripts/seed-production.js
```

---

## Kubernetes (Phase 3)

### Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                  Ingress Controller                         │
│              (NGINX + cert-manager)                         │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
        ┌─────────────┼─────────────┬─────────────┬──────────┐
        ↓             ↓             ↓             ↓          ↓
   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐  ┌────────┐
   │  API   │   │  Web   │   │Merchant│   │ Admin  │  │Workers │
   │ (HPA)  │   │  (HPA) │   │  (HPA) │   │        │  │ (HPA)  │
   └────┬───┘   └────┬───┘   └────┬───┘   └────┬───┘  └────┬───┘
        │            │            │            │           │
        └─────────────────────────┴────────────┘           │
                                                            │
        ┌───────────┬───────────┬──────────────┬───────────┘
        ↓           ↓           ↓              ↓
   ┌────────┐  ┌────────┐  ┌────────┐   ┌──────────┐
   │Postgres│  │ Redis  │  │ Meili  │   │  MinIO   │
   │(StFul) │  │(StFul) │  │ Search │   │          │
   └────────┘  └────────┘  └────────┘   └──────────┘
```

### Helm charts

Используем **Helm charts** для каждого приложения:

```
infrastructure/k8s/
├── charts/
│   ├── api/
│   │   ├── Chart.yaml
│   │   ├── values.yaml
│   │   └── templates/
│   │       ├── deployment.yaml
│   │       ├── service.yaml
│   │       ├── hpa.yaml
│   │       └── ingress.yaml
│   ├── web/
│   └── ...
├── values/
│   ├── staging.yaml
│   └── production.yaml
└── README.md
```

### HPA (Horizontal Pod Autoscaler)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### Managed services

Для production K8s рекомендуем использовать managed-сервисы где возможно:
- **PostgreSQL** → managed (Yandex Managed PostgreSQL)
- **Redis** → managed
- **Object Storage** → совместимый с S3
- Только приложения в K8s

---

## Резервное копирование

### PostgreSQL backups

**Стратегия**: ежечасные WAL archive + ежедневные полные бэкапы.

```bash
# /opt/scripts/backup-postgres.sh
#!/bin/bash
BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Полный бэкап
docker exec domkrat-postgres-1 pg_dump -U domkrat domkrat_prod \
  --format=custom --no-owner | gzip > $BACKUP_DIR/full_$DATE.sql.gz

# Очистка старше 30 дней
find $BACKUP_DIR -name "full_*.sql.gz" -mtime +30 -delete

# Загрузка в внешнее хранилище (S3 / другой регион)
aws s3 cp $BACKUP_DIR/full_$DATE.sql.gz s3://domkrat-backups/postgres/
```

```bash
# Cron
0 3 * * * /opt/scripts/backup-postgres.sh
0 * * * * /opt/scripts/backup-wal.sh  # ежечасно
```

### MinIO

Репликация в другой регион (cross-region replication) — встроенная функция MinIO.

```bash
mc admin replicate add source-minio target-minio
```

### Redis

Redis — в основном кэш, но содержит **корзины и refresh tokens**. Бэкапим через RDB snapshots:

```bash
docker exec domkrat-redis-1 redis-cli SAVE
docker cp domkrat-redis-1:/data/dump.rdb /backups/redis/dump_$(date +%Y%m%d).rdb
```

### Конфиги

```bash
# Бэкап /etc/domkrat и /var/www/domkrat
tar czf /backups/configs_$(date +%Y%m%d).tar.gz /etc/domkrat /var/www/domkrat/docker-compose.yml
```

### Тестирование восстановления
Раз в квартал — тестовое восстановление на staging из бэкапа prod.

---

## Мониторинг и логи

### Stack

```
[Applications] → Pino logs (JSON) → Promtail → Loki ← Grafana
                ↓
              Metrics (/metrics) → Prometheus ← Grafana
                ↓
              Sentry (errors)
```

### Метрики (Prometheus)

Backend NestJS экспортирует `/metrics`:
- HTTP requests (count, duration, status)
- Database queries
- Redis operations
- Queue jobs (success/fail/duration)
- Business metrics:
  - `orders_created_total`
  - `orders_paid_total`
  - `payment_failures_total`
  - `inventory_alerts_total`

### Алерты

В Alertmanager или Grafana Alerting:

| Alert | Условие | Канал |
|-------|---------|-------|
| API down | up{job="api"} == 0 | Telegram + SMS |
| High error rate | rate(http_5xx_total[5m]) > 0.05 | Telegram |
| Slow response | p99 > 2s | Telegram |
| DB connections high | pg_connections > 80% | Telegram |
| Disk space | <10% | Telegram + SMS |
| Failed payments | rate(payment_failed[15m]) > 10/min | Telegram |
| Queue backed up | bull_jobs_waiting > 1000 | Telegram |
| SMS provider down | eskiz_failed_rate > 50% | Telegram |

### Логирование

**Pino** (NestJS) генерирует JSON-логи:
```json
{
  "level": 30,
  "time": 1716729600000,
  "pid": 1234,
  "hostname": "api-1",
  "correlationId": "abc-123",
  "userId": "uuid-...",
  "method": "POST",
  "url": "/api/v1/orders",
  "statusCode": 201,
  "responseTime": 234,
  "msg": "Request completed"
}
```

**Loki** агрегирует все логи. Поиск через Grafana:
```
{app="api"} |= "ERROR" | json
```

### Sentry для ошибок

Все uncaught exceptions + важные ошибки отправляются в Sentry с context (user, request).

---

## Чеклист безопасности

- [ ] SSL/TLS на всех доменах (Let's Encrypt + auto-renew)
- [ ] HTTPS-only (HSTS)
- [ ] Все секреты в Vault / K8s Secrets (не в .env в prod)
- [ ] Firewall: только 22, 80, 443 наружу
- [ ] SSH: только key-based auth, no root login
- [ ] Fail2ban настроен
- [ ] Регулярные обновления ОС
- [ ] PostgreSQL — без external port (только internal)
- [ ] Redis — пароль + binding only on internal
- [ ] Strong passwords (rotation 90 дней)
- [ ] JWT secrets — длинные, рандомные, ротация
- [ ] CORS — только разрешённые домены
- [ ] CSP headers
- [ ] Rate limiting на всех публичных endpoints
- [ ] Регулярный security audit (npm audit, snyk)
- [ ] Dependabot / Renovate для обновлений зависимостей
- [ ] Backup encrypted + хранятся offsite
- [ ] Доступ к admin-панели — IP whitelist + 2FA
- [ ] Логи не содержат PII
- [ ] PCI compliance для платежей (хотя сами карты не храним)

---

## Disaster Recovery

### RPO (Recovery Point Objective): 1 час
### RTO (Recovery Time Objective): 4 часа

### Сценарии

#### 1. Падение приложения
**Действие**: Docker auto-restart. Если повторяется — алерт, разработчик чинит.

#### 2. Падение БД
**Действие**:
- Если master жив но недоступен → failover на replica (Phase 2+)
- Если данные повреждены → восстановление из бэкапа

#### 3. Полная потеря сервера
**Действие**:
1. Поднять новый сервер (можно с готового image)
2. Развернуть инфраструктуру через terraform/ansible
3. Восстановить БД из последнего бэкапа
4. Применить WAL до последнего часа
5. Восстановить MinIO из репликации
6. Запустить приложения
7. Проверить работоспособность
8. Переключить DNS

#### 4. Атака / взлом
1. Изолировать заражённый сервер
2. Сменить все ключи и пароли
3. Аудит логов
4. Восстановление из чистого бэкапа
5. Уведомление пользователей (если утечка данных)

### Документация incident response
Подробный runbook должен быть в `/docs/runbooks/`:
- `incident-postgres-down.md`
- `incident-payment-failed.md`
- `incident-mass-alerts.md`

---

## Чеклист первого деплоя в production

- [ ] Все .env переменные заполнены
- [ ] SSL сертификаты установлены
- [ ] DNS записи настроены (A, MX, SPF, DKIM, DMARC)
- [ ] Backups настроены и протестированы
- [ ] Мониторинг работает (алерты тестово отправляются)
- [ ] Все продакшен-данные в платёжных системах (production keys)
- [ ] SMS-провайдеры с продакшен-аккаунтами
- [ ] Yandex Maps API key с правильным доменом
- [ ] Загружены seed-данные: марки авто, основные категории, базовые настройки
- [ ] Создан первый ADMIN-пользователь
- [ ] Создан тестовый заказ от начала до конца (smoke test)
- [ ] Юридические страницы заполнены (privacy, terms, returns)
- [ ] Заполнен robots.txt и sitemap.xml
- [ ] Проверена индексация в Google/Yandex
- [ ] GDPR/152-ФЗ compliance проверен (если применимо для UZ)

---

**Далее**: см. `10-MVP-ROADMAP.md` для плана разработки.
