import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { TransferDto } from '../dto/transfer.dto';

/** Запросы остатков и движений (для кабинета мерчанта и админки). */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Перемещение остатка между ячейками. Меняется только физика (per-cell);
   * продаваемый агрегат (cellId=null) не трогаем. Пишет StockMovement(TRANSFER).
   */
  async transfer(merchantId: string, dto: TransferDto, userId: string) {
    if (dto.fromCellId === dto.toCellId) throw new BadRequestException('Ячейки совпадают');
    const toCell = await this.prisma.warehouseCell.findUnique({
      where: { id: dto.toCellId },
      include: { shelf: { include: { rack: { include: { zone: true } } } } },
    });
    if (!toCell) throw new NotFoundException('Целевая ячейка не найдена');
    const toWarehouseId = toCell.shelf.rack.zone.warehouseId;

    // Резолвим предложение продавца (явный offerId или дефолтное по товару).
    const offer = await this.prisma.productOffer.findFirst({
      where: dto.offerId
        ? { id: dto.offerId, merchantId, deletedAt: null }
        : { productId: dto.productId, merchantId, deletedAt: null, variant: { isDefault: true } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, productId: true, variantId: true },
    });
    if (!offer) throw new NotFoundException('Предложение для перемещения не найдено');

    return this.prisma.$transaction(async (tx) => {
      const dec = await tx.inventoryBalance.updateMany({
        where: {
          offerId: offer.id,
          cellId: dto.fromCellId,
          quantityAvailable: { gte: dto.quantity },
        },
        data: { quantityAvailable: { decrement: dto.quantity } },
      });
      if (dec.count === 0) throw new ConflictException('Недостаточно остатка в исходной ячейке');

      await tx.inventoryBalance.upsert({
        where: { offerId_cellId: { offerId: offer.id, cellId: dto.toCellId } },
        create: {
          productId: offer.productId,
          offerId: offer.id,
          variantId: offer.variantId,
          merchantId,
          warehouseId: toWarehouseId,
          cellId: dto.toCellId,
          quantityAvailable: dto.quantity,
        },
        update: { quantityAvailable: { increment: dto.quantity } },
      });

      await tx.stockMovement.create({
        data: {
          productId: offer.productId,
          offerId: offer.id,
          variantId: offer.variantId,
          merchantId,
          movementType: 'TRANSFER',
          quantity: dto.quantity,
          fromCellId: dto.fromCellId,
          toCellId: dto.toCellId,
          performedById: userId,
        },
      });
      return { ok: true };
    });
  }

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
        product: { select: { name: true, slug: true } },
        offer: { select: { sku: true } },
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
        product: { select: { name: true } },
        offer: { select: { sku: true } },
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
