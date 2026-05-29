import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, UserRole } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';

/** Статусы, при которых деньги клиента считаются потраченными (оплачено и далее). */
const SPENT_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.ASSEMBLED,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

@Injectable()
export class AdminCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Список клиентов (роль CUSTOMER) с агрегатами по заказам. */
  async list(filter: { search?: string; page?: number; perPage?: number }) {
    const page = filter.page ?? 1;
    const perPage = Math.min(filter.perPage ?? 30, 100);

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      roles: { some: { role: UserRole.CUSTOMER } },
    };
    if (filter.search) {
      where.OR = [
        { email: { contains: filter.search, mode: 'insensitive' } },
        { phone: { contains: filter.search } },
        { firstName: { contains: filter.search, mode: 'insensitive' } },
        { lastName: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          isActive: true,
          isEmailVerified: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.user.count({ where }),
    ]);

    const stats = await this.statsFor(items.map((u) => u.id));
    const data = items.map((u) => ({
      ...u,
      ordersCount: stats.get(u.id)?.count ?? 0,
      totalSpent: stats.get(u.id)?.spent ?? '0',
    }));

    return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
  }

  /** Карточка клиента: профиль, адреса, агрегаты и последние заказы. */
  async get(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, roles: { some: { role: UserRole.CUSTOMER } } },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        isActive: true,
        isEmailVerified: true,
        preferredLanguage: true,
        createdAt: true,
        lastLoginAt: true,
        addresses: {
          where: { deletedAt: null },
          select: { id: true, region: true, city: true, addressLine: true, isDefault: true },
        },
      },
    });
    if (!user) throw new NotFoundException('Customer not found');

    const [orders, stats] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId: id },
        orderBy: { placedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          placedAt: true,
          _count: { select: { items: true } },
        },
      }),
      this.statsFor([id]),
    ]);

    return {
      ...user,
      ordersCount: stats.get(id)?.count ?? 0,
      totalSpent: stats.get(id)?.spent ?? '0',
      recentOrders: orders,
    };
  }

  /** Агрегаты заказов (кол-во всего + сумма по «потраченным» статусам) для набора userId. */
  private async statsFor(
    userIds: string[],
  ): Promise<Map<string, { count: number; spent: string }>> {
    const map = new Map<string, { count: number; spent: string }>();
    if (userIds.length === 0) return map;

    const [counts, spent] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, status: { in: SPENT_STATUSES } },
        _sum: { totalAmount: true },
      }),
    ]);

    for (const c of counts) map.set(c.userId, { count: c._count._all, spent: '0' });
    for (const s of spent) {
      const entry = map.get(s.userId) ?? { count: 0, spent: '0' };
      entry.spent = (s._sum.totalAmount ?? '0').toString();
      map.set(s.userId, entry);
    }
    return map;
  }
}
