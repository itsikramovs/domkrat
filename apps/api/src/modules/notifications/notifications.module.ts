import { Global, Module } from '@nestjs/common';

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
  ],
  exports: [EmailService, SmsService, TemplateRendererService],
})
export class NotificationsModule {}
