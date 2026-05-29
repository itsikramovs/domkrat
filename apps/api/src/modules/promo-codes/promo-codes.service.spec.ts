import { PromoDiscountType } from '@prisma/client';
import Decimal from 'decimal.js';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

import type { PrismaService } from '../../infrastructure/database/prisma.service';

import { PromoCodesService, type PromoEvalItem } from './promo-codes.service';

/**
 * Unit-тесты на ядро промокодов: валидация и расчёт скидки.
 * Атомарный recordUsage покрывается через интеграцию заказов (E2E).
 */
describe('PromoCodesService.evaluate', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: PromoCodesService;

  const USER = 'user-1';
  const now = new Date();
  const past = new Date(now.getTime() - 86_400_000);
  const future = new Date(now.getTime() + 86_400_000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const promoStub = (overrides: Record<string, unknown> = {}): any => ({
    id: 'promo-1',
    code: 'SALE',
    description: null,
    discountType: PromoDiscountType.PERCENTAGE,
    discountValue: '10',
    maxDiscountAmount: null,
    minOrderAmount: null,
    usageLimit: null,
    usageCount: 0,
    perUserLimit: null,
    validFrom: past,
    validUntil: future,
    isActive: true,
    applicableCategories: [],
    applicableMerchants: [],
    createdAt: past,
    ...overrides,
  });

  const items = (): PromoEvalItem[] => [
    { categoryId: 'cat-a', merchantId: 'm-1', lineSubtotal: '100000' },
    { categoryId: 'cat-b', merchantId: 'm-2', lineSubtotal: '50000' },
  ];

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new PromoCodesService(prisma);
    prisma.promoCodeUsage.count.mockResolvedValue(0);
  });

  it('NOT_FOUND если код не существует', async () => {
    prisma.promoCode.findUnique.mockResolvedValue(null);
    const res = await service.evaluate('nope', USER, items());
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('NOT_FOUND');
    expect(res.discount.toString()).toBe('0');
  });

  it('нормализует код в UPPERCASE при поиске', async () => {
    prisma.promoCode.findUnique.mockResolvedValue(null);
    await service.evaluate('  sale  ', USER, items());
    expect(prisma.promoCode.findUnique).toHaveBeenCalledWith({ where: { code: 'SALE' } });
  });

  it('INACTIVE если промокод выключен', async () => {
    prisma.promoCode.findUnique.mockResolvedValue(promoStub({ isActive: false }));
    const res = await service.evaluate('SALE', USER, items());
    expect(res.reason).toBe('INACTIVE');
  });

  it('NOT_STARTED до начала действия', async () => {
    prisma.promoCode.findUnique.mockResolvedValue(
      promoStub({ validFrom: future, validUntil: future }),
    );
    const res = await service.evaluate('SALE', USER, items());
    expect(res.reason).toBe('NOT_STARTED');
  });

  it('EXPIRED после окончания действия', async () => {
    prisma.promoCode.findUnique.mockResolvedValue(promoStub({ validFrom: past, validUntil: past }));
    const res = await service.evaluate('SALE', USER, items());
    expect(res.reason).toBe('EXPIRED');
  });

  it('USAGE_LIMIT при исчерпании общего лимита', async () => {
    prisma.promoCode.findUnique.mockResolvedValue(promoStub({ usageLimit: 5, usageCount: 5 }));
    const res = await service.evaluate('SALE', USER, items());
    expect(res.reason).toBe('USAGE_LIMIT');
  });

  it('USER_LIMIT при исчерпании персонального лимита', async () => {
    prisma.promoCode.findUnique.mockResolvedValue(promoStub({ perUserLimit: 1 }));
    prisma.promoCodeUsage.count.mockResolvedValue(1);
    const res = await service.evaluate('SALE', USER, items());
    expect(res.reason).toBe('USER_LIMIT');
  });

  it('MIN_ORDER если сумма меньше минимальной', async () => {
    prisma.promoCode.findUnique.mockResolvedValue(promoStub({ minOrderAmount: '200000' }));
    const res = await service.evaluate('SALE', USER, items()); // subtotal = 150000
    expect(res.reason).toBe('MIN_ORDER');
  });

  it('PERCENTAGE: 10% от всей корзины', async () => {
    prisma.promoCode.findUnique.mockResolvedValue(promoStub({ discountValue: '10' }));
    const res = await service.evaluate('SALE', USER, items()); // 150000 * 10%
    expect(res.valid).toBe(true);
    expect(res.discount.toString()).toBe('15000');
  });

  it('PERCENTAGE: скидка ограничена maxDiscountAmount', async () => {
    prisma.promoCode.findUnique.mockResolvedValue(
      promoStub({ discountValue: '50', maxDiscountAmount: '20000' }),
    );
    const res = await service.evaluate('SALE', USER, items()); // 150000*50%=75000 → cap 20000
    expect(res.discount.toString()).toBe('20000');
  });

  it('FIXED: фиксированная сумма скидки', async () => {
    prisma.promoCode.findUnique.mockResolvedValue(
      promoStub({ discountType: PromoDiscountType.FIXED, discountValue: '30000' }),
    );
    const res = await service.evaluate('SALE', USER, items());
    expect(res.discount.toString()).toBe('30000');
  });

  it('FIXED: скидка не превышает применимую сумму', async () => {
    prisma.promoCode.findUnique.mockResolvedValue(
      promoStub({ discountType: PromoDiscountType.FIXED, discountValue: '999999' }),
    );
    const res = await service.evaluate('SALE', USER, items()); // clamp to 150000
    expect(res.discount.toString()).toBe('150000');
  });

  it('applicableCategories ограничивает базу скидки', async () => {
    prisma.promoCode.findUnique.mockResolvedValue(
      promoStub({ discountValue: '10', applicableCategories: ['cat-a'] }),
    );
    const res = await service.evaluate('SALE', USER, items()); // только 100000 * 10%
    expect(res.valid).toBe(true);
    expect(res.eligibleSubtotal.toString()).toBe('100000');
    expect(res.discount.toString()).toBe('10000');
  });

  it('NOT_APPLICABLE если ни одна позиция не подходит по категории', async () => {
    prisma.promoCode.findUnique.mockResolvedValue(promoStub({ applicableCategories: ['cat-zzz'] }));
    const res = await service.evaluate('SALE', USER, items());
    expect(res.reason).toBe('NOT_APPLICABLE');
  });

  it('applicableMerchants ограничивает базу скидки', async () => {
    prisma.promoCode.findUnique.mockResolvedValue(
      promoStub({ discountValue: '10', applicableMerchants: ['m-2'] }),
    );
    const res = await service.evaluate('SALE', USER, items()); // только 50000 * 10%
    expect(res.eligibleSubtotal.toString()).toBe('50000');
    expect(res.discount.toString()).toBe('5000');
  });
});
