/**
 * PM2 ecosystem — альтернатива systemd.
 * Запуск: pm2 start infrastructure/pm2/ecosystem.config.cjs --env production
 * Сохранить: pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'domkrat-api',
      cwd: 'apps/api',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      env: { NODE_ENV: 'production' },
      env_file: '/etc/domkrat/api.env',
    },
    {
      name: 'domkrat-web',
      cwd: 'apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 127.0.0.1 -p 3000',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      env_file: '/etc/domkrat/web.env',
    },
    {
      name: 'domkrat-merchant',
      cwd: 'apps/merchant',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 127.0.0.1 -p 3002',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      env_file: '/etc/domkrat/merchant.env',
    },
    {
      name: 'domkrat-admin',
      cwd: 'apps/admin',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 127.0.0.1 -p 3003',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      env_file: '/etc/domkrat/admin.env',
    },
  ],
};
