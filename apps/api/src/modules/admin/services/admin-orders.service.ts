import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';

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
            select: { id: true, merchantId: true, status: true, subtotal: true },
            include: { merchant: { select: { brandName: true } } } as never,
          } as never,
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
}
