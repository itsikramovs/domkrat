import { Prisma } from '@prisma/client';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

import type { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ProductOffersService } from './product-offers.service';

const dec = (n: number) => new Prisma.Decimal(n);

const offer = (id: string, price: number, merchantId = 'm1') => ({
  id,
  sku: `SKU-${id}`,
  merchantId,
  price: dec(price),
  compareAtPrice: null,
  vatRate: dec(12),
  currency: 'UZS',
  merchant: { id: merchantId, brandName: `Brand ${merchantId}`, slug: merchantId },
});

describe('ProductOffersService.projectPrimaryOffer', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: ProductOffersService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new ProductOffersService(prisma);
  });

  it('проецирует самое дешёвое предложение (offers отсортированы asc) на legacy-поля', () => {
    const product = {
      id: 'p1',
      name: { ru: 'Товар' },
      minPrice: dec(100),
      offers: [offer('a', 100, 'm1'), offer('b', 150, 'm2')],
    };
    const p = service.projectPrimaryOffer(product);
    expect(p.price.toString()).toBe('100');
    expect(p.sku).toBe('SKU-a');
    expect(p.merchant?.brandName).toBe('Brand m1');
    expect(p.offersCount).toBe(2);
    expect(p.sellerCount).toBe(2);
    expect(p.hasMultipleSellers).toBe(true);
  });

  it('без активных предложений price берётся из minPrice, merchant null', () => {
    const p = service.projectPrimaryOffer({ id: 'p2', minPrice: dec(42), offers: [] });
    expect(p.price.toString()).toBe('42');
    expect(p.merchant).toBeNull();
    expect(p.sku).toBeNull();
    expect(p.hasMultipleSellers).toBe(false);
  });
});

describe('ProductOffersService.pickPrimaryOffer', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: ProductOffersService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new ProductOffersService(prisma);
  });

  it('возвращает null если активных предложений нет', async () => {
    prisma.productOffer.findMany.mockResolvedValue([] as never);
    expect(await service.pickPrimaryOffer('p1')).toBeNull();
  });

  it('предпочитает предложение с остатком, даже если оно дороже', async () => {
    prisma.productOffer.findMany.mockResolvedValue([
      { id: 'cheap', price: dec(100), vatRate: dec(12) },
      { id: 'instock', price: dec(120), vatRate: dec(12) },
    ] as never);
    prisma.inventoryBalance.groupBy.mockResolvedValue([
      { offerId: 'cheap', _sum: { quantityAvailable: 0 } },
      { offerId: 'instock', _sum: { quantityAvailable: 7 } },
    ] as never);
    const picked = await service.pickPrimaryOffer('p1');
    expect(picked?.id).toBe('instock');
  });

  it('если остатка нет нигде — берёт самое дешёвое', async () => {
    prisma.productOffer.findMany.mockResolvedValue([
      { id: 'cheap', price: dec(100), vatRate: dec(12) },
      { id: 'pricey', price: dec(200), vatRate: dec(12) },
    ] as never);
    prisma.inventoryBalance.groupBy.mockResolvedValue([] as never);
    const picked = await service.pickPrimaryOffer('p1');
    expect(picked?.id).toBe('cheap');
  });
});

describe('ProductOffersService bulk + CSV', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: ProductOffersService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new ProductOffersService(prisma);
    // recomputeMinPrice внутренности
    prisma.productOffer.aggregate.mockResolvedValue({ _min: { price: null } } as never);
    prisma.product.update.mockResolvedValue({} as never);
  });

  it('bulkUpdate: обновляет только свои офферы и пересчитывает minPrice', async () => {
    prisma.productOffer.findMany.mockResolvedValue([
      { id: 'o1', productId: 'p1' },
      { id: 'o2', productId: 'p1' },
    ] as never);
    prisma.productOffer.updateMany.mockResolvedValue({ count: 2 } as never);

    const res = await service.bulkUpdate('m1', ['o1', 'o2'], { price: 2000 });

    expect(res.updated).toBe(2);
    expect(prisma.productOffer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ price: expect.anything() }) }),
    );
    expect(prisma.product.update).toHaveBeenCalledTimes(1); // одна затронутая карточка p1
  });

  it('importCsv: обновляет по SKU, неизвестные пропускает с ошибкой', async () => {
    prisma.productOffer.findMany.mockResolvedValue([
      { id: 'o1', sku: 'SKU-A', productId: 'p1' },
    ] as never);
    prisma.productOffer.update.mockResolvedValue({} as never);

    const csv = 'sku,price,status\r\nSKU-A,1500,INACTIVE\r\nSKU-X,999,ACTIVE\r\n';
    const res = await service.importCsv('m1', csv);

    expect(res.updated).toBe(1);
    expect(res.skipped).toBe(1);
    expect(res.errors.some((e) => e.includes('SKU-X'))).toBe(true);
    expect(prisma.productOffer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'o1' },
        data: expect.objectContaining({ status: 'INACTIVE' }),
      }),
    );
  });

  it('importCsv: без колонки sku — ошибка', async () => {
    const res = await service.importCsv('m1', 'name,price\r\nИмя,100\r\n');
    expect(res.updated).toBe(0);
    expect(res.errors[0]).toContain('sku');
  });
});
