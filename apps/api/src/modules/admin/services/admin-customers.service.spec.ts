import { NotFoundException } from '@nestjs/common';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

import type { PrismaService } from '../../../infrastructure/database/prisma.service';

import { AdminCustomersService } from './admin-customers.service';

describe('AdminCustomersService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: AdminCustomersService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new AdminCustomersService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('склеивает кол-во заказов и потраченную сумму к клиентам', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.user.findMany.mockResolvedValue([{ id: 'u-1' }, { id: 'u-2' }] as any);
      prisma.user.count.mockResolvedValue(2);
      // groupBy вызывается дважды: counts, затем spent
      prisma.order.groupBy
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockResolvedValueOnce([
          { userId: 'u-1', _count: { _all: 3 } },
          { userId: 'u-2', _count: { _all: 1 } },
        ] as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockResolvedValueOnce([{ userId: 'u-1', _sum: { totalAmount: '150000' } }] as any);

      const res = await service.list({});

      expect(res.data[0]).toMatchObject({ id: 'u-1', ordersCount: 3, totalSpent: '150000' });
      // u-2 имеет заказы, но без «потраченных» статусов → 0
      expect(res.data[1]).toMatchObject({ id: 'u-2', ordersCount: 1, totalSpent: '0' });
    });
  });

  describe('get', () => {
    it('бросает NotFound, если клиент не найден', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.get('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
