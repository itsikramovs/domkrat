// Sentry должен импортироваться первым — до создания любого модуля приложения.
import './instrument';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

// BigInt не сериализуется в JSON по умолчанию — наши BIGSERIAL PK
// (stock_movements, audit_logs, order_status_history) ломали бы /orders/:id.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function (this: bigint): string {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const port = Number(config.get<string>('PORT') ?? 3001);
  const host = config.get<string>('HOST') ?? '0.0.0.0';
  const corsOrigins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // Safety checks для production: ловим опасные дефолты до того, как сервис начнёт обслуживать трафик
  if (config.get<string>('NODE_ENV') === 'production') {
    const holdDays = Number(config.get<string>('HOLD_DAYS') ?? 7);
    if (!Number.isFinite(holdDays) || holdDays < 1) {
      throw new Error(
        `HOLD_DAYS must be >= 1 in production (got "${config.get<string>('HOLD_DAYS')}"). ` +
          'Удержание средств мерчанта на 0 дней означает мгновенную выплату до возможности возврата.',
      );
    }
    const jwtSecret = config.get<string>('JWT_SECRET') ?? '';
    if (jwtSecret.length < 32 || /change_?me|secret|example|dev/i.test(jwtSecret)) {
      throw new Error('JWT_SECRET must be a strong random string (>= 32 chars, not a placeholder)');
    }
    if (corsOrigins.length === 0) {
      throw new Error('CORS_ORIGINS must be explicitly set in production (no wildcard)');
    }
    if (
      corsOrigins.some(
        (o) => o.includes('localhost') || o.includes('127.0.0.1') || o.includes('192.168'),
      )
    ) {
      throw new Error(`CORS_ORIGINS contains a dev host in production: ${corsOrigins.join(', ')}`);
    }
  }

  app.setGlobalPrefix('api/v1');

  // Безопасные HTTP-заголовки (XSS, MIME-sniffing, frame-injection и т.д.).
  // CSP отключаем — у нас API + Swagger UI, политика отдельная для frontend.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Domkrat API')
    .setDescription('REST API маркетплейса автотоваров «Домкрат»')
    .setVersion('0.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`Domkrat API listening on http://${host}:${port}/api/v1`);
}

void bootstrap();
