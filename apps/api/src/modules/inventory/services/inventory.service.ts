import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';

/** Запросы остатков и движений (для кабинета мерчанта и админки). */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Остатки мерчанта. byCell=false → агрегаты (cellId null, доступно к продаже);
   * byCell=true → физическое размещение по ячейкам.
   */
  listBalances(
    merchantId: string,
    filter: { warehouseId?: string; byCell?: boolean; lowStockThreshold?: number },
  ) {
    const where: Prisma.InventoryBalanceWhereInput = { merchantId };
    if (filter.warehouseId) where.warehouseId = filter.warehouseId;
    where.cellId = filter.byCell ? { not: null } : null;
    if (filter.lowStockThreshold !== undefined) {
      where.quantityAvailable = { lte: filter.lowStockThreshold };
    }
    return this.prisma.inventoryBalance.findMany({
      where,
      orderBy: { quantityAvailable: 'asc' },
      include: {
        product: { select: { sku: true, name: true, slug: true } },
        warehouse: { select: { code: true, name: true } },
        cell: { select: { code: true } },
      },
      take: 500,
    });
  }

  listMovements(merchantId: string, filter: { productId?: string; limit?: number }) {
    return this.prisma.stockMovement.findMany({
      where: { merchantId, ...(filter.productId ? { productId: filter.productId } : {}) },
      orderBy: { performedAt: 'desc' },
      take: Math.min(filter.limit ?? 100, 500),
      include: {
        product: { select: { sku: true, name: true } },
        fromCell: { select: { code: true } },
        toCell: { select: { code: true } },
      },
    });
  }

  async summary(merchantId: string) {
    const [skuCount, agg, lowStock, activeReceipts] = await Promise.all([
      this.prisma.inventoryBalance.count({ where: { merchantId, cellId: null } }),
      this.prisma.inventoryBalance.aggregate({
        where: { merchantId, cellId: null },
        _sum: { quantityAvailable: true, quantityReserved: true },
      }),
      this.prisma.inventoryBalance.count({
        where: { merchantId, cellId: null, quantityAvailable: { lte: 5 } },
      }),
      this.prisma.stockReceipt.count({
        where: { merchantId, status: { notIn: ['COMPLETED', 'REJECTED'] } },
      }),
    ]);
    return {
      skuCount,
      totalAvailable: agg._sum.quantityAvailable ?? 0,
      totalReserved: agg._sum.quantityReserved ?? 0,
      lowStockCount: lowStock,
      activeReceipts,
    };
  }
}
