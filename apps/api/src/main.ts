import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  app.setGlobalPrefix('api/v1');

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
