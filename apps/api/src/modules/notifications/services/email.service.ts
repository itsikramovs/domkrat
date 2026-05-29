import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface EmailSendParams {
  to: string;
  subject: string;
  body: string; // plain text or HTML
  html?: boolean;
  userId?: string;
  templateCode?: string;
  language?: string;
}

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private transporter!: Transporter;
  private readonly from: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.from = config.get<string>('EMAIL_FROM') ?? 'Domkrat <noreply@domkrat.local>';
  }

  onModuleInit(): void {
    const transport = this.config.get<string>('EMAIL_TRANSPORT') ?? 'mailhog';
    if (transport === 'mailhog') {
      // MailHog: SMTP без TLS / без auth
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST') ?? 'localhost',
        port: Number(this.config.get<string>('SMTP_PORT') ?? 1025),
        secure: false,
        ignoreTLS: true,
      });
    } else {
      // Production SMTP. secure=true → implicit TLS (порт 465, как у mail.ru/yandex);
      // secure=false → STARTTLS (587). По умолчанию выводим из порта, можно переопределить SMTP_SECURE.
      const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
      const secure = (this.config.get<string>('SMTP_SECURE') ?? String(port === 465)) === 'true';
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST'),
        port,
        secure,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASSWORD'),
        },
      });
    }
    this.logger.log(`Email transport: ${transport}`);
  }

  async onModuleDestroy(): Promise<void> {
    this.transporter?.close();
  }

  async send(params: EmailSendParams): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        templateCode: params.templateCode ?? 'inline',
        channel: NotificationChannel.EMAIL,
        recipient: params.to,
        subject: params.subject,
        body: params.body,
        language: params.language ?? 'ru',
        status: NotificationStatus.PENDING,
      },
    });
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: params.to,
        subject: params.subject,
        [params.html ? 'html' : 'text']: params.body,
      });
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          metadata: { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected },
        },
      });
      this.logger.log(
        `Email sent to=${params.to} subject="${params.subject}" id=${info.messageId}`,
      );
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
