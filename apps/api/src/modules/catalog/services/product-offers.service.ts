import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductOfferStatus } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { CreateProductOfferDto, UpdateProductOfferDto } from '../dto/offer.dto';

export const OFFER_MERCHANT_SELECT = { id: true, brandName: true, slug: true } as const;

/** Include для проекции «основного предложения» на legacy-поля карточки (ACTIVE, самое дешёвое — первым). */
export const PUBLIC_OFFERS_INCLUDE = {
  where: { status: ProductOfferStatus.ACTIVE, deletedAt: null },
  orderBy: { price: 'asc' as const },
  include: { merchant: { select: OFFER_MERCHANT_SELECT } },
} satisfies Prisma.Product$offersArgs;

type ProjectableOffer = {
  id: string;
  sku: string;
  merchantId: string;
  price: Prisma.Decimal;
  compareAtPrice: Prisma.Decimal | null;
  vatRate: Prisma.Decimal;
  currency: string;
  merchant: { id: string; brandName: string; slug: string };
};

@Injectable()
export class ProductOffersService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Проекция (обратная совместимость витрины)
  // -------------------------------------------------------------------------

  /**
   * Проецирует «основное предложение» (самое дешёвое ACTIVE) на legacy-поля карточки —
   * price/compareAtPrice/vatRate/currency/sku/merchant — чтобы существующая витрина и
   * корзина продолжали работать без изменений. offers должны быть загружены через
   * PUBLIC_OFFERS_INCLUDE (отфильтрованы ACTIVE и отсортированы по цене asc).
   */
  projectPrimaryOffer<T extends { offers?: ProjectableOffer[]; minPrice?: Prisma.Decimal | null }>(
    product: T,
  ) {
    const offers = product.offers ?? [];
    const primary = offers[0] ?? null;
    const sellerCount = new Set(offers.map((o) => o.merchantId)).size;
    return {
      ...product,
      offers,
      price: primary?.price ?? product.minPrice ?? new Prisma.Decimal(0),
      compareAtPrice: primary?.compareAtPrice ?? null,
      vatRate: primary?.vatRate ?? new Prisma.Decimal(12),
      currency: primary?.currency ?? 'UZS',
      sku: primary?.sku ?? null,
      merchant: primary?.merchant ?? null,
      offersCount: offers.length,
      sellerCount,
      hasMultipleSellers: sellerCount > 1,
    };
  }

  /**
   * Выбирает «основное предложение» с учётом остатка: среди ACTIVE-предложений
   * (карточка тоже ACTIVE) — сначала с остатком (агрегат cellId=null > 0), затем самое
   * дешёвое; tiebreak по createdAt. Используется корзиной при добавлении по productId.
   */
  async pickPrimaryOffer(
    productId: string,
  ): Promise<{ id: string; price: Prisma.Decimal; vatRate: Prisma.Decimal } | null> {
    const offers = await this.prisma.productOffer.findMany({
      where: {
        productId,
        status: ProductOfferStatus.ACTIVE,
        deletedAt: null,
        product: { status: 'ACTIVE', deletedAt: null },
      },
      orderBy: [{ price: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, price: true, vatRate: true },
    });
    if (offers.length === 0) return null;
    const stock = await this.prisma.inventoryBalance.groupBy({
      by: ['offerId'],
      where: { offerId: { in: offers.map((o) => o.id) }, cellId: null },
      _sum: { quantityAvailable: true },
    });
    const stockMap = new Map(stock.map((s) => [s.offerId, s._sum.quantityAvailable ?? 0]));
    const inStock = offers.find((o) => (stockMap.get(o.id) ?? 0) > 0);
    return inStock ?? offers[0];
  }

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  /** Все предложения карточки (для всех продавцов) + продаваемый остаток по каждому. */
  async listForProduct(productId: string) {
    const offers = await this.prisma.productOffer.findMany({
      where: { productId, deletedAt: null },
      orderBy: [{ price: 'asc' }],
      include: {
        merchant: { select: OFFER_MERCHANT_SELECT },
        variant: { select: { id: true, name: true, isDefault: true } },
      },
    });
    if (offers.length === 0) return [];
    const stock = await this.prisma.inventoryBalance.groupBy({
      by: ['offerId'],
      where: { offerId: { in: offers.map((o) => o.id) }, cellId: null },
      _sum: { quantityAvailable: true, quantityReserved: true },
    });
    const stockMap = new Map(stock.map((s) => [s.offerId, s._sum]));
    return offers.map((o) => ({
      ...o,
      stock: stockMap.get(o.id)?.quantityAvailable ?? 0,
      reserved: stockMap.get(o.id)?.quantityReserved ?? 0,
    }));
  }

  /** Добавить предложение продавца на существующий вариант (мультипродавец). */
  async attach(productId: string, dto: CreateProductOfferDto) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: dto.variantId, productId },
      select: { id: true },
    });
    if (!variant) throw new NotFoundException('Вариант не найден у этой карточки');
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: dto.merchantId },
      select: { id: true },
    });
    if (!merchant) throw new BadRequestException('Мерчант не найден');

    try {
      const offer = await this.prisma.productOffer.create({
        data: {
          productId,
          variantId: dto.variantId,
          merchantId: dto.merchantId,
          sku: dto.sku,
          price: new Prisma.Decimal(dto.price),
          compareAtPrice:
            dto.compareAtPrice != null ? new Prisma.Decimal(dto.compareAtPrice) : null,
          costPrice: dto.costPrice != null ? new Prisma.Decimal(dto.costPrice) : null,
          vatRate: dto.vatRate != null ? new Prisma.Decimal(dto.vatRate) : new Prisma.Decimal(12),
          currency: dto.currency ?? 'UZS',
          status: dto.status ?? ProductOfferStatus.ACTIVE,
        },
      });
      await this.recomputeMinPrice(productId);
      return offer;
    } catch (error) {
      this.handleUniqueErr(error);
    }
  }

  async update(offerId: string, dto: UpdateProductOfferDto) {
    const offer = await this.prisma.productOffer.findUnique({
      where: { id: offerId },
      select: { id: true, productId: true },
    });
    if (!offer) throw new NotFoundException('Предложение не найдено');
    const data: Prisma.ProductOfferUpdateInput = {};
    if (dto.sku !== undefined) data.sku = dto.sku;
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    if (dto.compareAtPrice !== undefined)
      data.compareAtPrice =
        dto.compareAtPrice != null ? new Prisma.Decimal(dto.compareAtPrice) : null;
    if (dto.costPrice !== undefined)
      data.costPrice = dto.costPrice != null ? new Prisma.Decimal(dto.costPrice) : null;
    if (dto.vatRate !== undefined) data.vatRate = new Prisma.Decimal(dto.vatRate);
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.status !== undefined) data.status = dto.status;

    try {
      const updated = await this.prisma.productOffer.update({ where: { id: offerId }, data });
      await this.recomputeMinPrice(offer.productId);
      return updated;
    } catch (error) {
      this.handleUniqueErr(error);
    }
  }

  async setStatus(offerId: string, status: ProductOfferStatus) {
    const offer = await this.prisma.productOffer.findUnique({
      where: { id: offerId },
      select: { id: true, productId: true },
    });
    if (!offer) throw new NotFoundException('Предложение не найдено');
    const updated = await this.prisma.productOffer.update({
      where: { id: offerId },
      data: { status },
    });
    await this.recomputeMinPrice(offer.productId);
    return updated;
  }

  async remove(offerId: string): Promise<{ ok: true }> {
    const offer = await this.prisma.productOffer.findUnique({
      where: { id: offerId },
      select: { id: true, productId: true },
    });
    if (!offer) throw new NotFoundException('Предложение не найдено');
    await this.prisma.productOffer.update({
      where: { id: offerId },
      data: { deletedAt: new Date(), status: ProductOfferStatus.INACTIVE },
    });
    await this.recomputeMinPrice(offer.productId);
    return { ok: true };
  }

  /** Пересчитывает Product.minPrice = минимальная цена среди ACTIVE-предложений (или null). */
  async recomputeMinPrice(productId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    const agg = await client.productOffer.aggregate({
      where: { productId, status: ProductOfferStatus.ACTIVE, deletedAt: null },
      _min: { price: true },
    });
    await client.product.update({
      where: { id: productId },
      data: { minPrice: agg._min.price ?? null },
    });
  }

  /** Резолвит offerId для приёмки: явный offerId, либо дефолтный offer мерчанта на карточке. */
  async resolveOfferForReceiving(params: {
    offerId?: string;
    productId?: string;
    merchantId?: string;
  }): Promise<{ id: string; productId: string; variantId: string; merchantId: string }> {
    if (params.offerId) {
      const offer = await this.prisma.productOffer.findFirst({
        where: { id: params.offerId, deletedAt: null },
        select: { id: true, productId: true, variantId: true, merchantId: true },
      });
      if (!offer) throw new NotFoundException('Предложение не найдено');
      return offer;
    }
    if (!params.productId) throw new BadRequestException('Нужен offerId или productId');
    const where: Prisma.ProductOfferWhereInput = {
      productId: params.productId,
      deletedAt: null,
      ...(params.merchantId ? { merchantId: params.merchantId } : {}),
      variant: { isDefault: true },
    };
    const offer = await this.prisma.productOffer.findFirst({
      where,
      orderBy: { createdAt: 'asc' },
      select: { id: true, productId: true, variantId: true, merchantId: true },
    });
    if (!offer) throw new NotFoundException('Нет предложения для приёмки на этом товаре');
    return offer;
  }

  /** Уникальные productId для набора предложений (для активации карточек после приёмки). */
  async productIdsForOffers(offerIds: string[]): Promise<string[]> {
    const rows = await this.prisma.productOffer.findMany({
      where: { id: { in: offerIds } },
      select: { productId: true },
    });
    return [...new Set(rows.map((r) => r.productId))];
  }

  private handleUniqueErr(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined)?.join(',') ?? '';
      if (target.includes('variant_id'))
        throw new BadRequestException('У этого продавца уже есть предложение на данный вариант');
      throw new BadRequestException('SKU уже занят у этого продавца');
    }
    throw error as Error;
  }
}
