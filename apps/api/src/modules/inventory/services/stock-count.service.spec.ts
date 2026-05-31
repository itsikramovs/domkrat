import { ConflictException, ForbiddenException } from '@nestjs/common';
import { StockCountStatus } from '@prisma/client';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

import type { PrismaService } from '../../../infrastructure/database/prisma.service';

import type { AlertsService } from './alerts.service';
import { StockCountService } from './stock-count.service';

const ADMIN = { userId: 'u-1', merchantId: null };

function count(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'sc-1',
    warehouseId: 'wh-1',
    merchantId: null,
    status: StockCountStatus.IN_PROGRESS,
    items: [
      {
        id: 'ci-1',
        offerId: 'of-1',
        productId: 'p-1',
        variantId: 'v-1',
        merchantId: 'm-1',
        cellId: 'c-A',
        cellCode: 'A-01',
        sku: 'SKU-1',
        expectedQty: 10,
        countedQty: 7, // недостача -3
      },
    ],
    ...overrides,
  };
}

describe('StockCountService.complete', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let alerts: DeepMockProxy<AlertsService>;
  let service: StockCountService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    alerts = mockDeep<AlertsService>();
    service = new StockCountService(prisma, alerts);
    (prisma.$transaction as unknown as jest.Mock).mockImplementation(
      (cb: (tx: unknown) => unknown) => cb(prisma),
    );
    prisma.inventoryBalance.updateMany.mockResolvedValue({ count: 1 } as never);
    prisma.stockMovement.create.mockResolvedValue({} as never);
    prisma.stockCount.update.mockResolvedValue({} as never);
    alerts.scan.mockResolvedValue({ created: 0 } as never);
  });

  it('недостача → ADJUSTMENT_MINUS, правка ячейки и агрегата, scan алертов', async () => {
    prisma.stockCount.findUnique
      .mockResolvedValueOnce(count() as never) // get() в complete
      .mockResolvedValueOnce({ ...count(), status: StockCountStatus.COMPLETED } as never); // финальный get()

    await service.complete('sc-1', ADMIN);

    // ячейка → фактическое значение
    expect(prisma.inventoryBalance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { offerId: 'of-1', cellId: 'c-A' },
        data: { quantityAvailable: 7 },
      }),
    );
    // агрегат корректируется на расхождение (−3)
    expect(prisma.inventoryBalance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { offerId: 'of-1', cellId: null },
        data: { quantityAvailable: { increment: -3 } },
      }),
    );
    // движение ADJUSTMENT_MINUS
    expect(prisma.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: 'ADJUSTMENT_MINUS',
          quantity: -3,
          fromCellId: 'c-A',
        }),
      }),
    );
    expect(prisma.stockCount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: StockCountStatus.COMPLETED }),
      }),
    );
    expect(alerts.scan).toHaveBeenCalled();
  });

  it('нет расхождения (counted=expected) → без движений', async () => {
    const c = count({ items: [{ ...count().items[0], countedQty: 10 }] });
    prisma.stockCount.findUnique.mockResolvedValue(c as never);

    await service.complete('sc-1', ADMIN);

    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('повторное завершение → 409', async () => {
    prisma.stockCount.findUnique.mockResolvedValue(
      count({ status: StockCountStatus.COMPLETED }) as never,
    );
    await expect(service.complete('sc-1', ADMIN)).rejects.toThrow(ConflictException);
  });

  it('чужая ревизия (merchant) → 403', async () => {
    prisma.stockCount.findUnique.mockResolvedValue(count({ merchantId: 'other' }) as never);
    await expect(service.complete('sc-1', { userId: 'u', merchantId: 'm-1' })).rejects.toThrow(
      ForbiddenException,
    );
  });
});
