import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  OrderEvents,
  SubOrderEvents,
  type OrderEventPayload,
  type SubOrderEventPayload,
} from '../events';
import { EmailService } from '../services/email.service';
import { SmsService } from '../services/sms.service';
import { TemplateRendererService } from '../services/template-renderer.service';

@Injectable()
export class OrderEventsListener {
  private readonly logger = new Logger(OrderEventsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
    private readonly templates: TemplateRendererService,
  ) {}

  @OnEvent(OrderEvents.Created)
  async onOrderCreated(payload: OrderEventPayload): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user) return;
      const tpl = await this.templates.render('order_created', {
        orderNumber: payload.orderNumber,
        total: '?',
      });
      if (user.phone) {
        await this.sms.send({ to: user.phone, body: tpl.body, userId: user.id, templateCode: 'order_created' });
      }
    } catch (error) {
      this.logger.warn(`onOrderCreated failed: ${this.toMessage(error)}`);
    }
  }

  @OnEvent(OrderEvents.Paid)
  async onOrderPaid(payload: OrderEventPayload): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: payload.orderId },
        include: { subOrders: { include: { merchant: { select: { contactEmail: true, brandName: true } } } } },
      });
      if (!order) return;

      // Customer SMS
      if (order.customerPhone) {
        const tpl = await this.templates.render('order_paid', { orderNumber: order.orderNumber });
        await this.sms.send({
          to: order.customerPhone,
          body: tpl.body,
          userId: order.userId,
          templateCode: 'order_paid',
        });
      }

      // Email каждому мерчанту
      for (const sub of order.subOrders) {
        if (sub.merchant.contactEmail) {
          const tpl = await this.templates.render('merchant_new_order', {
            orderNumber: order.orderNumber,
          });
          await this.email.send({
            to: sub.merchant.contactEmail,
            subject: tpl.subject,
            body: tpl.body,
            templateCode: 'merchant_new_order',
          });
        }
      }
    } catch (error) {
      this.logger.warn(`onOrderPaid failed: ${this.toMessage(error)}`);
    }
  }

  @OnEvent(SubOrderEvents.Shipped)
  async onSubOrderShipped(payload: SubOrderEventPayload): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({ where: { id: payload.orderId } });
      if (!order || !order.customerPhone) return;
      const tpl = await this.templates.render('out_for_delivery', { orderNumber: order.orderNumber });
      await this.sms.send({
        to: order.customerPhone,
        body: tpl.body,
        userId: order.userId,
        templateCode: 'out_for_delivery',
      });
    } catch (error) {
      this.logger.warn(`onSubOrderShipped failed: ${this.toMessage(error)}`);
    }
  }

  @OnEvent(OrderEvents.Completed)
  async onOrderCompleted(payload: OrderEventPayload): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({ where: { id: payload.orderId } });
      if (!order) return;
      if (order.customerPhone) {
        const tpl = await this.templates.render('order_delivered', { orderNumber: order.orderNumber });
        await this.sms.send({
          to: order.customerPhone,
          body: tpl.body,
          userId: order.userId,
          templateCode: 'order_delivered',
        });
      }
    } catch (error) {
      this.logger.warn(`onOrderCompleted failed: ${this.toMessage(error)}`);
    }
  }

  private toMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
