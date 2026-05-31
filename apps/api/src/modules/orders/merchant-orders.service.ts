import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';

const SUB_ORDER_INCLUDE = {
  order: {
    select: {
      orderNumber: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      deliveryMethod: true,
      deliveryAddressSnapshot: true,
      placedAt: true,
      paidAt: true,
      paymentMethod: true,
    },
  },
  items: {
    select: {
      id: true,
      productId: true,
      offerId: true,
      variantId: true,
      quantity: true,
      unitPrice: true,
      subtotal: true,
      status: true,
      pickedFromCellId: true,
      productSnapshot: true,
    },
  },
} satisfies Prisma.OrderSubOrderInclude;

/**
 * Чтение заказов мерчанта + подтверждение взятия в работу. Сборка/упаковка/отгрузка из ячеек
 * вынесены в PickingService (WMS-фаза 4): списание со склада происходит на этапе сборки.
 */
@Injectable()
export class MerchantOrdersService {
  private readonly logger = new Logger(MerchantOrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(
    merchantId: string,
    filter: { status?: OrderStatus; page?: number; perPage?: number },
  ) {
    const page = filter.page ?? 1;
    const perPage = Math.min(filter.perPage ?? 20, 100);

    const where: Prisma.OrderSubOrderWhereInput = { merchantId };
    if (filter.status) where.status = filter.status;

    const [items, total] = await Promise.all([
      this.prisma.orderSubOrder.findMany({
        where,
        include: SUB_ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.orderSubOrder.count({ where }),
    ]);

    return { data: items, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
  }

  async get(merchantId: string, subOrderId: string) {
    const sub = await this.prisma.orderSubOrder.findFirst({
      where: { id: subOrderId, merchantId },
      include: SUB_ORDER_INCLUDE,
    });
    if (!sub) throw new NotFoundException('Sub-order not found');
    return sub;
  }

  /** PAID → PROCESSING — мерчант подтверждает что взял заказ в работу. */
  confirm(merchantId: string, subOrderId: string, userId: string) {
    return this.transition(merchantId, subOrderId, userId, {
      from: [OrderStatus.PAID],
      to: OrderStatus.PROCESSING,
      timestampField: 'confirmedAt',
      reason: 'Merchant confirmed',
    });
  }

  // -------------------------------------------------------------------------
  private async transition(
    merchantId: string,
    subOrderId: string,
    userId: string,
    cfg: {
      from: OrderStatus[];
      to: OrderStatus;
      timestampField: 'confirmedAt' | 'assembledAt' | 'shippedAt' | 'completedAt';
      reason: string;
    },
  ) {
    const sub = await this.prisma.orderSubOrder.findUnique({
      where: { id: subOrderId },
      select: { id: true, orderId: true, merchantId: true, status: true },
    });
    if (!sub) throw new NotFoundException('Sub-order not found');
    if (sub.merchantId !== merchantId) throw new ForbiddenException('Not your sub-order');
    if (!cfg.from.includes(sub.status)) {
      throw new ConflictException(
        `Cannot transition from ${sub.status} to ${cfg.to}; expected from ${cfg.from.join('/')}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.orderSubOrder.update({
        where: { id: subOrderId },
        data: { status: cfg.to, [cfg.timestampField]: new Date() },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: sub.orderId,
          subOrderId,
          fromStatus: sub.status,
          toStatus: cfg.to,
          changedById: userId,
          changedByRole: 'MERCHANT',
          reason: cfg.reason,
        },
      });

      // Обновляем общий order.status, если все sub_orders в одинаковом статусе
      const allSubs = await tx.orderSubOrder.findMany({
        where: { orderId: sub.orderId },
        select: { status: true },
      });
      if (allSubs.every((s) => s.status === cfg.to)) {
        const orderTimestampField = cfg.to === OrderStatus.PROCESSING ? 'confirmedAt' : undefined;
        await tx.order.update({
          where: { id: sub.orderId },
          data: {
            status: cfg.to,
            ...(orderTimestampField ? { [orderTimestampField]: new Date() } : {}),
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: sub.orderId,
            fromStatus: 'partial',
            toStatus: cfg.to,
            changedByRole: 'SYSTEM',
            reason: `All sub-orders → ${cfg.to}`,
          },
        });
        this.logger.log(`Order ${sub.orderId} bumped to ${cfg.to} (all sub-orders aligned)`);
      }

      return updated;
    });
  }
}
