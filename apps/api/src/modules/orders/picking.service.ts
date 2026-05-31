import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderItemStatus, OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SubOrderEvents, type SubOrderEventPayload } from '../notifications/events';

import type { PickDto } from './dto/pick.dto';

/** Кто выполняет действие: мерчант (FBS, со сканом владельца) или админ/склад (FBO, любой). */
export interface PickActor {
  userId: string;
  merchantId?: string | null;
  role: 'MERCHANT' | 'ADMIN';
}

const PICK_ITEM_SELECT = {
  id: true,
  productId: true,
  offerId: true,
  variantId: true,
  merchantId: true,
  quantity: true,
  status: true,
  productSnapshot: true,
} satisfies Prisma.OrderItemSelect;

/**
 * WMS-сборка заказа из ячеек (фаза 4). Заменяет неявный авто-FIFO при отгрузке на явный
 * лист отбора с подтверждением ячеек. Семантика:
 *   PROCESSING → pick (физически отобрать из ячеек) → ASSEMBLED → ship → SHIPPED.
 * Списание из ячеек происходит на этапе pick; ship — только смена статуса.
 *
 * Остаток ведётся двухуровнево: агрегат предложения (cellId=null) — «доступно к продаже»
 * (его quantityAvailable уже уменьшен при резерве заказа), per-cell — физическое размещение.
 * При сборке: per-cell quantityAvailable уменьшается, агрегатный quantityReserved снимается.
 */
@Injectable()
export class PickingService {
  private readonly logger = new Logger(PickingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Загружает суб-заказ с позициями + проверка владельца (для мерчанта). */
  private async loadSubOrder(subOrderId: string, actor: PickActor) {
    const sub = await this.prisma.orderSubOrder.findUnique({
      where: { id: subOrderId },
      select: {
        id: true,
        orderId: true,
        merchantId: true,
        status: true,
        fulfillmentType: true,
        subOrderNumber: true,
        items: { select: PICK_ITEM_SELECT },
      },
    });
    if (!sub) throw new NotFoundException('Суб-заказ не найден');
    if (actor.merchantId != null && sub.merchantId !== actor.merchantId) {
      throw new ForbiddenException('Это не ваш заказ');
    }
    return sub;
  }

  /**
   * Лист отбора: по каждой позиции — ячейки с остатком (FIFO) + предложение «откуда взять».
   * Если ячеечного остатка не хватает — остаток предлагается «без ячейки» (shortfall).
   */
  async getPickList(subOrderId: string, actor: PickActor) {
    const sub = await this.loadSubOrder(subOrderId, actor);

    const items = await Promise.all(
      sub.items.map(async (it) => {
        const cells = it.offerId
          ? await this.prisma.inventoryBalance.findMany({
              where: { offerId: it.offerId, cellId: { not: null }, quantityAvailable: { gt: 0 } },
              orderBy: [{ oldestReceivedAt: 'asc' }, { lastReceivedAt: 'asc' }],
              select: {
                cellId: true,
                quantityAvailable: true,
                cell: { select: { code: true } },
              },
            })
          : [];

        let remaining = it.quantity;
        const suggested: Array<{ cellId: string; qty: number }> = [];
        for (const c of cells) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, c.quantityAvailable);
          suggested.push({ cellId: c.cellId!, qty: take });
          remaining -= take;
        }

        return {
          orderItemId: it.id,
          name: (it.productSnapshot as { name?: unknown })?.name ?? null,
          sku: (it.productSnapshot as { sku?: string })?.sku ?? null,
          quantity: it.quantity,
          status: it.status,
          cells: cells.map((c) => ({
            cellId: c.cellId,
            code: c.cell?.code ?? null,
            available: c.quantityAvailable,
          })),
          suggested,
          shortfall: remaining, // сколько нечем закрыть из ячеек (взять «без ячейки»)
        };
      }),
    );

    return {
      subOrderId: sub.id,
      status: sub.status,
      fulfillmentType: sub.fulfillmentType,
      items,
    };
  }

  /** Явная сборка: оператор подтверждает фактически отобранные ячейки/количества. */
  async pick(subOrderId: string, dto: PickDto, actor: PickActor) {
    const sub = await this.loadSubOrder(subOrderId, actor);
    if (sub.status !== OrderStatus.PROCESSING && sub.status !== OrderStatus.ASSEMBLED) {
      throw new ConflictException(`Сборка возможна из статуса PROCESSING (сейчас ${sub.status})`);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const reqItem of dto.items) {
        const it = sub.items.find((i) => i.id === reqItem.orderItemId);
        if (!it) throw new BadRequestException('Позиция не принадлежит суб-заказу');
        if (it.status === OrderItemStatus.PICKED || it.status === OrderItemStatus.SHIPPED) {
          continue; // идемпотентность: уже собрано
        }

        const total = reqItem.picks.reduce((s, p) => s + p.qty, 0);
        if (total !== it.quantity) {
          throw new BadRequestException(
            `Отобрано ${total}, требуется ${it.quantity} (позиция ${it.id})`,
          );
        }

        let primaryCell: string | null = null;
        for (const p of reqItem.picks) {
          if (p.qty <= 0) continue;
          if (p.cellId) {
            const upd = await tx.inventoryBalance.updateMany({
              where: it.offerId
                ? { offerId: it.offerId, cellId: p.cellId, quantityAvailable: { gte: p.qty } }
                : {
                    productId: it.productId,
                    merchantId: it.merchantId,
                    cellId: p.cellId,
                    quantityAvailable: { gte: p.qty },
                  },
              data: { quantityAvailable: { decrement: p.qty } },
            });
            if (upd.count === 0) {
              throw new ConflictException(`Недостаточно остатка в выбранной ячейке`);
            }
            primaryCell ??= p.cellId;
            await this.movement(tx, it, -p.qty, subOrderId, actor.userId, 'Отбор', p.cellId);
          } else {
            await this.movement(
              tx,
              it,
              -p.qty,
              subOrderId,
              actor.userId,
              'Отбор (без ячейки)',
              null,
            );
          }
        }

        // снять резерв с агрегата (quantityAvailable уже уменьшен при резерве заказа)
        await tx.inventoryBalance.updateMany({
          where: it.offerId
            ? { offerId: it.offerId, cellId: null }
            : { productId: it.productId, merchantId: it.merchantId, cellId: null },
          data: { quantityReserved: { decrement: it.quantity } },
        });
        await tx.stockReservation.updateMany({
          where: { orderItemId: it.id, releasedAt: null },
          data: { releasedAt: new Date(), releasedReason: 'picked' },
        });
        await tx.orderItem.update({
          where: { id: it.id },
          data: {
            status: OrderItemStatus.PICKED,
            pickedAt: new Date(),
            pickedById: actor.userId,
            pickedFromCellId: primaryCell,
          },
        });
      }

      // Все позиции собраны → суб-заказ ASSEMBLED
      const remainingItems = await tx.orderItem.findMany({
        where: { subOrderId },
        select: { status: true },
      });
      const allPicked = remainingItems.every(
        (i) => i.status === OrderItemStatus.PICKED || i.status === OrderItemStatus.SHIPPED,
      );
      if (allPicked && sub.status !== OrderStatus.ASSEMBLED) {
        await tx.orderSubOrder.update({
          where: { id: subOrderId },
          data: { status: OrderStatus.ASSEMBLED, assembledAt: new Date() },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: sub.orderId,
            subOrderId,
            fromStatus: sub.status,
            toStatus: OrderStatus.ASSEMBLED,
            changedById: actor.userId,
            changedByRole: actor.role,
            reason: 'Собран из ячеек',
          },
        });
        await this.bumpOrderIfAligned(tx, sub.orderId, OrderStatus.ASSEMBLED, actor.userId);
      }
    });

    return this.getPickList(subOrderId, actor);
  }

  /** Быстрая сборка одним кликом: авто-FIFO по подсказке листа отбора. */
  async autoAssemble(subOrderId: string, actor: PickActor) {
    const list = await this.getPickList(subOrderId, actor);
    const items = list.items
      .filter((i) => i.status === OrderItemStatus.PENDING || i.status === OrderItemStatus.RESERVED)
      .map((i) => {
        const picks = i.suggested.map((s) => ({ cellId: s.cellId, qty: s.qty }));
        if (i.shortfall > 0) picks.push({ cellId: null as unknown as string, qty: i.shortfall });
        if (picks.length === 0) picks.push({ cellId: null as unknown as string, qty: i.quantity });
        return { orderItemId: i.orderItemId, picks };
      });
    if (items.length === 0) return list;
    return this.pick(subOrderId, { items }, actor);
  }

  /** ASSEMBLED → SHIPPED: только смена статуса (списание уже на этапе сборки). */
  async ship(subOrderId: string, actor: PickActor) {
    const sub = await this.loadSubOrder(subOrderId, actor);
    if (sub.status !== OrderStatus.ASSEMBLED) {
      throw new ConflictException(`Отгрузка возможна из статуса ASSEMBLED (сейчас ${sub.status})`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.orderSubOrder.update({
        where: { id: subOrderId },
        data: { status: OrderStatus.SHIPPED, shippedAt: new Date() },
      });
      await tx.orderItem.updateMany({
        where: { subOrderId },
        data: { status: OrderItemStatus.SHIPPED },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: sub.orderId,
          subOrderId,
          fromStatus: OrderStatus.ASSEMBLED,
          toStatus: OrderStatus.SHIPPED,
          changedById: actor.userId,
          changedByRole: actor.role,
          reason: 'Передан в доставку',
        },
      });
      await this.bumpOrderIfAligned(tx, sub.orderId, OrderStatus.SHIPPED, actor.userId);
      return updated;
    });

    this.events.emit(SubOrderEvents.Shipped, {
      subOrderId,
      subOrderNumber: result.subOrderNumber,
      orderId: result.orderId,
      merchantId: result.merchantId,
    } satisfies SubOrderEventPayload);

    return result;
  }

  // ---------------------------------------------------------------------------
  private movement(
    tx: Prisma.TransactionClient,
    it: { productId: string; offerId: string | null; variantId: string | null; merchantId: string },
    quantity: number,
    subOrderId: string,
    userId: string,
    notes: string,
    fromCellId: string | null,
  ) {
    return tx.stockMovement.create({
      data: {
        productId: it.productId,
        offerId: it.offerId,
        variantId: it.variantId,
        merchantId: it.merchantId,
        movementType: 'SHIPMENT',
        quantity,
        fromCellId,
        referenceType: 'sub_order',
        referenceId: subOrderId,
        performedById: userId,
        notes,
      },
    });
  }

  /** Если все суб-заказы заказа в одном статусе — двигаем общий Order. */
  private async bumpOrderIfAligned(
    tx: Prisma.TransactionClient,
    orderId: string,
    status: OrderStatus,
    userId: string,
  ): Promise<void> {
    const subs = await tx.orderSubOrder.findMany({ where: { orderId }, select: { status: true } });
    if (!subs.every((s) => s.status === status)) return;

    const tsField =
      status === OrderStatus.SHIPPED
        ? 'shippedAt'
        : status === OrderStatus.PROCESSING
          ? 'confirmedAt'
          : undefined;
    await tx.order.update({
      where: { id: orderId },
      data: { status, ...(tsField ? { [tsField]: new Date() } : {}) },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: 'partial',
        toStatus: status,
        changedById: userId,
        changedByRole: 'SYSTEM',
        reason: `Все суб-заказы → ${status}`,
      },
    });
    this.logger.log(`Order ${orderId} → ${status} (все суб-заказы выровнены)`);
  }
}
