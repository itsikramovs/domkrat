import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { Order, PaymentMethod, PaymentProviderStatus, PaymentStatus, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface PaymentInitiationResult {
  paymentId: string;
  status: PaymentProviderStatus;
  paymentUrl?: string;
  /** true — заказ нужно сразу пометить как paid (mock/COD) */
  immediatePaid: boolean;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Инициирует оплату заказа. Для MVP:
   *   - PaymentMethod.MOCK / COD — сразу success (immediatePaid=true)
   *   - PaymentMethod.CLICK / PAYME / UZUM — TODO заглушки, возвращают paymentUrl
   *     (реальная интеграция см. docs/08-INTEGRATIONS.md, задачи 3.6-3.8)
   */
  async initiate(order: Order): Promise<PaymentInitiationResult> {
    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        userId: order.userId,
        paymentMethod: order.paymentMethod,
        amount: order.totalAmount,
        currency: order.currency,
        status: PaymentProviderStatus.INITIATED,
        description: `Order ${order.orderNumber}`,
      },
    });

    switch (order.paymentMethod) {
      case PaymentMethod.MOCK:
      case PaymentMethod.COD: {
        // Сразу помечаем payment как SUCCESS
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentProviderStatus.SUCCESS,
            completedAt: new Date(),
            providerPaymentId: `${order.paymentMethod.toLowerCase()}_${payment.id}`,
          },
        });
        return {
          paymentId: payment.id,
          status: PaymentProviderStatus.SUCCESS,
          immediatePaid: true,
        };
      }
      case PaymentMethod.CLICK:
      case PaymentMethod.PAYME:
      case PaymentMethod.UZUM:
        // TODO Sprint 2: реальная интеграция, см. docs/08-INTEGRATIONS.md
        this.logger.warn(`Real payment provider ${order.paymentMethod} not implemented — TODO`);
        throw new NotImplementedException(
          `Payment provider ${order.paymentMethod} is not implemented yet. Use MOCK or COD for MVP.`,
        );
      case PaymentMethod.BANK_TRANSFER:
        throw new NotImplementedException('Bank transfer is for legal entities, Phase 3.');
    }
  }

  /** Сумма платежей для заказа со статусом SUCCESS. */
  async paidAmount(orderId: string): Promise<Decimal> {
    const result = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: { orderId, status: PaymentProviderStatus.SUCCESS },
    });
    return new Decimal((result._sum.amount ?? new Prisma.Decimal(0)).toString());
  }

  paymentStatusFromAmount(total: Decimal, paid: Decimal): PaymentStatus {
    if (paid.greaterThanOrEqualTo(total)) return PaymentStatus.PAID;
    if (paid.greaterThan(0)) return PaymentStatus.PARTIALLY_PAID;
    return PaymentStatus.UNPAID;
  }
}
