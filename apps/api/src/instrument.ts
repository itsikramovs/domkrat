// Sentry instrument — должен импортироваться первым в main.ts, до AppModule.
// Без SENTRY_DSN — no-op (init вообще не вызывается).
//
// Документация: https://docs.sentry.io/platforms/node/guides/nestjs/

import * as Sentry from '@sentry/nestjs';

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    profilesSampleRate: 0,
  });
}
