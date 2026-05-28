import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationStatus } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EskizSmsProvider } from '../providers/eskiz-sms.provider';
import { MockSmsProvider } from '../providers/mock-sms.provider';

import type { SmsProvider, SmsSendParams } from './sms.provider.interface';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: SmsProvider;

  constructor(
    config: ConfigService,
    @Inject(MockSmsProvider) mock: MockSmsProvider,
    @Inject(EskizSmsProvider) eskiz: EskizSmsProvider,
    private readonly prisma: PrismaService,
  ) {
    const name = config.get<string>('SMS_PROVIDER') ?? 'mock';
    this.provider = name === 'eskiz' ? eskiz : mock;
    this.logger.log(`SMS provider: ${this.provider.name}`);
  }

  async send(params: SmsSendParams & { userId?: string; templateCode?: string; language?: string }): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        templateCode: params.templateCode ?? 'inline',
        channel: NotificationChannel.SMS,
        recipient: params.to,
        body: params.body,
        language: params.language ?? 'ru',
        status: NotificationStatus.PENDING,
      },
    });
    try {
      const result = await this.provider.send(params);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          metadata: result.rawResponse as object | undefined,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.FAILED, errorMessage: message },
      });
      throw error;
    }
  }
}
