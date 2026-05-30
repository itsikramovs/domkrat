import { AlertSeverity, AlertStatus, AlertType } from '@prisma/client';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

import type { PrismaService } from '../../../infrastructure/database/prisma.service';

import { AlertsService } from './alerts.service';

/**
 * Алерты остатков ведутся по предложению (offer), а не по (product, merchant):
 * в маркетплейс-модели у одного продавца на одной карточке может быть несколько
 * вариантов с разным остатком, и каждый требует своего алерта.
 */
describe('AlertsService.scan (per-offer)', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: AlertsService;

  const balance = (overrides: Partial<Record<string, unknown>> = {}) => ({
    offerId: 'o-1',
    productId: 'p-1',
    variantId: 'v-1',
    merchantId: 'm-1',
    quantityAvailable: 0,
    ...overrides,
  });

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new AlertsService(prisma);
    // По умолчанию: первый findMany — агрегаты (cellId null), второй — ячейки (stale) пуст.
    prisma.inventoryBalance.findMany
      .mockResolvedValueOnce([balance()] as never)
      .mockResolvedValueOnce([] as never);
    prisma.inventoryAlert.findFirst.mockResolvedValue(null as never);
    prisma.inventoryAlert.create.mockResolvedValue({} as never);
    prisma.inventoryAlert.updateMany.mockResolvedValue({ count: 0 } as never);
  });

  it('остаток 0 → создаёт OUT_OF_STOCK с offerId/variantId/productId/merchantId', async () => {
    const res = await service.scan();

    expect(res.created).toBe(1);
    expect(prisma.inventoryAlert.create).toHaveBeenCalledTimes(1);
    const data = prisma.inventoryAlert.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      offerId: 'o-1',
      variantId: 'v-1',
      productId: 'p-1',
      merchantId: 'm-1',
      alertType: AlertType.OUT_OF_STOCK,
      severity: AlertSeverity.CRITICAL,
      status: AlertStatus.ACTIVE,
    });
    // дедуп — по offerId, а не по (product, merchant)
    expect(prisma.inventoryAlert.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { offerId: 'o-1', alertType: AlertType.OUT_OF_STOCK, status: AlertStatus.ACTIVE },
      }),
    );
    // авто-resolve противоположного типа — тоже по offerId
    expect(prisma.inventoryAlert.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          offerId: 'o-1',
          alertType: { in: [AlertType.LOW_STOCK] },
        }),
      }),
    );
  });

  it('остаток ниже порога → LOW_STOCK (WARNING)', async () => {
    prisma.inventoryBalance.findMany.mockReset();
    prisma.inventoryBalance.findMany
      .mockResolvedValueOnce([balance({ quantityAvailable: 3 })] as never)
      .mockResolvedValueOnce([] as never);

    const res = await service.scan();

    expect(res.created).toBe(1);
    const data = prisma.inventoryAlert.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      offerId: 'o-1',
      alertType: AlertType.LOW_STOCK,
      severity: AlertSeverity.WARNING,
    });
  });

  it('дедуп: уже есть ACTIVE-алерт того же типа на offer → не дублирует', async () => {
    prisma.inventoryAlert.findFirst.mockReset();
    prisma.inventoryAlert.findFirst.mockResolvedValue({ id: 'existing' } as never);

    const res = await service.scan();

    expect(res.created).toBe(0);
    expect(prisma.inventoryAlert.create).not.toHaveBeenCalled();
  });

  it('достаточный остаток → ничего не создаёт, резолвит low+out по offerId', async () => {
    prisma.inventoryBalance.findMany.mockReset();
    prisma.inventoryBalance.findMany
      .mockResolvedValueOnce([balance({ quantityAvailable: 100 })] as never)
      .mockResolvedValueOnce([] as never);

    const res = await service.scan();

    expect(res.created).toBe(0);
    expect(prisma.inventoryAlert.create).not.toHaveBeenCalled();
    expect(prisma.inventoryAlert.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          offerId: 'o-1',
          alertType: { in: [AlertType.LOW_STOCK, AlertType.OUT_OF_STOCK] },
        }),
      }),
    );
  });
});
