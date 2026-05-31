import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderItemStatus, OrderStatus } from '@prisma/client';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

import type { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PickingService } from '../picking.service';

const MERCHANT = { userId: 'u-1', merchantId: 'm-1', role: 'MERCHANT' as const };

function subOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'so-1',
    orderId: 'o-1',
    merchantId: 'm-1',
    status: OrderStatus.PROCESSING,
    fulfillmentType: 'FBS',
    subOrderNumber: 'SO-1',
    items: [
      {
        id: 'it-1',
        productId: 'p-1',
        offerId: 'of-1',
        variantId: 'v-1',
        merchantId: 'm-1',
        quantity: 5,
        status: OrderItemStatus.RESERVED,
        productSnapshot: { name: { ru: 'Товар' }, sku: 'SKU-1' },
      },
    ],
    ...overrides,
  };
}

describe('PickingService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let events: DeepMockProxy<EventEmitter2>;
  let service: PickingService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    events = mockDeep<EventEmitter2>();
    service = new PickingService(prisma, events);
    // $transaction(cb) → выполняем callback на том же mock-клиенте
    (prisma.$transaction as unknown as jest.Mock).mockImplementation(
      (cb: (tx: unknown) => unknown) => cb(prisma),
    );
    prisma.inventoryBalance.updateMany.mockResolvedValue({ count: 1 } as never);
    prisma.stockMovement.create.mockResolvedValue({} as never);
    prisma.stockReservation.updateMany.mockResolvedValue({ count: 1 } as never);
    prisma.orderItem.update.mockResolvedValue({} as never);
    prisma.orderItem.updateMany.mockResolvedValue({ count: 1 } as never);
    prisma.orderSubOrder.update.mockResolvedValue({
      id: 'so-1',
      orderId: 'o-1',
      merchantId: 'm-1',
      subOrderNumber: 'SO-1',
    } as never);
    prisma.orderStatusHistory.create.mockResolvedValue({} as never);
    prisma.orderSubOrder.findMany.mockResolvedValue([{ status: OrderStatus.ASSEMBLED }] as never);
    prisma.order.update.mockResolvedValue({} as never);
    prisma.inventoryBalance.findMany.mockResolvedValue([] as never);
  });

  describe('getPickList', () => {
    it('предлагает ячейки FIFO и считает shortfall', async () => {
      prisma.orderSubOrder.findUnique.mockResolvedValue(subOrder() as never);
      prisma.inventoryBalance.findMany.mockResolvedValue([
        { cellId: 'c-A', quantityAvailable: 3, cell: { code: 'A-01' } },
        { cellId: 'c-B', quantityAvailable: 10, cell: { code: 'B-02' } },
      ] as never);

      const res = await service.getPickList('so-1', MERCHANT);

      expect(res.items[0]!.suggested).toEqual([
        { cellId: 'c-A', qty: 3 },
        { cellId: 'c-B', qty: 2 },
      ]);
      expect(res.items[0]!.shortfall).toBe(0);
    });

    it('чужой суб-заказ → 403', async () => {
      prisma.orderSubOrder.findUnique.mockResolvedValue(subOrder({ merchantId: 'other' }) as never);
      await expect(service.getPickList('so-1', MERCHANT)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('pick', () => {
    it('списывает ячейку, снимает резерв, метит PICKED и переводит суб-заказ в ASSEMBLED', async () => {
      prisma.orderSubOrder.findUnique.mockResolvedValue(subOrder() as never);
      prisma.orderItem.findMany.mockResolvedValue([{ status: OrderItemStatus.PICKED }] as never);

      await service.pick(
        'so-1',
        { items: [{ orderItemId: 'it-1', picks: [{ cellId: 'c-A', qty: 5 }] }] },
        MERCHANT,
      );

      // декремент ячейки с гардом gte
      expect(prisma.inventoryBalance.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            offerId: 'of-1',
            cellId: 'c-A',
            quantityAvailable: { gte: 5 },
          }),
          data: { quantityAvailable: { decrement: 5 } },
        }),
      );
      // движение SHIPMENT из ячейки
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: 'SHIPMENT',
            quantity: -5,
            fromCellId: 'c-A',
          }),
        }),
      );
      // снятие резерва с агрегата
      expect(prisma.inventoryBalance.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { offerId: 'of-1', cellId: null },
          data: { quantityReserved: { decrement: 5 } },
        }),
      );
      // позиция → PICKED + pickedFromCellId
      expect(prisma.orderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'it-1' },
          data: expect.objectContaining({
            status: OrderItemStatus.PICKED,
            pickedFromCellId: 'c-A',
          }),
        }),
      );
      // суб-заказ → ASSEMBLED
      expect(prisma.orderSubOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: OrderStatus.ASSEMBLED }),
        }),
      );
    });

    it('сумма отбора ≠ количеству → 400', async () => {
      prisma.orderSubOrder.findUnique.mockResolvedValue(subOrder() as never);
      await expect(
        service.pick(
          'so-1',
          { items: [{ orderItemId: 'it-1', picks: [{ cellId: 'c-A', qty: 3 }] }] },
          MERCHANT,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('недостаточно в ячейке (count=0) → 409', async () => {
      prisma.orderSubOrder.findUnique.mockResolvedValue(subOrder() as never);
      prisma.inventoryBalance.updateMany.mockResolvedValueOnce({ count: 0 } as never);
      await expect(
        service.pick(
          'so-1',
          { items: [{ orderItemId: 'it-1', picks: [{ cellId: 'c-A', qty: 5 }] }] },
          MERCHANT,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('идемпотентность: уже PICKED-позиция пропускается (без повторного списания)', async () => {
      const sub = subOrder({
        status: OrderStatus.ASSEMBLED,
        items: [{ ...subOrder().items[0], status: OrderItemStatus.PICKED }],
      });
      prisma.orderSubOrder.findUnique.mockResolvedValue(sub as never);
      prisma.orderItem.findMany.mockResolvedValue([{ status: OrderItemStatus.PICKED }] as never);

      await service.pick(
        'so-1',
        { items: [{ orderItemId: 'it-1', picks: [{ cellId: 'c-A', qty: 5 }] }] },
        MERCHANT,
      );

      expect(prisma.orderItem.update).not.toHaveBeenCalled();
      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('ship', () => {
    it('ASSEMBLED → SHIPPED без списания со склада', async () => {
      prisma.orderSubOrder.findUnique.mockResolvedValue(
        subOrder({ status: OrderStatus.ASSEMBLED }) as never,
      );

      await service.ship('so-1', MERCHANT);

      expect(prisma.orderSubOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: OrderStatus.SHIPPED }) }),
      );
      // никаких складских списаний на отгрузке (всё сделано при сборке)
      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.updateMany).not.toHaveBeenCalled();
      expect(events.emit).toHaveBeenCalled();
    });

    it('из не-ASSEMBLED → 409', async () => {
      prisma.orderSubOrder.findUnique.mockResolvedValue(
        subOrder({ status: OrderStatus.PROCESSING }) as never,
      );
      await expect(service.ship('so-1', MERCHANT)).rejects.toThrow(ConflictException);
    });
  });
});
