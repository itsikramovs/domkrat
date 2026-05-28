import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, ProductStatus } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface AnalyticsSummary {
  rangeDays: number;
  orders: {
    total: number;
    paid: number;
    completed: number;
    cancelled: number;
  };
  revenue: {
    gross: string;
    payout: string;
    commission: string;
  };
  averageCheck: string;
  topProducts: Array<{
    productId: string;
    name: unknown;
    quantitySold: number;
    revenue: string;
  }>;
  dailyRevenue: Array<{ date: string; orders: number; revenue: string }>;
  inventory: {
    totalProducts: number;
    activeProducts: number;
    outOfStock: number;
  };
}

@Injectable()
export class MerchantAnalyticsService {
  private readonly logger = new Logger(MerchantAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSummary(merchantId: string, rangeDays: number): Promise<AnalyticsSummary> {
    const since = new Date(Date.now() - rangeDays * 86_400_000);

    const subOrders = await this.prisma.orderSubOrder.findMany({
      where: { merchantId, createdAt: { gte: since } },
      select: {
        id: true,
        status: true,
        subtotal: true,
        commissionAmount: true,
        merchantPayout: true,
        createdAt: true,
      },
    });

    const counts = {
      total: subOrders.length,
      paid: subOrders.filter((s) => s.status === OrderStatus.PAID).length,
      completed: subOrders.filter((s) => s.status === OrderStatus.COMPLETED).length,
      cancelled: subOrders.filter((s) => s.status === OrderStatus.CANCELLED).length,
    };

    // Деньги считаем по всем не-cancelled.
    const productive = subOrders.filter((s) => s.status !== OrderStatus.CANCELLED);
    const gross = productive.reduce((acc, s) => acc + Number(s.subtotal), 0);
    const payout = productive.reduce((acc, s) => acc + Number(s.merchantPayout), 0);
    const commission = productive.reduce((acc, s) => acc + Number(s.commissionAmount), 0);
    const average = productive.length > 0 ? gross / productive.length : 0;

    // Daily revenue — группируем по календарному дню (UTC).
    const byDay = new Map<string, { orders: number; revenue: number }>();
    for (let i = 0; i < rangeDays; i++) {
      const d = new Date(since.getTime() + i * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      byDay.set(key, { orders: 0, revenue: 0 });
    }
    for (const s of productive) {
      const key = s.createdAt.toISOString().slice(0, 10);
      const bucket = byDay.get(key) ?? { orders: 0, revenue: 0 };
      bucket.orders += 1;
      bucket.revenue += Number(s.subtotal);
      byDay.set(key, bucket);
    }
    const dailyRevenue = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, orders: v.orders, revenue: v.revenue.toFixed(2) }));

    // Top-5 продуктов по количеству.
    const itemAgg = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        merchantId,
        subOrder: { createdAt: { gte: since }, status: { not: OrderStatus.CANCELLED } },
      },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });
    const productIds = itemAgg.map((i) => i.productId);
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));
    const topProducts = itemAgg.map((i) => ({
      productId: i.productId,
      name: productMap.get(i.productId)?.name ?? null,
      quantitySold: i._sum.quantity ?? 0,
      revenue: (Number(i._sum.subtotal) || 0).toFixed(2),
    }));

    // Inventory сводка.
    const [totalProducts, activeProducts, outOfStock] = await Promise.all([
      this.prisma.product.count({ where: { merchantId, deletedAt: null } }),
      this.prisma.product.count({
        where: { merchantId, deletedAt: null, status: ProductStatus.ACTIVE },
      }),
      this.prisma.product.count({
        where: {
          merchantId,
          deletedAt: null,
          status: ProductStatus.ACTIVE,
          inventoryBalances: { every: { quantityAvailable: 0 } },
        },
      }),
    ]);

    return {
      rangeDays,
      orders: counts,
      revenue: {
        gross: gross.toFixed(2),
        payout: payout.toFixed(2),
        commission: commission.toFixed(2),
      },
      averageCheck: average.toFixed(2),
      topProducts,
      dailyRevenue,
      inventory: { totalProducts, activeProducts, outOfStock },
    };
  }
}
