import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PlacementStatus,
  Prisma,
  QualityCheckStatus,
  ReceiptStatus,
  WarehouseType,
} from '@prisma/client';
import { Decimal } from 'decimal.js';

import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  CreateReceiptDto,
  PlacementDto,
  QualityCheckDto,
  ReceiveItemsDto,
} from '../dto/receipt.dto';
import { ReceiptNumberingService } from '../receipt-numbering.service';

type Tx = Prisma.TransactionClient;

/**
 * Цикл приёмки (приходование) по docs/05-BUSINESS-FLOWS §3.1:
 * DRAFT → (submit) EXPECTED → (receive) ARRIVED → (qualityCheck) CHECKING/PLACING
 *        → (placement) размещение по ячейкам → COMPLETED.
 * На размещении пишутся StockMovement(RECEIPT) и InventoryBalance (по ячейке + агрегат).
 */
@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: ReceiptNumberingService,
  ) {}

  list(merchantId: string, filter: { status?: ReceiptStatus }) {
    return this.prisma.stockReceipt.findMany({
      where: { merchantId, ...(filter.status ? { status: filter.status } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        warehouse: { select: { code: true, name: true } },
        _count: { select: { items: true } },
      },
    });
  }

  async get(id: string, merchantId: string) {
    const r = await this.prisma.stockReceipt.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        items: { include: { product: { select: { sku: true, name: true } } } },
      },
    });
    if (!r) throw new NotFoundException('Приёмка не найдена');
    if (r.merchantId !== merchantId) throw new ForbiddenException('Чужая приёмка');
    return r;
  }

  /** Шаг 1: создание приёмки (DRAFT). */
  async create(merchantId: string, dto: CreateReceiptDto) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new NotFoundException('Склад не найден');
    // принимать можно на свой склад (FBS) либо на платформенный (FBO)
    if (warehouse.merchantId !== merchantId && warehouse.type !== WarehouseType.PLATFORM) {
      throw new ForbiddenException('Нельзя принимать на этот склад');
    }

    const productIds = dto.items.map((i) => i.productId);
    const owned = await this.prisma.product.count({
      where: { id: { in: productIds }, merchantId },
    });
    if (owned !== new Set(productIds).size) {
      throw new BadRequestException('Все товары приёмки должны принадлежать мерчанту');
    }

    const totalQuantity = dto.items.reduce((s, i) => s + i.expectedQuantity, 0);
    const totalValue = dto.items.reduce(
      (s, i) => s.plus(new Decimal(i.unitCost ?? '0').times(i.expectedQuantity)),
      new Decimal(0),
    );
    const receiptNumber = await this.numbering.nextReceiptNumber();

    return this.prisma.stockReceipt.create({
      data: {
        receiptNumber,
        merchantId,
        warehouseId: dto.warehouseId,
        status: ReceiptStatus.DRAFT,
        totalItems: dto.items.length,
        totalQuantity,
        totalValue: totalValue.toFixed(2),
        expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : null,
        notes: dto.notes,
        items: {
          create: dto.items.map((i) => ({
            productId: i.productId,
            expectedQuantity: i.expectedQuantity,
            unitCost: i.unitCost ?? null,
          })),
        },
      },
      include: { items: true },
    });
  }

  /** Шаг 2: отправить в ожидание (DRAFT → EXPECTED). */
  async submit(id: string, merchantId: string) {
    const r = await this.requireStatus(id, merchantId, [ReceiptStatus.DRAFT]);
    return this.prisma.stockReceipt.update({
      where: { id: r.id },
      data: { status: ReceiptStatus.EXPECTED },
    });
  }

  /** Шаг 3: приёмка по факту (EXPECTED/IN_TRANSIT/ARRIVED → ARRIVED). */
  async receive(id: string, merchantId: string, dto: ReceiveItemsDto, userId: string) {
    const r = await this.requireStatus(id, merchantId, [
      ReceiptStatus.EXPECTED,
      ReceiptStatus.IN_TRANSIT,
      ReceiptStatus.ARRIVED,
    ]);
    const byId = new Map(r.items.map((it) => [it.id, it]));
    for (const input of dto.items) {
      if (!byId.has(input.itemId))
        throw new BadRequestException(`Строка ${input.itemId} не из этой приёмки`);
    }
    return this.prisma.$transaction(async (tx) => {
      for (const input of dto.items) {
        await tx.stockReceiptItem.update({
          where: { id: input.itemId },
          data: { receivedQuantity: input.receivedQuantity },
        });
      }
      return tx.stockReceipt.update({
        where: { id: r.id },
        data: { status: ReceiptStatus.ARRIVED, receivedById: userId, receivedAt: new Date() },
        include: { items: true },
      });
    });
  }

  /** Шаг 4: контроль качества (ARRIVED → CHECKING → PLACING). */
  async qualityCheck(id: string, merchantId: string, dto: QualityCheckDto) {
    const r = await this.requireStatus(id, merchantId, [
      ReceiptStatus.ARRIVED,
      ReceiptStatus.CHECKING,
    ]);
    const byId = new Map(r.items.map((it) => [it.id, it]));
    let anyRejected = false;
    let anyAccepted = false;
    for (const input of dto.items) {
      const item = byId.get(input.itemId);
      if (!item) throw new BadRequestException(`Строка ${input.itemId} не из этой приёмки`);
      if (input.acceptedQuantity + input.rejectedQuantity > item.receivedQuantity) {
        throw new BadRequestException(
          `Принято+брак (${input.acceptedQuantity}+${input.rejectedQuantity}) больше принятого по факту (${item.receivedQuantity})`,
        );
      }
      if (input.rejectedQuantity > 0) anyRejected = true;
      if (input.acceptedQuantity > 0) anyAccepted = true;
    }
    const qcStatus = anyRejected
      ? anyAccepted
        ? QualityCheckStatus.PARTIAL
        : QualityCheckStatus.FAILED
      : QualityCheckStatus.PASSED;

    return this.prisma.$transaction(async (tx) => {
      for (const input of dto.items) {
        await tx.stockReceiptItem.update({
          where: { id: input.itemId },
          data: {
            acceptedQuantity: input.acceptedQuantity,
            rejectedQuantity: input.rejectedQuantity,
            rejectionReason: input.rejectionReason ?? null,
          },
        });
      }
      return tx.stockReceipt.update({
        where: { id: r.id },
        data: {
          status:
            qcStatus === QualityCheckStatus.FAILED ? ReceiptStatus.REJECTED : ReceiptStatus.PLACING,
          qualityCheckStatus: qcStatus,
          qualityCheckNotes: dto.notes ?? null,
          placementStatus:
            qcStatus === QualityCheckStatus.FAILED
              ? PlacementStatus.PENDING
              : PlacementStatus.IN_PROGRESS,
        },
        include: { items: true },
      });
    });
  }

  /** Шаг 6: размещение по ячейкам (PLACING). Когда всё принятое размещено → COMPLETED. */
  async place(id: string, merchantId: string, dto: PlacementDto, userId: string) {
    const r = await this.requireStatus(id, merchantId, [ReceiptStatus.PLACING]);
    const items = new Map(r.items.map((it) => [it.id, it]));

    return this.prisma.$transaction(async (tx) => {
      // already-placed считаем из placedInCells
      for (const p of dto.placements) {
        const item = items.get(p.itemId);
        if (!item) throw new BadRequestException(`Строка ${p.itemId} не из этой приёмки`);

        const cell = await tx.warehouseCell.findUnique({
          where: { id: p.cellId },
          include: { shelf: { include: { rack: { include: { zone: true } } } } },
        });
        if (!cell) throw new NotFoundException(`Ячейка ${p.cellId} не найдена`);
        if (cell.shelf.rack.zone.warehouseId !== r.warehouseId) {
          throw new BadRequestException('Ячейка не из склада приёмки');
        }
        if (cell.isBlocked || !cell.isActive)
          throw new ConflictException(`Ячейка ${cell.code} недоступна`);
        if (cell.merchantId && cell.merchantId !== merchantId) {
          throw new ForbiddenException(`Ячейка ${cell.code} арендована другим мерчантом`);
        }

        const placed = this.placedCount(item.placedInCells);
        if (placed + p.quantity > item.acceptedQuantity) {
          throw new BadRequestException(
            `Размещаемое (${placed + p.quantity}) превышает принятое (${item.acceptedQuantity}) для ${item.productId}`,
          );
        }

        await this.addStock(tx, {
          productId: item.productId,
          merchantId,
          cellId: cell.id,
          warehouseId: r.warehouseId,
          quantity: p.quantity,
          unitCost: item.unitCost,
          performedById: userId,
          receiptId: r.id,
        });

        const nextPlaced = this.mergePlaced(item.placedInCells, cell.id, p.quantity);
        await tx.stockReceiptItem.update({
          where: { id: item.id },
          data: { placedInCells: nextPlaced as unknown as Prisma.InputJsonValue },
        });
        item.placedInCells = nextPlaced as unknown as typeof item.placedInCells;
      }

      // полностью ли размещено всё принятое?
      const fresh = await tx.stockReceiptItem.findMany({ where: { receiptId: r.id } });
      const allPlaced = fresh.every(
        (it) => this.placedCount(it.placedInCells) >= it.acceptedQuantity,
      );

      return tx.stockReceipt.update({
        where: { id: r.id },
        data: allPlaced
          ? { status: ReceiptStatus.COMPLETED, placementStatus: PlacementStatus.COMPLETED }
          : { placementStatus: PlacementStatus.IN_PROGRESS },
        include: { items: true },
      });
    });
  }

  /**
   * Добавляет остаток: запись по ячейке (физика) + агрегат cellId=null (доступно к продаже,
   * именно его списывает оформление заказа). Пишет StockMovement(RECEIPT).
   */
  private async addStock(
    tx: Tx,
    p: {
      productId: string;
      merchantId: string;
      cellId: string;
      warehouseId: string;
      quantity: number;
      unitCost: Prisma.Decimal | null;
      performedById: string;
      receiptId: string;
    },
  ): Promise<void> {
    const now = new Date();
    // 1) по ячейке (cellId задан → upsert по compound unique)
    await tx.inventoryBalance.upsert({
      where: {
        productId_merchantId_cellId: {
          productId: p.productId,
          merchantId: p.merchantId,
          cellId: p.cellId,
        },
      },
      create: {
        productId: p.productId,
        merchantId: p.merchantId,
        warehouseId: p.warehouseId,
        cellId: p.cellId,
        quantityAvailable: p.quantity,
        lastReceivedAt: now,
        oldestReceivedAt: now,
      },
      update: {
        quantityAvailable: { increment: p.quantity },
        lastReceivedAt: now,
      },
    });

    // 2) агрегат к продаже (cellId = null) — NULL не уникален в Postgres, потому updateMany→create
    const updated = await tx.inventoryBalance.updateMany({
      where: { productId: p.productId, merchantId: p.merchantId, cellId: null },
      data: { quantityAvailable: { increment: p.quantity }, lastReceivedAt: now },
    });
    if (updated.count === 0) {
      await tx.inventoryBalance.create({
        data: {
          productId: p.productId,
          merchantId: p.merchantId,
          warehouseId: p.warehouseId,
          cellId: null,
          quantityAvailable: p.quantity,
          lastReceivedAt: now,
          oldestReceivedAt: now,
        },
      });
    }

    // 3) движение
    await tx.stockMovement.create({
      data: {
        productId: p.productId,
        merchantId: p.merchantId,
        movementType: 'RECEIPT',
        quantity: p.quantity,
        toCellId: p.cellId,
        referenceType: 'stock_receipt',
        referenceId: p.receiptId,
        unitCost: p.unitCost,
        performedById: p.performedById,
      },
    });
  }

  private placedCount(placedInCells: Prisma.JsonValue | null): number {
    if (!placedInCells || typeof placedInCells !== 'object' || Array.isArray(placedInCells))
      return 0;
    return Object.values(placedInCells as Record<string, number>).reduce(
      (s, n) => s + (typeof n === 'number' ? n : 0),
      0,
    );
  }

  private mergePlaced(
    placedInCells: Prisma.JsonValue | null,
    cellId: string,
    qty: number,
  ): Record<string, number> {
    const base: Record<string, number> =
      placedInCells && typeof placedInCells === 'object' && !Array.isArray(placedInCells)
        ? { ...(placedInCells as Record<string, number>) }
        : {};
    base[cellId] = (base[cellId] ?? 0) + qty;
    return base;
  }

  private async requireStatus(id: string, merchantId: string, allowed: ReceiptStatus[]) {
    const r = await this.prisma.stockReceipt.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!r) throw new NotFoundException('Приёмка не найдена');
    if (r.merchantId !== merchantId) throw new ForbiddenException('Чужая приёмка');
    if (!allowed.includes(r.status)) {
      throw new ConflictException(
        `Недопустимо в статусе ${r.status} (ожидался: ${allowed.join('/')})`,
      );
    }
    return r;
  }
}
