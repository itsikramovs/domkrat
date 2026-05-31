import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockCountStatus } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';

import { AlertsService } from './alerts.service';

export interface CountActor {
  userId: string;
  merchantId?: string | null;
}

/**
 * WMS-инвентаризация (фаза 4): снимок ожидаемых остатков по ячейкам склада → ввод факта →
 * расхождения → корректирующие движения (ADJUSTMENT_PLUS/MINUS) + правка остатков
 * (per-cell и агрегат предложения) + пересчёт алертов.
 *
 * Multi-tenancy: мерчант инвентаризует только свои склады, админ — платформенные (любые).
 */
@Injectable()
export class StockCountService {
  private readonly logger = new Logger(StockCountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
  ) {}

  private async assertWarehouse(warehouseId: string, actor: CountActor) {
    const wh = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
      select: { id: true, merchantId: true },
    });
    if (!wh) throw new NotFoundException('Склад не найден');
    if (actor.merchantId != null && wh.merchantId !== actor.merchantId) {
      throw new ForbiddenException('Это не ваш склад');
    }
    return wh;
  }

  /** Снимок ожидаемых остатков по ячейкам склада → новая ревизия IN_PROGRESS. */
  async create(input: { warehouseId: string; note?: string }, actor: CountActor) {
    const wh = await this.assertWarehouse(input.warehouseId, actor);

    const balances = await this.prisma.inventoryBalance.findMany({
      where: {
        cellId: { not: null },
        cell: { shelf: { rack: { zone: { warehouseId: input.warehouseId } } } },
      },
      select: {
        offerId: true,
        productId: true,
        variantId: true,
        merchantId: true,
        cellId: true,
        quantityAvailable: true,
        cell: { select: { code: true } },
        offer: { select: { sku: true, product: { select: { name: true } } } },
      },
      orderBy: { cell: { code: 'asc' } },
    });

    if (balances.length === 0) {
      throw new BadRequestException('На складе нет размещённого товара по ячейкам');
    }

    return this.prisma.stockCount.create({
      data: {
        warehouseId: input.warehouseId,
        merchantId: wh.merchantId,
        status: StockCountStatus.IN_PROGRESS,
        note: input.note,
        createdById: actor.userId,
        items: {
          create: balances.map((b) => ({
            cellId: b.cellId!,
            cellCode: b.cell?.code ?? '—',
            offerId: b.offerId,
            productId: b.productId,
            variantId: b.variantId,
            merchantId: b.merchantId,
            sku: b.offer?.sku ?? '',
            productName: (b.offer?.product?.name ?? {}) as Prisma.InputJsonValue,
            expectedQty: b.quantityAvailable,
          })),
        },
      },
      include: { items: true },
    });
  }

  async list(actor: CountActor) {
    return this.prisma.stockCount.findMany({
      where: actor.merchantId != null ? { merchantId: actor.merchantId } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { _count: { select: { items: true } } },
    });
  }

  async get(countId: string, actor: CountActor) {
    const count = await this.prisma.stockCount.findUnique({
      where: { id: countId },
      include: { items: { orderBy: { cellCode: 'asc' } } },
    });
    if (!count) throw new NotFoundException('Ревизия не найдена');
    if (actor.merchantId != null && count.merchantId !== actor.merchantId) {
      throw new ForbiddenException('Это не ваша ревизия');
    }
    return count;
  }

  /** Сохранить фактически пересчитанные количества. */
  async saveCounts(
    countId: string,
    items: Array<{ itemId: string; countedQty: number }>,
    actor: CountActor,
  ) {
    const count = await this.get(countId, actor);
    if (count.status !== StockCountStatus.IN_PROGRESS) {
      throw new ConflictException('Ревизия уже завершена');
    }
    const valid = new Set(count.items.map((i) => i.id));
    await this.prisma.$transaction(
      items
        .filter((i) => valid.has(i.itemId))
        .map((i) =>
          this.prisma.stockCountItem.update({
            where: { id: i.itemId },
            data: { countedQty: i.countedQty },
          }),
        ),
    );
    return this.get(countId, actor);
  }

  /** Завершить ревизию: расхождения → ADJUSTMENT-движения + правка остатков + скан алертов. */
  async complete(countId: string, actor: CountActor) {
    const count = await this.get(countId, actor);
    if (count.status !== StockCountStatus.IN_PROGRESS) {
      throw new ConflictException('Ревизия уже завершена');
    }

    let adjusted = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const item of count.items) {
        if (item.countedQty === null) continue;
        const diff = item.countedQty - item.expectedQty;
        if (diff === 0) continue;

        // per-cell → абсолютное фактическое значение
        await tx.inventoryBalance.updateMany({
          where: { offerId: item.offerId, cellId: item.cellId },
          data: { quantityAvailable: item.countedQty },
        });
        // агрегат предложения (cellId=null) — корректируем на расхождение
        await tx.inventoryBalance.updateMany({
          where: { offerId: item.offerId, cellId: null },
          data: { quantityAvailable: { increment: diff } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            offerId: item.offerId,
            variantId: item.variantId,
            merchantId: item.merchantId,
            movementType: diff > 0 ? 'ADJUSTMENT_PLUS' : 'ADJUSTMENT_MINUS',
            quantity: diff,
            toCellId: diff > 0 ? item.cellId : null,
            fromCellId: diff < 0 ? item.cellId : null,
            referenceType: 'stock_count',
            referenceId: countId,
            performedById: actor.userId,
            notes: 'Инвентаризация',
          },
        });
        adjusted++;
      }

      await tx.stockCount.update({
        where: { id: countId },
        data: { status: StockCountStatus.COMPLETED, completedAt: new Date() },
      });
    });

    this.logger.log(`Ревизия ${countId} завершена: ${adjusted} корректировок`);
    await this.alerts.scan().catch((e) => this.logger.warn(`alerts.scan: ${(e as Error).message}`));
    return this.get(countId, actor);
  }
}
