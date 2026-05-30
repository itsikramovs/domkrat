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
