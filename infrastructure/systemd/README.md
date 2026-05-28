# Domkrat systemd units

Production-режим: Node-приложения запускаются как systemd-сервисы,
инфра (Postgres/Redis/Meili/MinIO) — в Docker.

## Установка

```bash
# 1. Скопировать unit-файлы
sudo cp infrastructure/systemd/*.service /etc/systemd/system/

# 2. Создать системного пользователя
sudo useradd --system --create-home --shell /bin/false domkrat

# 3. Развернуть код в /opt/domkrat (можно симлинком на git checkout)
sudo mkdir -p /opt/domkrat
sudo chown -R domkrat:domkrat /opt/domkrat

# 4. Положить env-файлы (chmod 600, владелец root:domkrat)
sudo install -m 0640 -o root -g domkrat \
  apps/api/.env.production.example /etc/domkrat/api.env
# … затем sudoedit /etc/domkrat/api.env и заполнить CHANGE_ME

# 5. Установить зависимости и собрать
cd /opt/domkrat
sudo -u domkrat pnpm install --frozen-lockfile --prod=false
sudo -u domkrat pnpm build

# 6. Запустить миграции и засеять
sudo -u domkrat pnpm --filter @domkrat/api prisma migrate deploy
sudo -u domkrat pnpm --filter @domkrat/api exec prisma db seed

# 7. Перестроить Meilisearch индекс
TOKEN=$(curl -s -X POST https://api.domkrat.uz/api/v1/auth/login \
  -d '{"email":"super@domkrat.uz","password":"…"}' \
  -H 'Content-Type: application/json' | jq -r .accessToken)
curl -X POST https://api.domkrat.uz/api/v1/search/rebuild \
  -H "Authorization: Bearer $TOKEN"

# 8. Включить и запустить сервисы
sudo systemctl daemon-reload
sudo systemctl enable --now domkrat-api domkrat-web domkrat-merchant domkrat-admin

# 9. Проверить статус и логи
sudo systemctl status domkrat-api
sudo journalctl -u domkrat-api -f
```

## Обновление кода

```bash
cd /opt/domkrat
sudo -u domkrat git pull
sudo -u domkrat pnpm install --frozen-lockfile
sudo -u domkrat pnpm build
sudo -u domkrat pnpm --filter @domkrat/api prisma migrate deploy
sudo systemctl restart domkrat-api domkrat-web domkrat-merchant domkrat-admin
```

## Альтернатива: PM2

См. `infrastructure/pm2/ecosystem.config.cjs`. PM2 даёт встроенный monitoring
и кластеризацию, но требует node global install. systemd проще и не требует
дополнительных инструментов.
