# 🚀 Production Deployment

Практическое руководство по выкатке Домкрата в production через
**Cloudflare Tunnel + systemd + Docker (infra)**. Не требует VPS с белым IP,
не нужен Nginx и certbot — TLS терминируется на стороне Cloudflare.

См. также `infrastructure/systemd/README.md` и
`infrastructure/cloudflared/config.example.yml`.

---

## Архитектура production

```
                          ┌─────────────────────────┐
                          │  Cloudflare Edge (TLS)  │
                          └─────────────┬───────────┘
                                        │ Cloudflare Tunnel
                                        │ (cloudflared daemon)
┌───────────────────────────────────────┴───────────────────────────────┐
│ Сервер (Ubuntu 24.04, systemd)                                        │
│                                                                       │
│ domkrat.uz         → 127.0.0.1:3000  (next start)  domkrat-web        │
│ api.domkrat.uz     → 127.0.0.1:3001  (node dist)   domkrat-api        │
│ merchant.*         → 127.0.0.1:3002  (next start)  domkrat-merchant   │
│ admin.*            → 127.0.0.1:3003  (next start)  domkrat-admin      │
│ cdn.domkrat.uz     → 127.0.0.1:9000  (MinIO public)                   │
│                                                                       │
│ Docker (только infra):                                                │
│   postgres / redis / meilisearch / minio (см. docker-compose.prod)    │
└───────────────────────────────────────────────────────────────────────┘
```

Все node-сервисы слушают только `127.0.0.1` — снаружи доступ
исключительно через Cloudflare Tunnel.

---

## 1. Подготовка сервера

```bash
# Системные пакеты
sudo apt update && sudo apt install -y curl git build-essential

# Node.js 20 LTS (через nvm или nodesource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm
sudo npm install -g pnpm@10

# Docker (для инфры)
curl -fsSL https://get.docker.com | sh

# Системный пользователь
sudo useradd --system --create-home --shell /bin/bash domkrat
sudo usermod -aG docker domkrat

# Структура каталогов
sudo mkdir -p /opt/domkrat /etc/domkrat /var/log/domkrat
sudo chown -R domkrat:domkrat /opt/domkrat /var/log/domkrat
```

---

## 2. Установка кода

```bash
sudo -u domkrat git clone https://github.com/<org>/domkrat.git /opt/domkrat
cd /opt/domkrat

sudo -u domkrat pnpm install --frozen-lockfile
sudo -u domkrat pnpm build
```

---

## 3. Секреты

```bash
# Шаблоны
sudo install -m 0640 -o root -g domkrat \
  apps/api/.env.production.example /etc/domkrat/api.env
sudo install -m 0640 -o root -g domkrat \
  apps/web/.env.production.example /etc/domkrat/web.env
sudo install -m 0640 -o root -g domkrat \
  apps/merchant/.env.production.example /etc/domkrat/merchant.env
sudo install -m 0640 -o root -g domkrat \
  apps/admin/.env.production.example /etc/domkrat/admin.env

# Заполнить CHANGE_ME во всех файлах
sudoedit /etc/domkrat/api.env

# Отдельно — infra-секреты для docker compose
sudo install -m 0600 -o root -g root /dev/null /etc/domkrat/infra.env
sudo tee -a /etc/domkrat/infra.env <<'EOF'
POSTGRES_PASSWORD=<openssl rand -base64 24>
REDIS_PASSWORD=<openssl rand -base64 24>
MINIO_ROOT_USER=domkrat
MINIO_ROOT_PASSWORD=<openssl rand -base64 32>
MEILI_MASTER_KEY=<openssl rand -base64 48>
EOF
```

**Генерация JWT_SECRET**: `openssl rand -base64 64`.

---

## 4. Инфраструктура (Docker)

```bash
sudo docker compose \
  -f /opt/domkrat/infrastructure/docker/docker-compose.production.yml \
  --env-file /etc/domkrat/infra.env \
  up -d

# Проверка
sudo docker ps
sudo docker logs domkrat-postgres --tail 20
```

---

## 5. Миграции и seed

```bash
cd /opt/domkrat
sudo -u domkrat --preserve-env=DATABASE_URL \
  env DATABASE_URL="$(grep ^DATABASE_URL /etc/domkrat/api.env | cut -d= -f2-)" \
  pnpm --filter @domkrat/api prisma migrate deploy

# Seed справочников + один super admin (без тестовых юзеров и товаров).
# Полный seed.ts в production не запускайте — он создаёт демо-аккаунты.
SUPER_ADMIN_EMAIL=admin@domkrat.uz \
SUPER_ADMIN_PASSWORD="$(openssl rand -base64 24)" \
sudo -u domkrat --preserve-env=DATABASE_URL,SUPER_ADMIN_EMAIL,SUPER_ADMIN_PASSWORD \
  env DATABASE_URL="$(grep ^DATABASE_URL /etc/domkrat/api.env | cut -d= -f2-)" \
  pnpm --filter @domkrat/api prod-seed
# Запишите выведенный SUPER_ADMIN_PASSWORD в надёжное место — он показывается один раз.
```

---

## 6. systemd unit-файлы

```bash
sudo cp /opt/domkrat/infrastructure/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now \
  domkrat-api domkrat-web domkrat-merchant domkrat-admin

# Проверка
sudo systemctl status domkrat-api
sudo journalctl -u domkrat-api -f
```

---

## 7. Cloudflare Tunnel

```bash
# Установить cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
  -o /tmp/cloudflared.deb
sudo dpkg -i /tmp/cloudflared.deb

# Авторизация в браузере
sudo cloudflared tunnel login

# Создать туннель
sudo cloudflared tunnel create domkrat
# → выведет UUID, например 12345678-...

# DNS routes (Cloudflare сам создаст CNAME записи).
# Прогнать для каждого домена, который уже добавлен в Cloudflare account.
# Сейчас тестовый домен — domcrat.uz (через «c»); domkrat.uz добавим позже.
for h in domcrat.uz www.domcrat.uz api.domcrat.uz merchant.domcrat.uz admin.domcrat.uz cdn.domcrat.uz; do
  sudo cloudflared tunnel route dns domkrat $h
done
# Позже, когда зона domkrat.uz появится в Cloudflare:
# for h in domkrat.uz www.domkrat.uz api.domkrat.uz merchant.domkrat.uz admin.domkrat.uz cdn.domkrat.uz; do
#   sudo cloudflared tunnel route dns domkrat $h
# done

# Пошаговый runbook именно для этого сервера и обоих доменов — docs/11-LAUNCH-DOMCRAT.md

# Конфиг
sudo mkdir -p /etc/cloudflared
sudo cp /opt/domkrat/infrastructure/cloudflared/config.example.yml /etc/cloudflared/config.yml
sudo sed -i 's/CHANGE_ME_TUNNEL_UUID/<вставить-UUID>/g' /etc/cloudflared/config.yml

# Запустить как сервис
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

После этого `https://domkrat.uz`, `https://api.domkrat.uz` etc. работают
через Cloudflare с автоматическим Let's Encrypt сертификатом.

---

## 8. Meilisearch первый индекс

```bash
# Залогиниться как super admin
TOKEN=$(curl -s -X POST https://api.domkrat.uz/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"super@domkrat.uz","password":"…"}' | jq -r .accessToken)

# Перестроить
curl -X POST https://api.domkrat.uz/api/v1/search/rebuild \
  -H "Authorization: Bearer $TOKEN"
```

---

## 9. Обновление кода (deploy)

```bash
cd /opt/domkrat
sudo -u domkrat git fetch && sudo -u domkrat git checkout main && sudo -u domkrat git pull
sudo -u domkrat pnpm install --frozen-lockfile
sudo -u domkrat pnpm build
sudo -u domkrat pnpm --filter @domkrat/api prisma migrate deploy
sudo systemctl restart domkrat-api domkrat-web domkrat-merchant domkrat-admin
```

---

## 10. Резервное копирование

### Postgres (ежедневно через cron)

```cron
# /etc/cron.d/domkrat-backup
0 3 * * * root docker exec domkrat-postgres pg_dump -U domkrat domkrat | \
  gzip > /opt/domkrat/backups/postgres-$(date +\%Y\%m\%d).sql.gz
```

Хранить 30 дней + копию в S3/Backblaze:

```bash
aws s3 cp /opt/domkrat/backups/ s3://domkrat-backups/ --recursive --include "*.sql.gz"
```

### MinIO

`mc mirror` либо `rclone sync` в холодное хранилище раз в неделю.

---

## 11. Чеклист безопасности

- [ ] Все CHANGE_ME заменены в `/etc/domkrat/*.env`
- [ ] JWT_SECRET ≥ 64 случайных символов
- [ ] Файлы env: chmod 640, owner root:domkrat
- [ ] Postgres / Redis / MinIO порты привязаны к 127.0.0.1, не публикуются
- [ ] UFW: только 22 (SSH key-only) + outbound. Никаких 80/443 — туннель.
- [ ] SSH password auth выключен (`PasswordAuthentication no`)
- [ ] fail2ban на SSH
- [ ] Cloudflare Access для `admin.domkrat.uz` (email allowlist)
- [ ] Sentry DSN заполнен (логирование ошибок в проде)
- [ ] Бэкап Postgres работает, восстановление проверено
- [ ] `HOLD_DAYS=7` (не 0!) в api.env

---

## 12. Мониторинг (минимум)

- **systemd**: `systemctl status` + `journalctl`
- **Cloudflare Analytics** — RPS, latency, ошибки на edge
- **Sentry** — application errors
- **Uptime Robot** или Cloudflare Health Check — пинг `https://api.domkrat.uz/api/v1/health`
- **Cron** для проверки бэкапов: alert если файл за сегодня < 1 МБ

---

## Troubleshooting

| Симптом                       | Причина / решение                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `502 Bad Gateway` на домене   | Сервис упал, проверь `journalctl -u domkrat-api -n 50`                                            |
| `cloudflared` не подключается | Проверь UUID в config.yml совпадает с `cloudflared tunnel list`                                   |
| Картинки не открываются       | Bucket policy `s3:GetObject` для `product/*` (StorageService это делает автоматически при старте) |
| Поиск отдаёт 0                | Запусти `/search/rebuild` после первого деплоя или больших изменений                              |
| Заказы не оплачиваются        | Проверь `PAYMENT_PROVIDERS` в api.env; для тестов оставь `mock,cod`                               |
