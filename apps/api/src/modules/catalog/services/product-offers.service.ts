import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductOfferStatus } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { CreateProductOfferDto, UpdateProductOfferDto } from '../dto/offer.dto';
import { parseCsv, toCsv } from '../utils/csv.util';

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

  /** Предложения мерчанта (для кабинета): карточка + вариант + остаток. */
  async listForMerchant(merchantId: string) {
    const offers = await this.prisma.productOffer.findMany({
      where: { merchantId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            images: {
              where: { isPrimary: true },
              take: 1,
              select: { url: true, thumbnailUrl: true },
            },
          },
        },
        variant: { select: { id: true, name: true, isDefault: true } },
      },
    });
    if (offers.length === 0) return [];
    const stock = await this.prisma.inventoryBalance.groupBy({
      by: ['offerId'],
      where: { offerId: { in: offers.map((o) => o.id) }, cellId: null },
      _sum: { quantityAvailable: true, quantityReserved: true },
    });
    const map = new Map(stock.map((s) => [s.offerId, s._sum]));
    return offers.map((o) => ({
      ...o,
      stock: map.get(o.id)?.quantityAvailable ?? 0,
      reserved: map.get(o.id)?.quantityReserved ?? 0,
    }));
  }

  /** Проверяет, что предложение принадлежит мерчанту (для merchant-эндпоинтов). */
  async assertOwner(
    offerId: string,
    merchantId: string,
  ): Promise<{ id: string; productId: string }> {
    const offer = await this.prisma.productOffer.findFirst({
      where: { id: offerId, merchantId, deletedAt: null },
      select: { id: true, productId: true },
    });
    if (!offer) throw new ForbiddenException('Это не ваше предложение');
    return offer;
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

  // ---------------------------------------------------------------------------
  // Массовые операции + импорт/экспорт прайс-листа (Ozon-уровень управления)
  // ---------------------------------------------------------------------------

  /** Массовое изменение цены/статуса своих предложений; пересчёт minPrice затронутых карточек. */
  async bulkUpdate(
    merchantId: string,
    offerIds: string[],
    patch: { price?: number; status?: ProductOfferStatus },
  ): Promise<{ updated: number }> {
    const offers = await this.prisma.productOffer.findMany({
      where: { id: { in: offerIds }, merchantId, deletedAt: null },
      select: { id: true, productId: true },
    });
    if (offers.length === 0) return { updated: 0 };

    const data: Prisma.ProductOfferUpdateManyMutationInput = {};
    if (patch.price != null) data.price = new Prisma.Decimal(patch.price);
    if (patch.status != null) data.status = patch.status;
    if (Object.keys(data).length === 0) return { updated: 0 };

    await this.prisma.productOffer.updateMany({
      where: { id: { in: offers.map((o) => o.id) } },
      data,
    });
    for (const pid of new Set(offers.map((o) => o.productId))) {
      await this.recomputeMinPrice(pid);
    }
    return { updated: offers.length };
  }

  /** Экспорт прайс-листа мерчанта в CSV: sku,name,price,vatRate,status. */
  async exportCsv(merchantId: string): Promise<string> {
    const offers = await this.prisma.productOffer.findMany({
      where: { merchantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { name: true } } },
    });
    const rows: Array<Array<string | number>> = [['sku', 'name', 'price', 'vatRate', 'status']];
    for (const o of offers) {
      const name = (o.product?.name as { ru?: string })?.ru ?? '';
      rows.push([o.sku, name, o.price.toString(), o.vatRate.toString(), o.status]);
    }
    return toCsv(rows);
  }

  /** Импорт прайс-листа: обновляет price/vatRate/status своих предложений по SKU. */
  async importCsv(
    merchantId: string,
    csv: string,
  ): Promise<{ updated: number; skipped: number; errors: string[] }> {
    const rows = parseCsv(csv);
    if (rows.length < 2) {
      return {
        updated: 0,
        skipped: 0,
        errors: ['Пустой или некорректный CSV (нужны заголовок + строки)'],
      };
    }
    const header = rows[0]!.map((h) => h.trim().toLowerCase());
    const iSku = header.indexOf('sku');
    const iPrice = header.indexOf('price');
    const iVat = header.indexOf('vatrate');
    const iStatus = header.indexOf('status');
    if (iSku < 0) return { updated: 0, skipped: 0, errors: ['Нет обязательной колонки sku'] };

    const owned = await this.prisma.productOffer.findMany({
      where: { merchantId, deletedAt: null },
      select: { id: true, sku: true, productId: true },
    });
    const bySku = new Map(owned.map((o) => [o.sku, o]));

    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];
    const productIds = new Set<string>();

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]!;
      const sku = (row[iSku] ?? '').trim();
      if (!sku) {
        skipped++;
        continue;
      }
      const offer = bySku.get(sku);
      if (!offer) {
        skipped++;
        if (errors.length < 50) errors.push(`SKU не найден среди ваших: ${sku}`);
        continue;
      }
      const data: Prisma.ProductOfferUpdateInput = {};
      if (iPrice >= 0) {
        const p = Number((row[iPrice] ?? '').replace(/\s/g, '').replace(',', '.'));
        if (Number.isFinite(p) && p >= 0) data.price = new Prisma.Decimal(p);
      }
      if (iVat >= 0 && (row[iVat] ?? '').trim() !== '') {
        const v = Number((row[iVat] ?? '').replace(',', '.'));
        if (Number.isFinite(v) && v >= 0) data.vatRate = new Prisma.Decimal(v);
      }
      if (iStatus >= 0) {
        const s = (row[iStatus] ?? '').trim().toUpperCase();
        if (['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'].includes(s)) {
          data.status = s as ProductOfferStatus;
        }
      }
      if (Object.keys(data).length === 0) {
        skipped++;
        continue;
      }
      await this.prisma.productOffer.update({ where: { id: offer.id }, data });
      productIds.add(offer.productId);
      updated++;
    }

    for (const pid of productIds) await this.recomputeMinPrice(pid);
    return { updated, skipped, errors };
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

  /**
   * Доклеивает `totalStock` (продаваемый агрегат cellId=null по всем активным предложениям
   * карточки) к спроецированным элементам списка. Один групповой запрос, без N+1.
   */
  async attachTotalStock<T extends { offers?: Array<{ id: string }>; totalStock?: number }>(
    items: T[],
  ): Promise<T[]> {
    const offerIds = items.flatMap((i) => (i.offers ?? []).map((o) => o.id));
    if (offerIds.length === 0) {
      for (const i of items) i.totalStock = 0;
      return items;
    }
    const rows = await this.prisma.inventoryBalance.groupBy({
      by: ['offerId'],
      where: { offerId: { in: offerIds }, cellId: null },
      _sum: { quantityAvailable: true },
    });
    const map = new Map(rows.map((r) => [r.offerId, r._sum.quantityAvailable ?? 0]));
    for (const i of items) {
      i.totalStock = (i.offers ?? []).reduce((s, o) => s + (map.get(o.id) ?? 0), 0);
    }
    return items;
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
