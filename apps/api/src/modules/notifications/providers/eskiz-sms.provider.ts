import { Injectable, Logger } from '@nestjs/common';

import type { SmsProvider, SmsSendParams, SmsSendResult } from '../services/sms.provider.interface';

/**
 * Eskiz SMS provider — заглушка для будущей интеграции (см. docs/08-INTEGRATIONS.md).
 * Активируется через SMS_PROVIDER=eskiz и переменные ESKIZ_EMAIL/ESKIZ_PASSWORD/...
 *
 * TODO Sprint 2+: полноценная реализация с авто-обновлением токена + retry/circuit breaker.
 */
@Injectable()
export class EskizSmsProvider implements SmsProvider {
  public readonly name = 'eskiz';
  private readonly logger = new Logger(EskizSmsProvider.name);

  send(params: SmsSendParams): Promise<SmsSendResult> {
    this.logger.warn(`Eskiz provider не реализован, fallback к no-op. to=${params.to}`);
    throw new Error('Eskiz provider not implemented yet — use SMS_PROVIDER=mock');
  }
}
