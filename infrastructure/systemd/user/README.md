# user-systemd юниты (БЕЗ sudo) — ТЕКУЩИЙ способ запуска на этом сервере

На домашнем сервере `sudo` требует пароль, поэтому system-level systemd
(`/etc/systemd/system/`, файлы в каталоге уровнем выше) применить нельзя.
Вместо этого сервисы запущены как **user-services** под пользователем `samandar` —
это не требует sudo и при включённом _linger_ переживает ребут.

Что даёт user-systemd vs. голый `setsid`:

- ✅ авто-рестарт при падении (`Restart=always`);
- ✅ автозапуск при загрузке сервера (через `loginctl enable-linger`);
- ✅ нормальные логи в journal (`journalctl --user -u domkrat-api`);
- ✅ единое управление (`systemctl --user restart domkrat-*`).

## Состав

| Unit                          | Порт | Команда                                                   |
| ----------------------------- | ---- | --------------------------------------------------------- |
| `domkrat-api.service`         | 3001 | `node --env-file=…/apps/api/.env.production dist/main.js` |
| `domkrat-web.service`         | 3000 | `next start -H 127.0.0.1 -p 3000`                         |
| `domkrat-merchant.service`    | 3002 | `next start -H 127.0.0.1 -p 3002`                         |
| `domkrat-admin.service`       | 3003 | `next start -H 127.0.0.1 -p 3003`                         |
| `domkrat-cloudflared.service` | —    | `cloudflared … tunnel run <uuid>`                         |

API получает все переменные через `node --env-file` (dotenv-совместимо, минует
особенности парсинга `EnvironmentFile` в systemd). Фронты используют
`Environment=NODE_ENV=production`, а `next start` сам подхватывает
`apps/<app>/.env.production` (там `INTERNAL_API_URL`). `NEXT_PUBLIC_*` уже вшиты в
бандл на этапе `pnpm build`.

## Установка (с нуля)

```bash
mkdir -p ~/.config/systemd/user
cp infrastructure/systemd/user/domkrat-*.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now \
  domkrat-api domkrat-web domkrat-merchant domkrat-admin domkrat-cloudflared

# Переживать ребут (запускается без sudo на этом сервере):
loginctl enable-linger samandar
```

## Управление

```bash
systemctl --user status domkrat-api
systemctl --user restart domkrat-web
journalctl --user -u domkrat-api -f
systemctl --user --no-legend list-units 'domkrat-*'
```

## После деплоя кода

```bash
cd /var/www/domkrat
git pull
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @domkrat/api prisma migrate deploy
systemctl --user restart domkrat-api domkrat-web domkrat-merchant domkrat-admin
```

## Когда появится sudo / выделенный сервер

Каталогом выше лежат **system-level** юниты (`User=samandar`, `WantedBy=multi-user.target`)
для классической установки в `/etc/systemd/system/`. Это предпочтительный способ для
production-сервера с доступом root. Тогда `loginctl enable-linger` не нужен.
