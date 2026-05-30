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

/** Резолв (productId,merchantId) → конкретное предложение продавца для приёмки. */
type ResolvedOffer = { offerId: string; productId: string; variantId: string; merchantId: string };

/**
 * Цикл приёмки (приходование) по docs/05-BUSINESS-FLOWS §3.1:
 * DRAFT → (submit) EXPECTED → (receive) ARRIVED → (qualityCheck) CHECKING/PLACING
 *        → (placement) размещение по ячейкам → COMPLETED.
 * Остаток ведётся по предложению (offerId): запись по ячейке + агрегат cellId=null.
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

  /** Админ-обзор: приёмки всех мерчантов. */
  listAll(filter: { status?: ReceiptStatus }) {
    return this.prisma.stockReceipt.findMany({
      where: { ...(filter.status ? { status: filter.status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        warehouse: { select: { code: true, name: true } },
        merchant: { select: { brandName: true } },
        _count: { select: { items: true } },
      },
    });
  }

  async get(id: string, merchantId: string) {
    const r = await this.prisma.stockReceipt.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        items: {
          include: {
            product: { select: { name: true } },
            offer: { select: { sku: true } },
          },
        },
      },
    });
    if (!r) throw new NotFoundException('Приёмка не найдена');
    if (r.merchantId !== merchantId) throw new ForbiddenException('Чужая приёмка');
    return r;
  }

  /** Шаг 1: создание приёмки (DRAFT). Каждой строке резолвится предложение продавца. */
  async create(merchantId: string, dto: CreateReceiptDto) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new NotFoundException('Склад не найден');
    if (warehouse.merchantId !== merchantId && warehouse.type !== WarehouseType.PLATFORM) {
      throw new ForbiddenException('Нельзя принимать на этот склад');
    }

    const resolved = new Map<string, ResolvedOffer>();
    for (const i of dto.items) {
      if (!resolved.has(i.productId)) {
        resolved.set(i.productId, await this.resolveDefaultOffer(i.productId, merchantId));
      }
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
          create: dto.items.map((i) => {
            const off = resolved.get(i.productId)!;
            return {
              productId: i.productId,
              offerId: off.offerId,
              variantId: off.variantId,
              expectedQuantity: i.expectedQuantity,
              unitCost: i.unitCost ?? null,
            };
          }),
        },
      },
      include: { items: true },
    });
  }

  /**
   * Быстрый приход в один шаг (для админ-панели): создаёт завершённую приёмку на одно
   * предложение и сразу размещает его на ячейку. Делает товар физически на складе и
   * продаваемым (агрегат InventoryBalance по offerId). НЕ меняет статус карточки.
   */
  async quickReceiveAndPlace(params: {
    offerId: string;
    warehouseId: string;
    cellId: string;
    quantity: number;
    unitCost?: number | string | null;
    performedById: string;
  }) {
    if (params.quantity <= 0) throw new BadRequestException('Количество должно быть больше 0');
    const offer = await this.requireOffer(params.offerId);

    await this.assertWarehouseAccess(params.warehouseId, offer.merchantId);
    await this.assertCell(params.cellId, params.warehouseId, offer.merchantId);

    const unitCost =
      params.unitCost != null && params.unitCost !== '' ? new Decimal(params.unitCost) : null;
    const receiptNumber = await this.numbering.nextReceiptNumber();
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.stockReceipt.create({
        data: {
          receiptNumber,
          merchantId: offer.merchantId,
          warehouseId: params.warehouseId,
          status: ReceiptStatus.COMPLETED,
          qualityCheckStatus: QualityCheckStatus.PASSED,
          placementStatus: PlacementStatus.COMPLETED,
          totalItems: 1,
          totalQuantity: params.quantity,
          totalValue: unitCost ? unitCost.times(params.quantity).toFixed(2) : '0',
          receivedById: params.performedById,
          receivedAt: now,
          notes: 'Быстрый приход из админ-панели',
          items: {
            create: [
              {
                productId: offer.productId,
                offerId: offer.offerId,
                variantId: offer.variantId,
                expectedQuantity: params.quantity,
                receivedQuantity: params.quantity,
                acceptedQuantity: params.quantity,
                rejectedQuantity: 0,
                unitCost,
                placedInCells: {
                  [params.cellId]: params.quantity,
                } as unknown as Prisma.InputJsonValue,
              },
            ],
          },
        },
        include: { items: true },
      });

      await this.addStock(tx, {
        offer,
        cellId: params.cellId,
        warehouseId: params.warehouseId,
        quantity: params.quantity,
        unitCost,
        performedById: params.performedById,
        receiptId: receipt.id,
      });

      return receipt;
    });
  }

  /**
   * Многострочный приход в один шаг (админ): одна завершённая приёмка на несколько
   * предложений, каждое размещается на свою ячейку. Активацию карточек делает вызывающий.
   */
  async quickReceiveMany(params: {
    warehouseId: string;
    performedById: string;
    items: Array<{
      offerId: string;
      cellId: string;
      quantity: number;
      unitCost?: number | string | null;
    }>;
  }) {
    if (params.items.length === 0) throw new BadRequestException('Добавьте хотя бы одну позицию');

    const offers = new Map<string, ResolvedOffer>();
    for (const it of params.items) {
      if (it.quantity <= 0) throw new BadRequestException('Количество должно быть больше 0');
      if (!offers.has(it.offerId)) offers.set(it.offerId, await this.requireOffer(it.offerId));
    }
    // все предложения одной приёмки должны принадлежать одному мерчанту (один склад)
    const merchantIds = new Set([...offers.values()].map((o) => o.merchantId));
    if (merchantIds.size > 1) {
      throw new BadRequestException('Все позиции приёмки должны быть одного продавца');
    }
    const merchantId = [...merchantIds][0]!;
    await this.assertWarehouseAccess(params.warehouseId, merchantId);

    const cellIds = [...new Set(params.items.map((i) => i.cellId))];
    const cells = await this.prisma.warehouseCell.findMany({
      where: { id: { in: cellIds } },
      include: { shelf: { include: { rack: { include: { zone: true } } } } },
    });
    const cellMap = new Map(cells.map((c) => [c.id, c]));
    for (const it of params.items) {
      const cell = cellMap.get(it.cellId);
      if (!cell) throw new NotFoundException('Ячейка не найдена');
      if (cell.shelf.rack.zone.warehouseId !== params.warehouseId)
        throw new BadRequestException(`Ячейка ${cell.code} не из выбранного склада`);
      if (cell.isBlocked || !cell.isActive)
        throw new ConflictException(`Ячейка ${cell.code} недоступна`);
      if (cell.merchantId && cell.merchantId !== merchantId)
        throw new ForbiddenException(`Ячейка ${cell.code} арендована другим мерчантом`);
    }

    const cost = (v?: number | string | null) => (v != null && v !== '' ? new Decimal(v) : null);
    const totalQty = params.items.reduce((s, i) => s + i.quantity, 0);
    const totalValue = params.items.reduce(
      (s, i) => s.plus(new Decimal(i.unitCost ?? 0).times(i.quantity)),
      new Decimal(0),
    );
    const receiptNumber = await this.numbering.nextReceiptNumber();
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.stockReceipt.create({
        data: {
          receiptNumber,
          merchantId,
          warehouseId: params.warehouseId,
          status: ReceiptStatus.COMPLETED,
          qualityCheckStatus: QualityCheckStatus.PASSED,
          placementStatus: PlacementStatus.COMPLETED,
          totalItems: params.items.length,
          totalQuantity: totalQty,
          totalValue: totalValue.toFixed(2),
          receivedById: params.performedById,
          receivedAt: now,
          notes: 'Многострочный приход из админ-панели',
          items: {
            create: params.items.map((i) => {
              const off = offers.get(i.offerId)!;
              return {
                productId: off.productId,
                offerId: off.offerId,
                variantId: off.variantId,
                expectedQuantity: i.quantity,
                receivedQuantity: i.quantity,
                acceptedQuantity: i.quantity,
                rejectedQuantity: 0,
                unitCost: cost(i.unitCost),
                placedInCells: { [i.cellId]: i.quantity } as unknown as Prisma.InputJsonValue,
              };
            }),
          },
        },
        include: { items: true },
      });

      for (const i of params.items) {
        await this.addStock(tx, {
          offer: offers.get(i.offerId)!,
          cellId: i.cellId,
          warehouseId: params.warehouseId,
          quantity: i.quantity,
          unitCost: cost(i.unitCost),
          performedById: params.performedById,
          receiptId: receipt.id,
        });
      }
      return receipt;
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
      for (const p of dto.placements) {
        const item = items.get(p.itemId);
        if (!item) throw new BadRequestException(`Строка ${p.itemId} не из этой приёмки`);
        if (!item.offerId || !item.variantId) {
          throw new BadRequestException('У строки приёмки нет предложения (offerId)');
        }

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
          offer: {
            offerId: item.offerId,
            productId: item.productId,
            variantId: item.variantId,
            merchantId,
          },
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
   * Добавляет остаток: запись по ячейке (физика, upsert по offerId_cellId) + агрегат
   * cellId=null (доступно к продаже, его списывает оформление заказа). StockMovement(RECEIPT).
   */
  private async addStock(
    tx: Tx,
    p: {
      offer: ResolvedOffer;
      cellId: string;
      warehouseId: string;
      quantity: number;
      unitCost: Prisma.Decimal | null;
      performedById: string;
      receiptId: string;
    },
  ): Promise<void> {
    const now = new Date();
    const { offerId, variantId, productId, merchantId } = p.offer;

    // 1) по ячейке (cellId задан → upsert по compound unique offerId_cellId)
    await tx.inventoryBalance.upsert({
      where: { offerId_cellId: { offerId, cellId: p.cellId } },
      create: {
        productId,
        offerId,
        variantId,
        merchantId,
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

    // 2) агрегат к продаже (cellId = null) — NULL не уникален, потому updateMany→create
    const updated = await tx.inventoryBalance.updateMany({
      where: { offerId, cellId: null },
      data: { quantityAvailable: { increment: p.quantity }, lastReceivedAt: now },
    });
    if (updated.count === 0) {
      await tx.inventoryBalance.create({
        data: {
          productId,
          offerId,
          variantId,
          merchantId,
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
        productId,
        offerId,
        variantId,
        merchantId,
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

  // -------------------------------------------------------------------------
  // helpers
  // -------------------------------------------------------------------------

  private async requireOffer(offerId: string): Promise<ResolvedOffer> {
    const offer = await this.prisma.productOffer.findFirst({
      where: { id: offerId, deletedAt: null },
      select: { id: true, productId: true, variantId: true, merchantId: true },
    });
    if (!offer) throw new NotFoundException('Предложение не найдено');
    return {
      offerId: offer.id,
      productId: offer.productId,
      variantId: offer.variantId,
      merchantId: offer.merchantId,
    };
  }

  private async resolveDefaultOffer(productId: string, merchantId: string): Promise<ResolvedOffer> {
    const offer = await this.prisma.productOffer.findFirst({
      where: { productId, merchantId, deletedAt: null, variant: { isDefault: true } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, productId: true, variantId: true, merchantId: true },
    });
    if (!offer)
      throw new BadRequestException('У товара нет предложения этого продавца для приёмки');
    return {
      offerId: offer.id,
      productId: offer.productId,
      variantId: offer.variantId,
      merchantId: offer.merchantId,
    };
  }

  private async assertWarehouseAccess(warehouseId: string, merchantId: string): Promise<void> {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) throw new NotFoundException('Склад не найден');
    if (warehouse.merchantId !== merchantId && warehouse.type !== WarehouseType.PLATFORM) {
      throw new ForbiddenException('Нельзя принимать на этот склад');
    }
  }

  private async assertCell(cellId: string, warehouseId: string, merchantId: string): Promise<void> {
    const cell = await this.prisma.warehouseCell.findUnique({
      where: { id: cellId },
      include: { shelf: { include: { rack: { include: { zone: true } } } } },
    });
    if (!cell) throw new NotFoundException('Ячейка не найдена');
    if (cell.shelf.rack.zone.warehouseId !== warehouseId) {
      throw new BadRequestException('Ячейка не из выбранного склада');
    }
    if (cell.isBlocked || !cell.isActive)
      throw new ConflictException(`Ячейка ${cell.code} недоступна`);
    if (cell.merchantId && cell.merchantId !== merchantId) {
      throw new ForbiddenException(`Ячейка ${cell.code} арендована другим мерчантом`);
    }
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
