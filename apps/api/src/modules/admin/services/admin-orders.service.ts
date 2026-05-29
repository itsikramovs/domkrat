import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';

/** Статусы, которые администратор может выставлять вручную (override проблемных заказов). */
const ADMIN_SETTABLE: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.ASSEMBLED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
];

@Injectable()
export class AdminOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: { status?: OrderStatus; search?: string; page?: number; perPage?: number }) {
    const page = filter.page ?? 1;
    const perPage = Math.min(filter.perPage ?? 20, 100);
    const where: Prisma.OrderWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.search) {
      where.OR = [
        { orderNumber: { contains: filter.search, mode: 'insensitive' } },
        { customerName: { contains: filter.search, mode: 'insensitive' } },
        { customerEmail: { contains: filter.search, mode: 'insensitive' } },
        { customerPhone: { contains: filter.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        include: {
          user: { select: { email: true, phone: true } },
          subOrders: {
            select: {
              id: true,
              merchantId: true,
              status: true,
              subtotal: true,
              merchant: { select: { brandName: true } },
            },
          },
          _count: { select: { items: true } },
        },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data: items, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
  }

  async get(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
        items: { include: { product: { select: { name: true, slug: true } } } },
        subOrders: { include: { merchant: { select: { brandName: true, slug: true } } } },
        payments: { orderBy: { createdAt: 'desc' } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /**
   * Ручное изменение статуса заказа администратором (override). Пишет запись в
   * историю статусов с указанием, кто и почему сменил. Для CANCELLED обязательна причина.
   */
  async updateStatus(
    id: string,
    status: OrderStatus,
    reason: string | undefined,
    actor: { id: string; role: string },
  ) {
    if (!ADMIN_SETTABLE.includes(status)) {
      throw new BadRequestException(`Статус ${status} недоступен для ручной установки`);
    }
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === status) {
      throw new BadRequestException('Заказ уже в этом статусе');
    }
    if (status === OrderStatus.CANCELLED && !reason?.trim()) {
      throw new BadRequestException('Для отмены укажите причину');
    }

    const now = new Date();
    const data: Prisma.OrderUpdateInput = { status };
    if (status === OrderStatus.PAID) data.paidAt = now;
    if (status === OrderStatus.PROCESSING) data.confirmedAt = now;
    if (status === OrderStatus.SHIPPED) data.shippedAt = now;
    if (status === OrderStatus.DELIVERED) data.deliveredAt = now;
    if (status === OrderStatus.COMPLETED) data.completedAt = now;
    if (status === OrderStatus.CANCELLED) {
      data.cancelledAt = now;
      data.cancellationReason = reason;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id }, data });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: status,
          changedById: actor.id,
          changedByRole: actor.role,
          reason: reason?.trim() || null,
          metadata: { source: 'admin-override' } as unknown as Prisma.InputJsonValue,
        },
      });
      return updated;
    });
  }
}
