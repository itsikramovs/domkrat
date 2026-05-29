import { Injectable } from '@nestjs/common';
import { MerchantStatus, OrderStatus, ProductStatus, UserRole } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface PlatformAnalytics {
  rangeDays: number;
  totals: {
    merchants: number;
    customers: number;
    products: number;
    newCustomers: number;
  };
  orders: { total: number; paid: number; completed: number; cancelled: number };
  revenue: { gmv: string; commission: string; payout: string };
  averageCheck: string;
  daily: Array<{ date: string; orders: number; gmv: string }>;
  topMerchants: Array<{ merchantId: string; brandName: string; gmv: string; orders: number }>;
  topCategories: Array<{ categoryId: string; name: unknown; quantitySold: number }>;
}

/** Платформенная аналитика для админки (по всем мерчантам/заказам). */
@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(rangeDays: number): Promise<PlatformAnalytics> {
    const since = new Date(Date.now() - rangeDays * 86_400_000);

    const [orders, subOrders, totals] = await Promise.all([
      this.prisma.order.findMany({
        where: { placedAt: { gte: since } },
        select: { status: true, totalAmount: true, placedAt: true },
      }),
      this.prisma.orderSubOrder.findMany({
        where: { createdAt: { gte: since } },
        select: {
          merchantId: true,
          status: true,
          subtotal: true,
          commissionAmount: true,
          merchantPayout: true,
        },
      }),
      this.loadTotals(since),
    ]);

    const orderCounts = {
      total: orders.length,
      paid: orders.filter((o) => o.status === OrderStatus.PAID).length,
      completed: orders.filter((o) => o.status === OrderStatus.COMPLETED).length,
      cancelled: orders.filter((o) => o.status === OrderStatus.CANCELLED).length,
    };

    const productiveOrders = orders.filter((o) => o.status !== OrderStatus.CANCELLED);
    const gmv = productiveOrders.reduce((acc, o) => acc + Number(o.totalAmount), 0);
    const average = productiveOrders.length > 0 ? gmv / productiveOrders.length : 0;

    const productiveSub = subOrders.filter((s) => s.status !== OrderStatus.CANCELLED);
    const commission = productiveSub.reduce((acc, s) => acc + Number(s.commissionAmount), 0);
    const payout = productiveSub.reduce((acc, s) => acc + Number(s.merchantPayout), 0);

    return {
      rangeDays,
      totals,
      orders: orderCounts,
      revenue: {
        gmv: gmv.toFixed(2),
        commission: commission.toFixed(2),
        payout: payout.toFixed(2),
      },
      averageCheck: average.toFixed(2),
      daily: this.buildDaily(since, rangeDays, productiveOrders),
      topMerchants: await this.topMerchants(productiveSub),
      topCategories: await this.topCategories(since),
    };
  }

  private async loadTotals(since: Date) {
    const [merchants, customers, products, newCustomers] = await Promise.all([
      this.prisma.merchant.count({ where: { status: MerchantStatus.ACTIVE } }),
      this.prisma.user.count({
        where: { deletedAt: null, roles: { some: { role: UserRole.CUSTOMER } } },
      }),
      this.prisma.product.count({ where: { deletedAt: null, status: ProductStatus.ACTIVE } }),
      this.prisma.user.count({
        where: {
          deletedAt: null,
          createdAt: { gte: since },
          roles: { some: { role: UserRole.CUSTOMER } },
        },
      }),
    ]);
    return { merchants, customers, products, newCustomers };
  }

  private buildDaily(
    since: Date,
    rangeDays: number,
    orders: Array<{ totalAmount: unknown; placedAt: Date }>,
  ) {
    const byDay = new Map<string, { orders: number; gmv: number }>();
    for (let i = 0; i < rangeDays; i++) {
      const key = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10);
      byDay.set(key, { orders: 0, gmv: 0 });
    }
    for (const o of orders) {
      const key = o.placedAt.toISOString().slice(0, 10);
      const bucket = byDay.get(key) ?? { orders: 0, gmv: 0 };
      bucket.orders += 1;
      bucket.gmv += Number(o.totalAmount);
      byDay.set(key, bucket);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, orders: v.orders, gmv: v.gmv.toFixed(2) }));
  }

  private async topMerchants(
    subOrders: Array<{ merchantId: string; subtotal: unknown }>,
  ): Promise<PlatformAnalytics['topMerchants']> {
    const byMerchant = new Map<string, { gmv: number; orders: number }>();
    for (const s of subOrders) {
      const b = byMerchant.get(s.merchantId) ?? { gmv: 0, orders: 0 };
      b.gmv += Number(s.subtotal);
      b.orders += 1;
      byMerchant.set(s.merchantId, b);
    }
    const top = Array.from(byMerchant.entries())
      .sort(([, a], [, b]) => b.gmv - a.gmv)
      .slice(0, 5);
    if (top.length === 0) return [];

    const merchants = await this.prisma.merchant.findMany({
      where: { id: { in: top.map(([id]) => id) } },
      select: { id: true, brandName: true },
    });
    const nameMap = new Map(merchants.map((m) => [m.id, m.brandName]));
    return top.map(([merchantId, v]) => ({
      merchantId,
      brandName: nameMap.get(merchantId) ?? '—',
      gmv: v.gmv.toFixed(2),
      orders: v.orders,
    }));
  }

  private async topCategories(since: Date): Promise<PlatformAnalytics['topCategories']> {
    const itemAgg = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: { subOrder: { createdAt: { gte: since }, status: { not: OrderStatus.CANCELLED } } },
      _sum: { quantity: true },
    });
    if (itemAgg.length === 0) return [];

    const products = await this.prisma.product.findMany({
      where: { id: { in: itemAgg.map((i) => i.productId) } },
      select: { id: true, categoryId: true },
    });
    const catOfProduct = new Map(products.map((p) => [p.id, p.categoryId]));

    const byCat = new Map<string, number>();
    for (const i of itemAgg) {
      const cat = catOfProduct.get(i.productId);
      if (!cat) continue;
      byCat.set(cat, (byCat.get(cat) ?? 0) + (i._sum.quantity ?? 0));
    }
    const top = Array.from(byCat.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    if (top.length === 0) return [];

    const categories = await this.prisma.category.findMany({
      where: { id: { in: top.map(([id]) => id) } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(categories.map((c) => [c.id, c.name]));
    return top.map(([categoryId, quantitySold]) => ({
      categoryId,
      name: nameMap.get(categoryId) ?? null,
      quantitySold,
    }));
  }
}
