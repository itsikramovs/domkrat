import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DeliveryMethodType,
  FulfillmentType,
  MerchantType,
  OrderItemStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductStatus,
} from '@prisma/client';
import Decimal from 'decimal.js';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PricingService } from '../cart/pricing.service';
import { OrderEvents, type OrderEventPayload } from '../notifications/events';
import { PromoCodesService, type PromoEvaluation } from '../promo-codes/promo-codes.service';

import type { CreateOrderDto } from './dto/create-order.dto';
import { OrderNumberingService } from './order-numbering.service';
import { PaymentsService } from './payments.service';

const RESERVATION_TTL_MINUTES = 15;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly numbering: OrderNumberingService,
    private readonly payments: PaymentsService,
    private readonly events: EventEmitter2,
    private readonly promoCodes: PromoCodesService,
  ) {}

  // -------------------------------------------------------------------------
  /** Создание заказа из корзины пользователя. */
  async createFromCart(userId: string, dto: CreateOrderDto) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            offer: {
              include: {
                merchant: { select: { merchantType: true, commissionRate: true } },
                variant: { select: { id: true, name: true } },
                product: {
                  select: {
                    id: true,
                    categoryId: true,
                    slug: true,
                    name: true,
                    oemNumber: true,
                    status: true,
                    deletedAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }
    // Каждая позиция корзины должна иметь актуальное предложение продавца.
    type LiveItem = (typeof cart.items)[number] & {
      offer: NonNullable<(typeof cart.items)[number]['offer']>;
    };
    const liveItems = cart.items.filter((i): i is LiveItem => i.offer !== null);
    if (liveItems.length !== cart.items.length) {
      throw new ConflictException('Some items are no longer available');
    }

    // Проверка адреса доставки
    if (dto.deliveryMethod !== DeliveryMethodType.SELF_PICKUP) {
      if (!dto.deliveryAddressId) {
        throw new BadRequestException('deliveryAddressId is required for non-pickup delivery');
      }
      const addr = await this.prisma.userAddress.findFirst({
        where: { id: dto.deliveryAddressId, userId, deletedAt: null },
      });
      if (!addr) throw new ForbiddenException('Address is not yours or does not exist');
    }

    // Проверка предложений: карточка ACTIVE и предложение ACTIVE
    for (const item of liveItems) {
      if (
        item.offer.deletedAt ||
        item.offer.status !== 'ACTIVE' ||
        item.offer.product.deletedAt ||
        item.offer.product.status !== ProductStatus.ACTIVE
      ) {
        throw new ConflictException(`Offer ${item.offer.sku} is no longer available`);
      }
    }

    // Профиль пользователя для snapshot
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const orderNumber = await this.numbering.nextOrderNumber();

    // Промокод: источник истины — корзина; dto.promoCode как fallback (обратная совместимость).
    // Скидка финансируется платформой: payout/комиссия мерчанта считаются на gross (без скидки).
    const promoCodeRaw = cart.promoCode ?? dto.promoCode;
    let promoEvaluation: PromoEvaluation | null = null;
    if (promoCodeRaw) {
      promoEvaluation = await this.promoCodes.evaluate(
        promoCodeRaw,
        userId,
        liveItems.map((i) => ({
          categoryId: i.offer.product.categoryId,
          merchantId: i.offer.merchantId,
          lineSubtotal: new Decimal(i.offer.price.toString()).times(i.quantity),
        })),
      );
      if (!promoEvaluation.valid) {
        throw new BadRequestException(promoEvaluation.message ?? 'Promo code is not valid');
      }
    }

    // Базовая стоимость доставки (TODO: брать из delivery_method_zones)
    const deliveryCost =
      dto.deliveryMethod === DeliveryMethodType.SELF_PICKUP ? new Decimal(0) : new Decimal(25000);

    const breakdown = this.pricing.calculate(
      liveItems.map((i) => ({
        unitPrice: i.offer.price,
        quantity: i.quantity,
        vatRate: i.offer.vatRate,
      })),
      { deliveryCost, discount: promoEvaluation?.discount },
    );

    // Snapshot адреса
    const addressSnapshot = dto.deliveryAddressId
      ? await this.prisma.userAddress.findUnique({ where: { id: dto.deliveryAddressId } })
      : null;

    // Группировка позиций по merchant_id предложения для sub_orders
    const itemsByMerchant = new Map<string, typeof liveItems>();
    for (const item of liveItems) {
      const arr = itemsByMerchant.get(item.offer.merchantId) ?? [];
      arr.push(item);
      itemsByMerchant.set(item.offer.merchantId, arr);
    }

    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60_000);

    const order = await this.prisma.$transaction(async (tx) => {
      // Создаём базовый Order
      const orderRow = await tx.order.create({
        data: {
          orderNumber,
          userId,
          customerEmail: user.email,
          customerPhone: user.phone,
          customerName: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Customer',
          status: OrderStatus.CREATED,
          paymentStatus: PaymentStatus.UNPAID,
          subtotal: breakdown.subtotal.toString(),
          discountAmount: breakdown.discount.toString(),
          deliveryCost: breakdown.deliveryCost.toString(),
          totalAmount: breakdown.total.toString(),
          vatAmount: breakdown.vatAmount.toString(),
          deliveryMethod: dto.deliveryMethod,
          deliveryAddressId: dto.deliveryAddressId,
          deliveryAddressSnapshot: addressSnapshot as unknown as Prisma.InputJsonValue,
          pickupPointId: dto.pickupPointId,
          paymentMethod: dto.paymentMethod,
          promoCode: promoEvaluation?.code ?? null,
          customerNotes: dto.customerNotes,
          isLegalEntity: dto.isLegalEntity ?? false,
          taxId: dto.taxId,
          language: user.preferredLanguage,
        },
      });

      let merchantIndex = 0;
      for (const [merchantId, items] of itemsByMerchant.entries()) {
        const subOrderNumber = await this.numbering.nextSubOrderNumber(orderNumber, merchantIndex);
        merchantIndex++;

        const subSubtotal = items.reduce(
          (acc, i) => acc.plus(new Decimal(i.offer.price.toString()).times(i.quantity)),
          new Decimal(0),
        );
        const commissionRate = new Decimal(
          items[0]!.offer.merchant.commissionRate?.toString() ?? '10',
        );
        const commissionAmount = subSubtotal.times(commissionRate).dividedBy(100);
        const merchantPayout = subSubtotal.minus(commissionAmount);
        const fulfillmentType =
          items[0]!.offer.merchant.merchantType === MerchantType.TYPE_1
            ? FulfillmentType.FBO
            : FulfillmentType.FBS;

        const sub = await tx.orderSubOrder.create({
          data: {
            orderId: orderRow.id,
            merchantId,
            subOrderNumber,
            status: OrderStatus.CREATED,
            subtotal: subSubtotal.toString(),
            commissionAmount: commissionAmount.toString(),
            merchantPayout: merchantPayout.toString(),
            fulfillmentType,
          },
        });

        // OrderItems со snapshot предложения/карточки
        for (const item of items) {
          const offer = item.offer;
          const unit = new Decimal(offer.price.toString());
          const itemSubtotal = unit.times(item.quantity);
          const vatRate = new Decimal(offer.vatRate.toString());
          const vatAmount = itemSubtotal.times(vatRate).dividedBy(100);
          const itemCommission = itemSubtotal.times(commissionRate).dividedBy(100);

          const orderItem = await tx.orderItem.create({
            data: {
              orderId: orderRow.id,
              subOrderId: sub.id,
              productId: offer.productId,
              offerId: offer.id,
              variantId: offer.variantId,
              merchantId,
              productSnapshot: {
                sku: offer.sku,
                name: offer.product.name,
                slug: offer.product.slug,
                price: offer.price.toString(),
                oemNumber: offer.product.oemNumber,
                variantLabel: offer.variant?.name ?? null,
                offerId: offer.id,
              } as Prisma.InputJsonValue,
              quantity: item.quantity,
              unitPrice: unit.toString(),
              subtotal: itemSubtotal.toString(),
              vatRate: vatRate.toString(),
              vatAmount: vatAmount.toString(),
              commissionRate: commissionRate.toString(),
              commissionAmount: itemCommission.toString(),
              status: OrderItemStatus.RESERVED,
            },
          });

          // Atomic decrement остатка предложения (агрегат cellId=null).
          // Если другая транзакция уже забрала — updated.count = 0 → throw → rollback.
          const updated = await tx.inventoryBalance.updateMany({
            where: {
              offerId: offer.id,
              cellId: null,
              quantityAvailable: { gte: item.quantity },
            },
            data: {
              quantityAvailable: { decrement: item.quantity },
              quantityReserved: { increment: item.quantity },
            },
          });
          if (updated.count === 0) {
            throw new ConflictException(
              `Insufficient stock for ${offer.sku} (requested ${item.quantity})`,
            );
          }

          await tx.stockReservation.create({
            data: {
              orderItemId: orderItem.id,
              productId: offer.productId,
              offerId: offer.id,
              variantId: offer.variantId,
              merchantId,
              quantity: item.quantity,
              expiresAt,
            },
          });

          // Append-only audit запись о движении
          await tx.stockMovement.create({
            data: {
              productId: offer.productId,
              offerId: offer.id,
              variantId: offer.variantId,
              merchantId,
              movementType: 'RESERVE',
              quantity: -item.quantity,
              referenceType: 'order',
              referenceId: orderRow.id,
              performedById: userId,
              notes: `Reserved for order ${orderNumber}`,
            },
          });
        }
      }

      // Логирование переходов статуса
      await tx.orderStatusHistory.create({
        data: {
          orderId: orderRow.id,
          fromStatus: '',
          toStatus: OrderStatus.CREATED,
          changedById: userId,
          changedByRole: 'CUSTOMER',
          reason: 'Order placed',
        },
      });

      // Атомарно фиксируем использование промокода (защита от гонки за последнее использование)
      if (promoEvaluation?.valid && promoEvaluation.promoCodeId) {
        await this.promoCodes.recordUsage(tx, {
          promoCodeId: promoEvaluation.promoCodeId,
          userId,
          orderId: orderRow.id,
          discountAmount: promoEvaluation.discount,
        });
      }

      // Очищаем корзину (включая снятый промокод)
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({ where: { id: cart.id }, data: { promoCode: null } });

      return orderRow;
    });

    this.logger.log(`Order ${orderNumber} created for user=${userId}`);
    this.events.emit(OrderEvents.Created, {
      orderId: order.id,
      orderNumber,
      userId,
    } satisfies OrderEventPayload);
    return this.getById(userId, order.id);
  }

  // -------------------------------------------------------------------------
  /** Инициирует оплату; для MOCK/COD сразу переводит заказ в PAID. */
  async initiatePayment(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.CREATED) {
      throw new ConflictException(`Order is in status ${order.status}, cannot pay`);
    }

    const result = await this.payments.initiate(order);

    if (result.immediatePaid) {
      await this.markPaid(order.id);
      this.events.emit(OrderEvents.Paid, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId,
      } satisfies OrderEventPayload);
    }

    return {
      paymentId: result.paymentId,
      status: result.status,
      paymentUrl: result.paymentUrl,
      orderStatus: result.immediatePaid ? OrderStatus.PAID : OrderStatus.CREATED,
      paymentStatus: result.immediatePaid ? PaymentStatus.PAID : PaymentStatus.PENDING,
    };
  }

  // -------------------------------------------------------------------------
  async listMine(userId: string, page = 1, perPage = 20) {
    const where: Prisma.OrderWhereInput = { userId };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        include: {
          items: { take: 5, include: { product: { select: { name: true, slug: true } } } },
          subOrders: { select: { id: true, merchantId: true, status: true } },
        },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data: items, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
  }

  async getById(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: { include: { product: { select: { name: true, slug: true } } } },
        subOrders: true,
        payments: { orderBy: { createdAt: 'desc' } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async cancel(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Order not found');

    const cancellableStatuses: OrderStatus[] = [
      OrderStatus.CREATED,
      OrderStatus.PAID,
      OrderStatus.PROCESSING,
    ];
    if (!cancellableStatuses.includes(order.status)) {
      throw new ConflictException(`Cannot cancel order in status ${order.status}`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Восстанавливаем остатки: для каждого item инвертируем decrement
      const items = await tx.orderItem.findMany({
        where: { orderId },
        select: {
          id: true,
          productId: true,
          offerId: true,
          variantId: true,
          merchantId: true,
          quantity: true,
        },
      });
      for (const it of items) {
        // Возврат остатка по предложению (агрегат cellId=null).
        await tx.inventoryBalance.updateMany({
          where: it.offerId
            ? { offerId: it.offerId, cellId: null }
            : { productId: it.productId, merchantId: it.merchantId, cellId: null },
          data: {
            quantityAvailable: { increment: it.quantity },
            quantityReserved: { decrement: it.quantity },
          },
        });
        await tx.stockMovement.create({
          data: {
            productId: it.productId,
            offerId: it.offerId,
            variantId: it.variantId,
            merchantId: it.merchantId,
            movementType: 'UNRESERVE',
            quantity: it.quantity,
            referenceType: 'order',
            referenceId: orderId,
            performedById: userId,
            notes: 'Order cancelled',
          },
        });
      }

      // Снимаем активные резервы
      await tx.stockReservation.updateMany({
        where: { orderItem: { orderId }, releasedAt: null },
        data: { releasedAt: new Date(), releasedReason: 'order_cancelled' },
      });

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: 'Cancelled by customer',
        },
      });

      await tx.orderSubOrder.updateMany({
        where: { orderId },
        data: { status: OrderStatus.CANCELLED },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.CANCELLED,
          changedById: userId,
          changedByRole: 'CUSTOMER',
          reason: 'Cancelled by customer',
        },
      });
      return updated;
    });
  }

  // -------------------------------------------------------------------------
  /** Customer подтверждает получение: SHIPPED/DELIVERED → COMPLETED + credit мерчантов. */
  async confirmReceipt(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { subOrders: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const allowed: OrderStatus[] = [
      OrderStatus.SHIPPED,
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.DELIVERED,
    ];
    if (!allowed.includes(order.status)) {
      throw new ConflictException(`Cannot confirm receipt from ${order.status}`);
    }

    return this.prisma
      .$transaction(async (tx) => {
        // Кредит pending_balance каждому мерчанту
        for (const sub of order.subOrders) {
          const payout = new Decimal(sub.merchantPayout.toString());
          const commission = new Decimal(sub.commissionAmount.toString());

          const balance = await tx.merchantBalance.upsert({
            where: { merchantId: sub.merchantId },
            update: {},
            create: { merchantId: sub.merchantId },
          });

          const newPending = new Decimal(balance.pendingBalance.toString()).plus(payout);
          const newTotalEarned = new Decimal(balance.totalEarned.toString()).plus(payout);
          const newTotalCommission = new Decimal(balance.totalCommissionPaid.toString()).plus(
            commission,
          );

          await tx.merchantBalance.update({
            where: { merchantId: sub.merchantId },
            data: {
              pendingBalance: newPending.toString(),
              totalEarned: newTotalEarned.toString(),
              totalCommissionPaid: newTotalCommission.toString(),
            },
          });

          await tx.financialTransaction.create({
            data: {
              merchantId: sub.merchantId,
              transactionType: 'SALE',
              direction: 'CREDIT',
              amount: payout.toString(),
              balanceAfter: newPending.toString(),
              referenceType: 'sub_order',
              referenceId: sub.id,
              description: `Sale ${sub.subOrderNumber} → pending (7d hold)`,
            },
          });

          await tx.financialTransaction.create({
            data: {
              merchantId: sub.merchantId,
              transactionType: 'COMMISSION',
              direction: 'DEBIT',
              amount: commission.toString(),
              balanceAfter: newPending.toString(),
              referenceType: 'sub_order',
              referenceId: sub.id,
              description: `Platform commission for ${sub.subOrderNumber}`,
            },
          });

          await tx.orderSubOrder.update({
            where: { id: sub.id },
            data: { status: OrderStatus.COMPLETED, completedAt: new Date() },
          });
        }

        const updated = await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.COMPLETED,
            completedAt: new Date(),
            deliveredAt: order.deliveredAt ?? new Date(),
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: order.status,
            toStatus: OrderStatus.COMPLETED,
            changedById: userId,
            changedByRole: 'CUSTOMER',
            reason: 'Customer confirmed receipt — credited merchants (pending, 7d hold)',
          },
        });

        this.logger.log(
          `Order ${order.orderNumber} COMPLETED; credited ${order.subOrders.length} sub-orders to pending balances`,
        );
        return updated;
      })
      .then((result) => {
        this.events.emit(OrderEvents.Completed, {
          orderId,
          orderNumber: order.orderNumber,
          userId,
        } satisfies OrderEventPayload);
        return result;
      });
  }

  // -------------------------------------------------------------------------
  /** Внутренний переход CREATED → PAID после успешного платежа. */
  private async markPaid(orderId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) return;

      const paid = await this.payments.paidAmount(orderId);
      const total = new Decimal(order.totalAmount.toString());
      const newPaymentStatus = this.payments.paymentStatusFromAmount(total, paid);

      // Подтверждаем резервы (стирая expiresAt — резерв уже не временный)
      await tx.stockReservation.updateMany({
        where: { orderItem: { orderId }, releasedAt: null },
        data: { expiresAt: null },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PAID,
          paymentStatus: newPaymentStatus,
          paidAt: new Date(),
          paidAmount: paid.toString(),
        },
      });
      await tx.orderSubOrder.updateMany({
        where: { orderId },
        data: { status: OrderStatus.PAID },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: OrderStatus.CREATED,
          toStatus: OrderStatus.PAID,
          changedByRole: 'SYSTEM',
          reason: `Payment ${order.paymentMethod} success`,
        },
      });
    });
  }
}
