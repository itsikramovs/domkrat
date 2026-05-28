import { Global, Module } from '@nestjs/common';

import { NotificationsController } from './controllers/notifications.controller';
import { OrderEventsListener } from './listeners/order-events.listener';
import { WithdrawalEventsListener } from './listeners/withdrawal-events.listener';
import { EskizSmsProvider } from './providers/eskiz-sms.provider';
import { MockSmsProvider } from './providers/mock-sms.provider';
import { EmailService } from './services/email.service';
import { NotificationsFeedService } from './services/notifications-feed.service';
import { SmsService } from './services/sms.service';
import { TemplateRendererService } from './services/template-renderer.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [
    EmailService,
    SmsService,
    TemplateRendererService,
    MockSmsProvider,
    EskizSmsProvider,
    NotificationsFeedService,
    OrderEventsListener,
    WithdrawalEventsListener,
  ],
  exports: [EmailService, SmsService, TemplateRendererService],
})
export class NotificationsModule {}
