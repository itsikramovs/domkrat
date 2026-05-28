import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderItemStatus, OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SubOrderEvents, type SubOrderEventPayload } from '../notifications/events';

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
      quantity: true,
      unitPrice: true,
      subtotal: true,
      status: true,
      productSnapshot: true,
    },
  },
} satisfies Prisma.OrderSubOrderInclude;

@Injectable()
export class MerchantOrdersService {
  private readonly logger = new Logger(MerchantOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

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

  /** PROCESSING → ASSEMBLED — товар собран, готов к отгрузке. */
  ready(merchantId: string, subOrderId: string, userId: string) {
    return this.transition(merchantId, subOrderId, userId, {
      from: [OrderStatus.PROCESSING],
      to: OrderStatus.ASSEMBLED,
      timestampField: 'assembledAt',
      reason: 'Sub-order assembled',
      itemStatus: OrderItemStatus.PICKED,
    });
  }

  /** ASSEMBLED → SHIPPED — передан в доставку. */
  ship(merchantId: string, subOrderId: string, userId: string) {
    return this.transition(merchantId, subOrderId, userId, {
      from: [OrderStatus.ASSEMBLED],
      to: OrderStatus.SHIPPED,
      timestampField: 'shippedAt',
      reason: 'Sub-order shipped',
      itemStatus: OrderItemStatus.SHIPPED,
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
      itemStatus?: OrderItemStatus;
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

      if (cfg.itemStatus) {
        await tx.orderItem.updateMany({
          where: { subOrderId },
          data: { status: cfg.itemStatus, ...(cfg.itemStatus === OrderItemStatus.PICKED ? { pickedAt: new Date(), pickedById: userId } : {}) },
        });
      }

      // Если ASSEMBLED/SHIPPED — списать stock_reservation для shipping
      if (cfg.to === OrderStatus.SHIPPED) {
        const items = await tx.orderItem.findMany({
          where: { subOrderId },
          select: { productId: true, merchantId: true, quantity: true },
        });
        for (const it of items) {
          await tx.inventoryBalance.updateMany({
            where: { productId: it.productId, merchantId: it.merchantId, cellId: null },
            data: { quantityReserved: { decrement: it.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              productId: it.productId,
              merchantId: it.merchantId,
              movementType: 'SHIPMENT',
              quantity: -it.quantity,
              referenceType: 'sub_order',
              referenceId: subOrderId,
              performedById: userId,
              notes: cfg.reason,
            },
          });
        }
        await tx.stockReservation.updateMany({
          where: { orderItem: { subOrderId }, releasedAt: null },
          data: { releasedAt: new Date(), releasedReason: 'shipped' },
        });
      }

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
      const allSame = allSubs.every((s) => s.status === cfg.to);
      if (allSame) {
        const orderTimestampField =
          cfg.to === OrderStatus.PROCESSING ? 'confirmedAt' :
          cfg.to === OrderStatus.SHIPPED ? 'shippedAt' : undefined;

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
    }).then((result) => {
      if (cfg.to === OrderStatus.SHIPPED) {
        this.events.emit(SubOrderEvents.Shipped, {
          subOrderId,
          subOrderNumber: result.subOrderNumber,
          orderId: result.orderId,
          merchantId: result.merchantId,
        } satisfies SubOrderEventPayload);
      }
      return result;
    });
  }
}
