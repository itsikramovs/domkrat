import { Global, Module } from '@nestjs/common';

import { OrderEventsListener } from './listeners/order-events.listener';
import { WithdrawalEventsListener } from './listeners/withdrawal-events.listener';
import { EskizSmsProvider } from './providers/eskiz-sms.provider';
import { MockSmsProvider } from './providers/mock-sms.provider';
import { EmailService } from './services/email.service';
import { SmsService } from './services/sms.service';
import { TemplateRendererService } from './services/template-renderer.service';

@Global()
@Module({
  providers: [
    EmailService,
    SmsService,
    TemplateRendererService,
    MockSmsProvider,
    EskizSmsProvider,
    OrderEventsListener,
    WithdrawalEventsListener,
  ],
  exports: [EmailService, SmsService, TemplateRendererService],
})
export class NotificationsModule {}
