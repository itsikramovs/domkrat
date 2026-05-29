import { OrderStatus } from '@prisma/client';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

import type { PrismaService } from '../../../infrastructure/database/prisma.service';

import { AdminAnalyticsService } from './admin-analytics.service';

describe('AdminAnalyticsService.summary', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: AdminAnalyticsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new AdminAnalyticsService(prisma as unknown as PrismaService);

    const now = new Date();
    // 2 productive + 1 cancelled
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.order.findMany.mockResolvedValue([
      { status: OrderStatus.PAID, totalAmount: '100000', placedAt: now },
      { status: OrderStatus.COMPLETED, totalAmount: '50000', placedAt: now },
      { status: OrderStatus.CANCELLED, totalAmount: '999999', placedAt: now },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.orderSubOrder.findMany.mockResolvedValue([
      {
        merchantId: 'm-1',
        status: OrderStatus.PAID,
        subtotal: '90000',
        commissionAmount: '9000',
        merchantPayout: '81000',
      },
      {
        merchantId: 'm-2',
        status: OrderStatus.COMPLETED,
        subtotal: '40000',
        commissionAmount: '4000',
        merchantPayout: '36000',
      },
      {
        merchantId: 'm-1',
        status: OrderStatus.CANCELLED,
        subtotal: '999',
        commissionAmount: '99',
        merchantPayout: '900',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    prisma.merchant.count.mockResolvedValue(2);
    prisma.user.count.mockResolvedValue(7);
    prisma.product.count.mockResolvedValue(50);
    prisma.orderItem.groupBy.mockResolvedValue([] as never);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.merchant.findMany.mockResolvedValue([
      { id: 'm-1', brandName: 'Alpha' },
      { id: 'm-2', brandName: 'Beta' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
  });

  it('считает GMV/комиссию/выплаты только по не-отменённым', async () => {
    const r = await service.summary(30);

    expect(r.revenue.gmv).toBe('150000.00'); // 100k + 50k (cancelled исключён)
    expect(r.revenue.commission).toBe('13000.00'); // 9k + 4k
    expect(r.revenue.payout).toBe('117000.00'); // 81k + 36k
    expect(r.orders).toMatchObject({ total: 3, paid: 1, completed: 1, cancelled: 1 });
    expect(r.averageCheck).toBe('75000.00'); // 150k / 2
  });

  it('топ-мерчанты по обороту (без отменённых)', async () => {
    const r = await service.summary(30);

    expect(r.topMerchants[0]).toMatchObject({ brandName: 'Alpha', orders: 1 });
    expect(r.topMerchants.map((m) => m.brandName)).toEqual(['Alpha', 'Beta']);
  });
});
