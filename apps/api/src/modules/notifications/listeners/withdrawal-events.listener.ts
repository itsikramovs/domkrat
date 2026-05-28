import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { WithdrawalEvents, type WithdrawalEventPayload } from '../events';
import { EmailService } from '../services/email.service';
import { TemplateRendererService } from '../services/template-renderer.service';

@Injectable()
export class WithdrawalEventsListener {
  private readonly logger = new Logger(WithdrawalEventsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly templates: TemplateRendererService,
  ) {}

  @OnEvent(WithdrawalEvents.Completed)
  async onCompleted(payload: WithdrawalEventPayload): Promise<void> {
    try {
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: payload.merchantId },
        select: { brandName: true, contactEmail: true },
      });
      if (!merchant?.contactEmail) return;
      const tpl = await this.templates.render('withdrawal_completed', {
        amount: payload.amount,
      });
      await this.email.send({
        to: merchant.contactEmail,
        subject: tpl.subject,
        body: tpl.body,
        templateCode: 'withdrawal_completed',
      });
    } catch (error) {
      this.logger.warn(`onWithdrawalCompleted failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}
