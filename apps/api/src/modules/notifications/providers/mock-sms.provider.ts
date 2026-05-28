import { Injectable, Logger } from '@nestjs/common';

import type { SmsProvider, SmsSendParams, SmsSendResult } from '../services/sms.provider.interface';

/**
 * Mock SMS provider — пишет в лог и возвращает success.
 * Активен по умолчанию для MVP (SMS_PROVIDER=mock в .env).
 * Реальные провайдеры (Eskiz, PlayMobile) подключаются заменой адаптера.
 */
@Injectable()
export class MockSmsProvider implements SmsProvider {
  public readonly name = 'mock';
  private readonly logger = new Logger(MockSmsProvider.name);

  send(params: SmsSendParams): Promise<SmsSendResult> {
    this.logger.log(`[MOCK SMS] to=${params.to} body=${params.body.substring(0, 120)}`);
    return Promise.resolve({ providerMessageId: `mock_${Date.now()}` });
  }
}
