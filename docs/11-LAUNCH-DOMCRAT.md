# 🚀 Запуск на domcrat.uz — пошаговый runbook (этот сервер)

> Тестовый/первый домен — **domcrat.uz** (через «c»). Основной — **domkrat.uz** (через «k»)
> добавим позже; конфиги Cloudflare Tunnel и CORS уже содержат оба домена,
> отдельной правки кода не потребуется.
>
> Этот файл — практический runbook **для текущего сервера**
> (`/var/www/domkrat`, пользователь `samandar`, всё на одном хосте, выход наружу
> только через Cloudflare Tunnel). Общий/идеализированный гайд — `docs/09-DEPLOYMENT-PROD.md`.

---

## 0. Что уже сделано

- ✅ Домен `domcrat.uz` добавлен в Cloudflare, NS делегированы на Cloudflare.
- ✅ Конфиги в репозитории подготовлены под этот сервер:
  - `infrastructure/cloudflared/config.example.yml` — оба домена, 5 поддоменов каждый.
  - `apps/*/.env.production.example` — single-host (127.0.0.1), CORS обоих доменов,
    публичный MinIO через `cdn.domcrat.uz`.
  - `infrastructure/systemd/*.service` — `WorkingDirectory=/var/www/domkrat`, `User=samandar`.

## ⚠️ Решения до старта (нужно подтвердить)

1. **Демо-товары на тесте.** `prod-seed` создаёт только справочники + одного super admin —
   **каталог будет пустым**. Для теста на домене обычно нужны товары. Тогда вместо `prod-seed`
   запусти полный `db:seed` (104 товара + демо-аккаунты). ⚠️ Демо-аккаунты имеют известный пароль
   `Test1234!` — на публичном домене это допустимо только для теста; перед боевым запуском
   пересоздать БД через `prod-seed`.
2. **Email.** Верификация e-mail при регистрации шлёт письмо. Для теста проще поднять MailHog
   (как в dev) и смотреть письма на `127.0.0.1:8025`. Для боевого — реальный SMTP в `api.env`.
3. **Платежи.** Оставляем `PAYMENT_PROVIDERS=mock,cod` (реальные click/payme/uzum пока 501).

---

## 1. Инфраструктура (Docker, только на 127.0.0.1)

```bash
cd /var/www/domkrat

# infra-секреты
sudo install -m 0600 -o root -g root /dev/null /etc/domkrat/infra.env
sudo tee /etc/domkrat/infra.env >/dev/null <<EOF
POSTGRES_PASSWORD=$(openssl rand -base64 24)
REDIS_PASSWORD=$(openssl rand -base64 24)
MINIO_ROOT_USER=domkrat
MINIO_ROOT_PASSWORD=$(openssl rand -base64 32)
MEILI_MASTER_KEY=$(openssl rand -base64 48)
EOF
sudo cat /etc/domkrat/infra.env   # выписать значения — понадобятся в api.env

# если запущен dev-стек на тех же портах — остановить, чтобы не конфликтовать
docker compose -f docker-compose.dev.yml down

# поднять prod-инфру
sudo docker compose \
  -f infrastructure/docker/docker-compose.production.yml \
  --env-file /etc/domkrat/infra.env up -d

# (для теста) MailHog для просмотра писем верификации
docker run -d --name domkrat-mailhog --restart unless-stopped \
  -p 127.0.0.1:1025:1025 -p 127.0.0.1:8025:8025 mailhog/mailhog
```

## 2. Секреты приложения (api.env)

```bash
sudo install -m 0640 -o root -g samandar \
  apps/api/.env.production.example /etc/domkrat/api.env
sudoedit /etc/domkrat/api.env
```

Заполнить из `infra.env` и сгенерировать:

- `DATABASE_URL` — пароль = `POSTGRES_PASSWORD`
- `REDIS_URL` — пароль = `REDIS_PASSWORD`
- `MEILI_API_KEY` = `MEILI_MASTER_KEY`
- `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` = `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`
- `JWT_SECRET` = `openssl rand -base64 64` (≥64 символов, без слов change_me/secret/example/dev)
- `HOLD_DAYS=7`

> CORS уже включает оба домена. `HOST=127.0.0.1` — наружу только через туннель.

## 3. Env фронтов (инлайнятся при сборке!)

`NEXT_PUBLIC_*` вшиваются в бандл на этапе `pnpm build`, поэтому файлы кладём
**в каталоги приложений ДО сборки** — Next.js подхватит их автоматически:

```bash
cp apps/web/.env.production.example      apps/web/.env.production
cp apps/merchant/.env.production.example apps/merchant/.env.production
cp apps/admin/.env.production.example    apps/admin/.env.production
```

(Значения уже указывают на `https://api.domcrat.uz` / `https://domcrat.uz` — править не нужно.)

## 4. Сборка

```bash
cd /var/www/domkrat
pnpm install --frozen-lockfile
pnpm build      # соберёт api + 3 фронта; NEXT_PUBLIC_* возьмутся из .env.production
```

## 5. Миграции и данные

```bash
export DATABASE_URL="$(sudo grep ^DATABASE_URL /etc/domkrat/api.env | cut -d= -f2-)"
pnpm --filter @domkrat/api prisma migrate deploy

# Вариант A — ТЕСТ с товарами (демо-аккаунты, пароль Test1234!):
pnpm --filter @domkrat/api db:seed

# Вариант B — чистый прод (только справочники + super admin, каталог пустой):
SUPER_ADMIN_EMAIL=admin@domcrat.uz \
SUPER_ADMIN_PASSWORD="$(openssl rand -base64 24)" \
  pnpm --filter @domkrat/api prod-seed
# пароль показывается один раз — записать.
```

## 6. systemd

### 6a. user-systemd — ТЕКУЩИЙ способ (без sudo) ✅ ПРИМЕНЁН

На этом сервере `sudo` под паролем, поэтому сервисы (включая cloudflared) запущены
как **user-services** под `samandar`. Даёт авто-рестарт при падении + автозапуск при
ребуте (через linger), без root. Юниты — в `infrastructure/systemd/user/` (+ README).

```bash
mkdir -p ~/.config/systemd/user
cp infrastructure/systemd/user/domkrat-*.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now \
  domkrat-api domkrat-web domkrat-merchant domkrat-admin domkrat-cloudflared
loginctl enable-linger samandar      # переживать ребут (на этом сервере проходит без sudo)

# проверка
systemctl --user --no-legend list-units 'domkrat-*'
curl -s http://127.0.0.1:3001/api/v1/health   # → {"status":"ok"}
journalctl --user -u domkrat-api -f
```

> ⚠️ cloudflared тоже под user-systemd (`domkrat-cloudflared`), поэтому раздел 7
> ниже (ручной запуск туннеля / `cloudflared service install`) больше НЕ нужен —
> туннель уже locally-managed (креды `~/.cloudflared/`, ingress `~/.cloudflared/config.yml`).

### 6b. system-level systemd — когда появится sudo/root (альтернатива)

```bash
sudo cp infrastructure/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now domkrat-api domkrat-web domkrat-merchant domkrat-admin
sudo systemctl status domkrat-api
```

Предпочтительно на выделенном сервере с root. Тогда `loginctl enable-linger` не нужен;
cloudflared перенести на `sudo cloudflared service install`.

## 7. Cloudflare Tunnel — УЖЕ НАСТРОЕНО (раздел оставлен для истории / выделенного сервера)

> На текущем сервере туннель уже работает (locally-managed, под `domkrat-cloudflared`
> в user-systemd, см. §6a). Шаги ниже нужны только при настройке с нуля на другом
> сервере с sudo, либо для классической system-level установки.

```bash
# установить cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
  -o /tmp/cloudflared.deb
sudo dpkg -i /tmp/cloudflared.deb

sudo cloudflared tunnel login          # откроет браузер — выбрать зону domcrat.uz
sudo cloudflared tunnel create domkrat # выведет UUID

# DNS-routes для domcrat.uz (для domkrat.uz повторить позже, когда зона появится в Cloudflare)
for h in domcrat.uz www.domcrat.uz api.domcrat.uz merchant.domcrat.uz admin.domcrat.uz cdn.domcrat.uz; do
  sudo cloudflared tunnel route dns domkrat "$h"
done

# конфиг
sudo mkdir -p /etc/cloudflared
sudo cp infrastructure/cloudflared/config.example.yml /etc/cloudflared/config.yml
sudo sed -i 's/CHANGE_ME_TUNNEL_UUID/<вставить-UUID>/g' /etc/cloudflared/config.yml

sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

После этого работают:
`https://domcrat.uz`, `https://api.domcrat.uz/api/v1/health`,
`https://merchant.domcrat.uz`, `https://admin.domcrat.uz`, `https://cdn.domcrat.uz`.

## 8. Meilisearch — первый индекс

```bash
TOKEN=$(curl -s -X POST https://api.domcrat.uz/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@domcrat.uz","password":"…"}' | jq -r .accessToken)
curl -X POST https://api.domcrat.uz/api/v1/search/rebuild \
  -H "Authorization: Bearer $TOKEN"
```

## 9. Безопасность теста

- [ ] `admin.domcrat.uz` — закрыть через **Cloudflare Access** (email allowlist).
- [ ] Если сеяли демо-данные (Вариант A) — помнить про пароль `Test1234!`; перед боевым
      запуском пересоздать БД через `prod-seed`.
- [ ] UFW: входящих 80/443 не открывать — только туннель. SSH — по ключу.
- [ ] Sentry DSN заполнить, когда будет проект в Sentry.

---

## Когда добавляем основной домен domkrat.uz

1. Добавить зону `domkrat.uz` в Cloudflare, делегировать NS.
2. `for h in domkrat.uz www.domkrat.uz api.domkrat.uz merchant.domkrat.uz admin.domkrat.uz cdn.domkrat.uz; do sudo cloudflared tunnel route dns domkrat "$h"; done`
3. Перезапуск не нужен — ingress в `config.yml` уже содержит хосты domkrat.uz, CORS тоже.
4. Решить, какой домен канонический для SEO: поменять `NEXT_PUBLIC_SITE_URL` (и `NEXT_PUBLIC_API_URL`)
   в `apps/*/.env.production` на `domkrat.uz`, **пересобрать** фронты, перезапустить сервисы;
   на domcrat.uz настроить 301-редирект (Cloudflare Bulk Redirect / Rules) на domkrat.uz.
