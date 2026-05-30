import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  FinancialTransactionType,
  ItemCondition,
  OrderStatus,
  Prisma,
  RefundStatus,
  ReturnStatus,
  TransactionDirection,
} from '@prisma/client';
import Decimal from 'decimal.js';

import { PrismaService } from '../../infrastructure/database/prisma.service';

import type { CreateReturnDto } from './dto/create-return.dto';

const RETURN_WINDOW_DAYS = 14;

const RETURN_INCLUDE = {
  order: { select: { orderNumber: true, userId: true, paymentMethod: true } },
  items: {
    include: {
      orderItem: {
        select: {
          id: true,
          productId: true,
          offerId: true,
          variantId: true,
          subOrderId: true,
          merchantId: true,
          unitPrice: true,
          subtotal: true,
          productSnapshot: true,
          quantity: true,
        },
      },
    },
  },
  refunds: true,
} satisfies Prisma.ReturnInclude;

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Customer создаёт заявку на возврат. */
  async createForOrder(userId: string, orderId: string, dto: CreateReturnDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: { select: { id: true, quantity: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');

    const eligible: OrderStatus[] = [
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
      OrderStatus.SHIPPED,
    ];
    if (!eligible.includes(order.status)) {
      throw new ConflictException(`Cannot return order in status ${order.status}`);
    }

    if (order.completedAt) {
      const days = (Date.now() - order.completedAt.getTime()) / 86400_000;
      if (days > RETURN_WINDOW_DAYS) {
        throw new ConflictException(`Return window of ${RETURN_WINDOW_DAYS} days has expired`);
      }
    }

    // Validate items
    const orderItemIds = new Set(order.items.map((i) => i.id));
    for (const it of dto.items) {
      if (!orderItemIds.has(it.orderItemId)) {
        throw new BadRequestException(`Order item ${it.orderItemId} not in this order`);
      }
      const orderItem = order.items.find((x) => x.id === it.orderItemId)!;
      if (it.quantity > orderItem.quantity) {
        throw new BadRequestException(
          `Quantity ${it.quantity} > ordered ${orderItem.quantity} for item ${it.orderItemId}`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const returnNumber = await this.nextReturnNumber(tx);

      // Calculate refund_amount
      const detailedItems = await tx.orderItem.findMany({
        where: { id: { in: dto.items.map((i) => i.orderItemId) } },
        select: { id: true, unitPrice: true },
      });
      const priceMap = new Map(
        detailedItems.map((d) => [d.id, new Decimal(d.unitPrice.toString())]),
      );
      let refundAmount = new Decimal(0);
      for (const it of dto.items) {
        const unit = priceMap.get(it.orderItemId)!;
        refundAmount = refundAmount.plus(unit.times(it.quantity));
      }

      const ret = await tx.return.create({
        data: {
          returnNumber,
          orderId,
          userId,
          reason: dto.reason,
          reasonDescription: dto.reasonDescription,
          status: ReturnStatus.REQUESTED,
          refundAmount: refundAmount.toString(),
          images: dto.images ?? [],
          pickupMethod: dto.pickupMethod,
          items: {
            create: dto.items.map((i) => ({
              orderItemId: i.orderItemId,
              quantity: i.quantity,
            })),
          },
        },
        include: RETURN_INCLUDE,
      });

      this.logger.log(`Return ${returnNumber} created for order ${order.orderNumber}`);
      return ret;
    });
  }

  listMine(userId: string) {
    return this.prisma.return.findMany({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
      include: { items: true, order: { select: { orderNumber: true } } },
    });
  }

  async getMine(userId: string, id: string) {
    const ret = await this.prisma.return.findFirst({
      where: { id, userId },
      include: RETURN_INCLUDE,
    });
    if (!ret) throw new NotFoundException('Return not found');
    return ret;
  }

  async cancel(userId: string, id: string) {
    const ret = await this.prisma.return.findFirst({ where: { id, userId } });
    if (!ret) throw new NotFoundException('Return not found');
    if (ret.status !== ReturnStatus.REQUESTED) {
      throw new ConflictException(`Cannot cancel return in status ${ret.status}`);
    }
    return this.prisma.return.update({
      where: { id },
      data: { status: ReturnStatus.REJECTED, rejectedReason: 'Cancelled by customer' },
    });
  }

  // ---- Admin ----
  listAll(filter: { status?: ReturnStatus; page?: number; perPage?: number }) {
    const page = filter.page ?? 1;
    const perPage = Math.min(filter.perPage ?? 20, 100);
    const where: Prisma.ReturnWhereInput = {};
    if (filter.status) where.status = filter.status;
    return Promise.all([
      this.prisma.return.findMany({
        where,
        include: {
          user: { select: { email: true, phone: true, firstName: true, lastName: true } },
          order: { select: { orderNumber: true, totalAmount: true } },
          items: true,
        },
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.return.count({ where }),
    ]).then(([data, total]) => ({
      data,
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    }));
  }

  async approve(id: string, adminId: string) {
    const ret = await this.prisma.return.findUnique({ where: { id } });
    if (!ret) throw new NotFoundException('Return not found');
    if (ret.status !== ReturnStatus.REQUESTED) {
      throw new ConflictException(`Cannot approve return in status ${ret.status}`);
    }
    return this.prisma.return.update({
      where: { id },
      data: {
        status: ReturnStatus.APPROVED,
        approvedAt: new Date(),
        approvedById: adminId,
      },
    });
  }

  async reject(id: string, adminId: string, reason: string) {
    if (!reason) throw new BadRequestException('Rejection reason required');
    const ret = await this.prisma.return.findUnique({ where: { id } });
    if (!ret) throw new NotFoundException('Return not found');
    const rejectableStatuses: ReturnStatus[] = [
      ReturnStatus.REQUESTED,
      ReturnStatus.RECEIVED,
      ReturnStatus.INSPECTING,
    ];
    if (!rejectableStatuses.includes(ret.status)) {
      throw new ConflictException(`Cannot reject return in status ${ret.status}`);
    }
    return this.prisma.return.update({
      where: { id },
      data: {
        status: ReturnStatus.REJECTED,
        rejectedReason: reason,
        approvedById: adminId,
      },
    });
  }

  /**
   * Полное возмещение: restock товара, возврат денег мерчанту, refund клиенту.
   * Для MVP refund записывается в refunds table, без реальной интеграции с провайдером
   * (real Click/Payme refund — Phase 2).
   */
  async complete(id: string, adminId: string, restocked: boolean) {
    const ret = await this.prisma.return.findUnique({
      where: { id },
      include: { items: { include: { orderItem: true } } },
    });
    if (!ret) throw new NotFoundException('Return not found');
    if (ret.status !== ReturnStatus.APPROVED && ret.status !== ReturnStatus.RECEIVED) {
      throw new ConflictException(`Cannot complete return in status ${ret.status}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const paymentRow = await tx.payment.findFirst({
        where: { orderId: ret.orderId, status: 'SUCCESS' },
        orderBy: { createdAt: 'desc' },
      });

      // Per-merchant: списать payout из pending/available, restock товаров
      const byMerchant = new Map<string, { payout: Decimal; commissionBack: Decimal }>();

      for (const ri of ret.items) {
        const merchantId = ri.orderItem.merchantId;
        const unitPrice = new Decimal(ri.orderItem.unitPrice.toString());
        const refundForItem = unitPrice.times(ri.quantity);
        const commissionRate = new Decimal('10'); // упрощение: фиксированная ставка
        const commission = refundForItem.times(commissionRate).dividedBy(100);
        const payout = refundForItem.minus(commission);

        const acc = byMerchant.get(merchantId) ?? {
          payout: new Decimal(0),
          commissionBack: new Decimal(0),
        };
        acc.payout = acc.payout.plus(payout);
        acc.commissionBack = acc.commissionBack.plus(commission);
        byMerchant.set(merchantId, acc);

        if (restocked) {
          await tx.inventoryBalance.updateMany({
            where: ri.orderItem.offerId
              ? { offerId: ri.orderItem.offerId, cellId: null }
              : { productId: ri.orderItem.productId, merchantId, cellId: null },
            data: { quantityAvailable: { increment: ri.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              productId: ri.orderItem.productId,
              offerId: ri.orderItem.offerId,
              variantId: ri.orderItem.variantId,
              merchantId,
              movementType: 'RETURN',
              quantity: ri.quantity,
              referenceType: 'return',
              referenceId: ret.id,
              performedById: adminId,
              notes: `Return ${ret.returnNumber} restocked`,
            },
          });
        }

        await tx.returnItem.update({
          where: { id: ri.id },
          data: {
            condition: restocked ? ItemCondition.NEW : ItemCondition.UNUSABLE,
            restocked,
          },
        });
      }

      // Списать с балансов мерчантов
      for (const [merchantId, acc] of byMerchant.entries()) {
        const balance = await tx.merchantBalance.findUnique({ where: { merchantId } });
        if (!balance) continue;
        const pending = new Decimal(balance.pendingBalance.toString());
        const available = new Decimal(balance.availableBalance.toString());

        let fromPending = Decimal.min(pending, acc.payout);
        let fromAvailable = acc.payout.minus(fromPending);
        if (fromAvailable.greaterThan(available)) {
          // Уходим в минус — для MVP допускаем
          fromAvailable = available;
        }
        const newPending = pending.minus(fromPending);
        const newAvailable = available.minus(fromAvailable);

        await tx.merchantBalance.update({
          where: { merchantId },
          data: {
            pendingBalance: newPending.toString(),
            availableBalance: newAvailable.toString(),
          },
        });

        await tx.financialTransaction.create({
          data: {
            merchantId,
            transactionType: FinancialTransactionType.REFUND,
            direction: TransactionDirection.DEBIT,
            amount: acc.payout.toString(),
            balanceAfter: newAvailable.toString(),
            referenceType: 'return',
            referenceId: ret.id,
            description: `Refund for ${ret.returnNumber}`,
            performedById: adminId,
          },
        });
      }

      // Refund запись (для real provider refund в Phase 2)
      if (paymentRow) {
        await tx.refund.create({
          data: {
            paymentId: paymentRow.id,
            returnId: ret.id,
            amount: ret.refundAmount,
            reason: `Return ${ret.returnNumber}`,
            status: RefundStatus.COMPLETED,
            processedAt: new Date(),
            processedById: adminId,
          },
        });
      }

      return tx.return.update({
        where: { id },
        data: {
          status: ReturnStatus.REFUNDED,
          receivedAt: ret.receivedAt ?? new Date(),
          refundedAt: new Date(),
        },
        include: RETURN_INCLUDE,
      });
    });
  }

  private async nextReturnNumber(tx: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `RET-${year}-`;
    const last = await tx.return.findFirst({
      where: { returnNumber: { startsWith: prefix } },
      orderBy: { returnNumber: 'desc' },
      select: { returnNumber: true },
    });
    const lastSeq = last ? Number(last.returnNumber.slice(prefix.length)) : 0;
    return `${prefix}${String(lastSeq + 1).padStart(5, '0')}`;
  }
}
