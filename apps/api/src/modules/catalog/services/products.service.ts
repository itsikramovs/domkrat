import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, ProductOfferStatus, ProductStatus } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { CreateCompatibilityDto } from '../dto/compatibility.dto';
import type {
  AdminCreateProductDto,
  CreateProductDto,
  ModerateProductDto,
  ProductAttributeValueDto,
  UpdateProductDto,
  UpdateProductStatusDto,
} from '../dto/create-product.dto';
import { ListProductsDto, ProductSort } from '../dto/list-products.dto';
import { ProductOffersService, PUBLIC_OFFERS_INCLUDE } from './product-offers.service';
import { ProductVariantsService } from './product-variants.service';

const PRODUCT_INCLUDE = {
  images: { orderBy: { position: 'asc' } },
  brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
  category: { select: { id: true, name: true, slug: true } },
  offers: PUBLIC_OFFERS_INCLUDE,
  variants: { where: { isDefault: true } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly offers: ProductOffersService,
    private readonly variants: ProductVariantsService,
  ) {}

  /** Уведомить поисковый индекс об изменении товара */
  private emitIndexed(productId: string): void {
    this.events.emit('product.indexed', productId);
  }

  private emitRemoved(productId: string): void {
    this.events.emit('product.removed', productId);
  }

  /** Проецирует «основное предложение» на legacy-поля карточки (price/merchant/sku). */
  private project<
    T extends { offers?: Parameters<ProductOffersService['projectPrimaryOffer']>[0]['offers'] },
  >(p: T) {
    return this.offers.projectPrimaryOffer(p);
  }

  // -------------------------------------------------------------------------
  // PUBLIC
  // -------------------------------------------------------------------------

  async listPublic(query: ListProductsDto, opts?: { adminMode?: boolean }) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;

    const where: Prisma.ProductWhereInput = { deletedAt: null };
    if (opts?.adminMode) {
      // Админ-модерация: показываем любой статус, фильтр по query.status опционален.
      if (query.status) where.status = query.status;
    } else {
      where.status = ProductStatus.ACTIVE;
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.categorySlug) where.category = { slug: query.categorySlug };
    if (query.brandId) where.brandId = query.brandId;
    if (query.brandSlug) where.brand = { slug: query.brandSlug };
    if (query.merchantId)
      where.offers = { some: { merchantId: query.merchantId, deletedAt: null } };
    if (query.featured) where.isFeatured = true;
    if (query.onSale) where.isOnSale = true;
    if (query.isNew) where.isNew = true;

    // Фильтр по совместимости: если указана модификация — товар подойдёт когда
    // ProductCompatibility ссылается на эту модификацию, ИЛИ на её модель, ИЛИ на марку.
    const compat = await this.buildCompatibilityFilter(query);
    if (compat) where.compatibilities = { some: compat };
    // Цена живёт на предложениях; фильтруем по денормализованному minPrice карточки.
    if (query.priceMin !== undefined || query.priceMax !== undefined) {
      where.minPrice = {};
      if (query.priceMin !== undefined) where.minPrice.gte = new Prisma.Decimal(query.priceMin);
      if (query.priceMax !== undefined) where.minPrice.lte = new Prisma.Decimal(query.priceMax);
    }
    if (query.search) {
      // Простой ILIKE поиск по oem/sku предложений; FTS на name JSONB — Phase 2.
      where.OR = [
        { oemNumber: { contains: query.search, mode: 'insensitive' } },
        { manufacturerPartNumber: { contains: query.search, mode: 'insensitive' } },
        { offers: { some: { sku: { contains: query.search, mode: 'insensitive' } } } },
      ];
    }

    // Фильтр по характеристикам: "slug:val1,val2;slug2:val3"
    const attrConditions = this.parseAttrFilter(query.attrs);
    if (attrConditions.length > 0) {
      where.AND = attrConditions;
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = (() => {
      switch (query.sort) {
        case ProductSort.NEW:
          return [{ publishedAt: 'desc' }];
        case ProductSort.PRICE_ASC:
          return [{ minPrice: 'asc' }];
        case ProductSort.PRICE_DESC:
          return [{ minPrice: 'desc' }];
        case ProductSort.RATING:
          return [{ rating: 'desc' }, { reviewsCount: 'desc' }];
        case ProductSort.POPULAR:
        default:
          return [{ purchaseCount: 'desc' }, { viewCount: 'desc' }];
      }
    })();

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: items.map((p) => this.project(p)),
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async getBySlugPublic(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null, status: ProductStatus.ACTIVE },
      include: {
        ...PRODUCT_INCLUDE,
        variants: { orderBy: [{ isDefault: 'desc' }, { position: 'asc' }] },
        attributes: { include: { attribute: true } },
        oemCodes: true,
        compatibilities: {
          include: {
            carMake: true,
            carModel: { include: { make: true } },
            carModification: {
              include: { generation: { include: { model: { include: { make: true } } } } },
            },
          },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    // Side-effect: view count
    await this.prisma.product.update({
      where: { id: product.id },
      data: { viewCount: { increment: 1 } },
    });
    return this.project(product);
  }

  async searchByOem(oem: string) {
    if (!oem || oem.length < 3) {
      throw new BadRequestException('OEM query is too short');
    }
    const items = await this.prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        deletedAt: null,
        OR: [
          { oemNumber: { contains: oem, mode: 'insensitive' } },
          { manufacturerPartNumber: { contains: oem, mode: 'insensitive' } },
          { oemCodes: { some: { oemNumber: { contains: oem, mode: 'insensitive' } } } },
        ],
      },
      include: PRODUCT_INCLUDE,
      take: 50,
    });
    return items.map((p) => this.project(p));
  }

  // -------------------------------------------------------------------------
  // MERCHANT
  // -------------------------------------------------------------------------

  async listForMerchant(merchantId: string, query: ListProductsDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      OR: [{ createdByMerchantId: merchantId }, { offers: { some: { merchantId } } }],
    };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.search) {
      where.AND = [
        {
          OR: [
            { oemNumber: { contains: query.search, mode: 'insensitive' } },
            { offers: { some: { sku: { contains: query.search, mode: 'insensitive' } } } },
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: items.map((p) => this.project(p)),
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async getForMerchant(merchantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [{ createdByMerchantId: merchantId }, { offers: { some: { merchantId } } }],
      },
      include: {
        ...PRODUCT_INCLUDE,
        variants: { orderBy: [{ isDefault: 'desc' }, { position: 'asc' }] },
        attributes: { include: { attribute: true } },
        oemCodes: true,
        compatibilities: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.project(product);
  }

  async create(merchantId: string, dto: CreateProductDto) {
    const slug = dto.slug ?? this.toSlug(dto.name.ru) + '-' + dto.sku.toLowerCase().slice(0, 8);

    try {
      const productId = await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            createdByMerchantId: merchantId,
            categoryId: dto.categoryId,
            brandId: dto.brandId,
            slug,
            name: dto.name as unknown as Prisma.InputJsonValue,
            description: dto.description as unknown as Prisma.InputJsonValue,
            shortDescription: dto.shortDescription as unknown as Prisma.InputJsonValue,
            oemNumber: dto.oemNumber,
            barcode: dto.barcode,
            manufacturerPartNumber: dto.manufacturerPartNumber,
            weight: dto.weight !== undefined ? new Prisma.Decimal(dto.weight) : undefined,
            minPrice: new Prisma.Decimal(dto.price),
            status: dto.status ?? ProductStatus.PENDING_REVIEW,
          },
        });
        const variant = await tx.productVariant.create({
          data: { productId: product.id, name: Prisma.JsonNull, position: 0, isDefault: true },
        });
        await tx.productOffer.create({
          data: {
            productId: product.id,
            variantId: variant.id,
            merchantId,
            sku: dto.sku,
            price: new Prisma.Decimal(dto.price),
            compareAtPrice:
              dto.compareAtPrice !== undefined ? new Prisma.Decimal(dto.compareAtPrice) : null,
            vatRate:
              dto.vatRate !== undefined ? new Prisma.Decimal(dto.vatRate) : new Prisma.Decimal(12),
            status: ProductOfferStatus.ACTIVE,
          },
        });
        if (dto.attributes !== undefined) {
          await this.syncAttributes(tx, product.id, dto.attributes);
        }
        return product.id;
      });
      this.emitIndexed(productId);
      return this.findProjected(productId);
    } catch (error) {
      this.handleUniqueErr(error);
    }
  }

  async update(merchantId: string, id: string, dto: UpdateProductDto) {
    await this.ensureOwnership(merchantId, id);
    return this.applyUpdate(id, dto, { merchantId });
  }

  /** Обновление товара админом (за любого мерчанта, без проверки владельца). */
  async adminUpdate(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Product not found');
    return this.applyUpdate(id, dto);
  }

  private async applyUpdate(id: string, dto: UpdateProductDto, ctx?: { merchantId?: string }) {
    // Контентные поля → карточка (Product)
    const data: Prisma.ProductUpdateInput = {};
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.name !== undefined) data.name = dto.name as unknown as Prisma.InputJsonValue;
    if (dto.description !== undefined)
      data.description = dto.description as unknown as Prisma.InputJsonValue;
    if (dto.shortDescription !== undefined)
      data.shortDescription = dto.shortDescription as unknown as Prisma.InputJsonValue;
    if (dto.oemNumber !== undefined) data.oemNumber = dto.oemNumber;
    if (dto.barcode !== undefined) data.barcode = dto.barcode;
    if (dto.manufacturerPartNumber !== undefined)
      data.manufacturerPartNumber = dto.manufacturerPartNumber;
    if (dto.weight !== undefined) data.weight = new Prisma.Decimal(dto.weight);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.categoryId !== undefined) data.category = { connect: { id: dto.categoryId } };
    if (dto.brandId !== undefined)
      data.brand = dto.brandId ? { connect: { id: dto.brandId } } : { disconnect: true };

    // Продающие поля (price/sku/...) → предложение продавца, а не карточка
    const offerData: Prisma.ProductOfferUpdateInput = {};
    if (dto.sku !== undefined) offerData.sku = dto.sku;
    if (dto.price !== undefined) offerData.price = new Prisma.Decimal(dto.price);
    if (dto.compareAtPrice !== undefined)
      offerData.compareAtPrice =
        dto.compareAtPrice !== null ? new Prisma.Decimal(dto.compareAtPrice) : null;
    if (dto.vatRate !== undefined) offerData.vatRate = new Prisma.Decimal(dto.vatRate);
    const hasOfferChanges = Object.keys(offerData).length > 0;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.product.update({ where: { id }, data });
        if (dto.attributes !== undefined) {
          await this.syncAttributes(tx, id, dto.attributes);
        }
        if (hasOfferChanges) {
          const target = await this.resolveEditableOffer(tx, id, ctx?.merchantId);
          if (target) {
            await tx.productOffer.update({ where: { id: target }, data: offerData });
            await this.offers.recomputeMinPrice(id, tx);
          }
        }
      });
      this.emitIndexed(id);
      return this.findProjected(id);
    } catch (error) {
      this.handleUniqueErr(error);
    }
  }

  /** Какое предложение редактируется при правке через legacy-форму: мерчанта, либо единственное. */
  private async resolveEditableOffer(
    tx: Prisma.TransactionClient,
    productId: string,
    merchantId?: string,
  ): Promise<string | null> {
    if (merchantId) {
      const own = await tx.productOffer.findFirst({
        where: { productId, merchantId, deletedAt: null },
        select: { id: true },
      });
      return own?.id ?? null;
    }
    const all = await tx.productOffer.findMany({
      where: { productId, deletedAt: null },
      select: { id: true },
      take: 2,
    });
    return all.length === 1 ? all[0].id : null;
  }

  /**
   * Полностью заменяет набор характеристик товара. Пустые значения отбрасываются,
   * чтобы не плодить пустые ProductAttribute (фильтры/спеки опираются на наличие значения).
   */
  private async syncAttributes(
    tx: Prisma.TransactionClient,
    productId: string,
    attributes: ProductAttributeValueDto[],
  ): Promise<void> {
    await tx.productAttribute.deleteMany({ where: { productId } });
    const rows = attributes
      .filter((a) => this.hasValue(a))
      .map((a) => ({
        productId,
        attributeId: a.attributeId,
        valueString: a.valueString ?? null,
        valueNumber: a.valueNumber !== undefined ? new Prisma.Decimal(a.valueNumber) : null,
        valueBoolean: a.valueBoolean ?? null,
        valueEnum: a.valueEnum ?? null,
        valueMultiEnum: a.valueMultiEnum ?? [],
      }));
    if (rows.length > 0) {
      await tx.productAttribute.createMany({ data: rows, skipDuplicates: true });
    }
  }

  private hasValue(a: ProductAttributeValueDto): boolean {
    return (
      (a.valueString !== undefined && a.valueString !== '') ||
      a.valueNumber !== undefined ||
      a.valueBoolean !== undefined ||
      (a.valueEnum !== undefined && a.valueEnum !== '') ||
      (a.valueMultiEnum !== undefined && a.valueMultiEnum.length > 0)
    );
  }

  async updateStatus(merchantId: string, id: string, dto: UpdateProductStatusDto) {
    await this.ensureOwnership(merchantId, id);
    const allowed: ProductStatus[] = [
      ProductStatus.ACTIVE,
      ProductStatus.INACTIVE,
      ProductStatus.DRAFT,
    ];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException('Merchant can set only ACTIVE, INACTIVE or DRAFT');
    }
    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        status: dto.status,
        publishedAt: dto.status === ProductStatus.ACTIVE ? new Date() : undefined,
      },
    });
    if (dto.status === ProductStatus.ACTIVE) this.emitIndexed(id);
    else this.emitRemoved(id);
    return updated;
  }

  async remove(merchantId: string, id: string): Promise<void> {
    await this.ensureOwnership(merchantId, id);
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    this.emitRemoved(id);
  }

  // ----- Compatibility -----
  async listCompatibility(merchantId: string, productId: string) {
    await this.ensureOwnership(merchantId, productId);
    return this.prisma.productCompatibility.findMany({
      where: { productId },
      include: {
        carMake: true,
        carModel: { include: { make: true } },
        carModification: {
          include: { generation: { include: { model: { include: { make: true } } } } },
        },
      },
    });
  }

  async addCompatibility(merchantId: string, productId: string, dto: CreateCompatibilityDto) {
    await this.ensureOwnership(merchantId, productId);
    if (!dto.carModificationId && !dto.carModelId && !dto.carMakeId) {
      throw new BadRequestException(
        'At least one of car_modification_id / car_model_id / car_make_id required',
      );
    }
    return this.prisma.productCompatibility.create({
      data: { productId, ...dto },
    });
  }

  async removeCompatibility(
    merchantId: string,
    productId: string,
    compatId: string,
  ): Promise<void> {
    await this.ensureOwnership(merchantId, productId);
    const compat = await this.prisma.productCompatibility.findUnique({ where: { id: compatId } });
    if (!compat || compat.productId !== productId) {
      throw new NotFoundException('Compatibility not found');
    }
    await this.prisma.productCompatibility.delete({ where: { id: compatId } });
  }

  // -------------------------------------------------------------------------
  // ADMIN
  // -------------------------------------------------------------------------

  listAll(query: ListProductsDto) {
    return this.listPublic({ ...query }, { adminMode: true });
  }

  /** Админ создаёт карточку за мерчанта (контент + дефолтный вариант + первое предложение). Всегда DRAFT. */
  async adminCreate(dto: AdminCreateProductDto) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: dto.merchantId },
      select: { id: true },
    });
    if (!merchant) throw new BadRequestException('Мерчант не найден');
    return this.create(dto.merchantId, { ...dto, status: ProductStatus.DRAFT });
  }

  /** Детальная карточка для админки: атрибуты, изображения, варианты, предложения + остаток. */
  async adminGet(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...PRODUCT_INCLUDE,
        variants: { orderBy: [{ isDefault: 'desc' }, { position: 'asc' }] },
        attributes: { include: { attribute: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    const offers = await this.offers.listForProduct(id);
    return { ...this.project(product), offers };
  }

  /** Загружает карточку по id и проецирует (для возврата из create/update). */
  private async findProjected(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id },
      include: {
        ...PRODUCT_INCLUDE,
        variants: { orderBy: [{ isDefault: 'desc' }, { position: 'asc' }] },
        attributes: { include: { attribute: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.project(product);
  }

  // ----- Admin images (no ownership check; merchantId derived from product) -----
  private async merchantIdOf(productId: string): Promise<string> {
    const p = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { createdByMerchantId: true, offers: { take: 1, select: { merchantId: true } } },
    });
    if (!p) throw new NotFoundException('Product not found');
    const merchantId = p.createdByMerchantId ?? p.offers[0]?.merchantId;
    if (!merchantId) throw new NotFoundException('Product has no merchant');
    return merchantId;
  }

  async adminAddImage(
    productId: string,
    data: {
      url: string;
      thumbnailUrl?: string;
      width?: number;
      height?: number;
      fileSize?: number;
      isPrimary?: boolean;
    },
  ) {
    return this.addImage(await this.merchantIdOf(productId), productId, data);
  }

  async adminRemoveImage(productId: string, imageId: string) {
    return this.removeImage(await this.merchantIdOf(productId), productId, imageId);
  }

  async adminSetPrimaryImage(productId: string, imageId: string) {
    return this.setPrimaryImage(await this.merchantIdOf(productId), productId, imageId);
  }

  /** Активировать карточку после прихода/модерации — делает её продаваемой. */
  async adminActivate(id: string) {
    const updated = await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.ACTIVE, publishedAt: new Date() },
    });
    this.emitIndexed(id);
    return updated;
  }

  async moderate(id: string, dto: ModerateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        status: dto.status,
        publishedAt: dto.status === ProductStatus.ACTIVE ? new Date() : product.publishedAt,
      },
    });
    if (dto.status === ProductStatus.ACTIVE) this.emitIndexed(id);
    else this.emitRemoved(id);
    return updated;
  }

  // -------------------------------------------------------------------------
  // helpers
  // -------------------------------------------------------------------------

  /**
   * Строит условие ProductCompatibilityWhereInput из переданных car* фильтров.
   * Раскручивает иерархию: модификация → модель → марка, чтобы товар совместимый
   * с маркой автоматически считался совместимым с модификацией этой марки.
   */
  private async buildCompatibilityFilter(
    query: ListProductsDto,
  ): Promise<Prisma.ProductCompatibilityWhereInput | null> {
    if (query.carModificationId) {
      const mod = await this.prisma.carModification.findUnique({
        where: { id: query.carModificationId },
        include: { generation: { select: { modelId: true, model: { select: { makeId: true } } } } },
      });
      if (!mod) return null;
      return {
        OR: [
          { carModificationId: query.carModificationId },
          { carModelId: mod.generation.modelId },
          { carMakeId: mod.generation.model.makeId },
        ],
      };
    }
    if (query.carModelId) {
      const model = await this.prisma.carModel.findUnique({
        where: { id: query.carModelId },
        select: { makeId: true, id: true },
      });
      if (!model) return null;
      return {
        OR: [
          { carModelId: model.id },
          { carMakeId: model.makeId },
          { carModification: { generation: { modelId: model.id } } },
        ],
      };
    }
    if (query.carMakeId) {
      return {
        OR: [
          { carMakeId: query.carMakeId },
          { carModel: { makeId: query.carMakeId } },
          { carModification: { generation: { model: { makeId: query.carMakeId } } } },
        ],
      };
    }
    return null;
  }

  /**
   * Парсит строку фильтра характеристик "slug:val1,val2;slug2:val3" в массив условий Prisma.
   * Каждый атрибут → отдельное условие AND (товар должен соответствовать всем атрибутам);
   * значения внутри атрибута объединяются OR (любое из значений подходит).
   */
  private parseAttrFilter(attrs?: string): Prisma.ProductWhereInput[] {
    if (!attrs) return [];
    const conditions: Prisma.ProductWhereInput[] = [];
    for (const part of attrs.split(';')) {
      const [slug, rawValues] = part.split(':');
      if (!slug || !rawValues) continue;
      const values = rawValues
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length === 0) continue;

      const numeric = values
        .filter((v) => v !== '' && !Number.isNaN(Number(v)))
        .map((v) => new Prisma.Decimal(v));

      const valueMatch: Prisma.ProductAttributeWhereInput[] = [
        { valueEnum: { in: values } },
        { valueMultiEnum: { hasSome: values } },
        { valueString: { in: values } },
      ];
      if (numeric.length > 0) valueMatch.push({ valueNumber: { in: numeric } });

      conditions.push({
        attributes: {
          some: {
            attribute: { slug: slug.trim() },
            OR: valueMatch,
          },
        },
      });
    }
    return conditions;
  }

  /** Публичный алиас для использования из других модулей (uploads, и т.п.) */
  async assertOwnership(merchantId: string, productId: string): Promise<void> {
    return this.ensureOwnership(merchantId, productId);
  }

  // -------------------------------------------------------------------------
  // Product Images (CRUD)
  // -------------------------------------------------------------------------

  async listImages(merchantId: string, productId: string) {
    await this.ensureOwnership(merchantId, productId);
    return this.prisma.productImage.findMany({
      where: { productId },
      orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
    });
  }

  async addImage(
    merchantId: string,
    productId: string,
    data: {
      url: string;
      thumbnailUrl?: string;
      width?: number;
      height?: number;
      fileSize?: number;
      isPrimary?: boolean;
    },
  ) {
    await this.ensureOwnership(merchantId, productId);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.productImage.count({ where: { productId } });
      const makePrimary = data.isPrimary || current === 0;
      if (makePrimary) {
        await tx.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });
      }
      return tx.productImage.create({
        data: {
          productId,
          url: data.url,
          thumbnailUrl: data.thumbnailUrl,
          width: data.width,
          height: data.height,
          fileSize: data.fileSize,
          isPrimary: makePrimary,
          position: current,
        },
      });
    });
  }

  async setPrimaryImage(merchantId: string, productId: string, imageId: string) {
    await this.ensureOwnership(merchantId, productId);
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) throw new NotFoundException('Image not found');
    await this.prisma.$transaction([
      this.prisma.productImage.updateMany({ where: { productId }, data: { isPrimary: false } }),
      this.prisma.productImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
    ]);
    return { ok: true };
  }

  async removeImage(merchantId: string, productId: string, imageId: string) {
    await this.ensureOwnership(merchantId, productId);
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) throw new NotFoundException('Image not found');
    await this.prisma.productImage.delete({ where: { id: imageId } });
    // Если удалили primary — назначаем primary первый из оставшихся
    if (image.isPrimary) {
      const next = await this.prisma.productImage.findFirst({
        where: { productId },
        orderBy: { position: 'asc' },
      });
      if (next) {
        await this.prisma.productImage.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
    }
    return { url: image.url };
  }

  private async ensureOwnership(merchantId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: {
        createdByMerchantId: true,
        offers: { where: { merchantId }, take: 1, select: { id: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    const owns = product.createdByMerchantId === merchantId || product.offers.length > 0;
    if (!owns) throw new ForbiddenException('Not your product');
  }

  private toSlug(s: string): string {
    return s
      .toLowerCase()
      .replace(/[а-я]/g, (c) => {
        const map: Record<string, string> = {
          а: 'a',
          б: 'b',
          в: 'v',
          г: 'g',
          д: 'd',
          е: 'e',
          ё: 'yo',
          ж: 'zh',
          з: 'z',
          и: 'i',
          й: 'y',
          к: 'k',
          л: 'l',
          м: 'm',
          н: 'n',
          о: 'o',
          п: 'p',
          р: 'r',
          с: 's',
          т: 't',
          у: 'u',
          ф: 'f',
          х: 'h',
          ц: 'ts',
          ч: 'ch',
          ш: 'sh',
          щ: 'sch',
          ъ: '',
          ы: 'y',
          ь: '',
          э: 'e',
          ю: 'yu',
          я: 'ya',
        };
        return map[c] ?? c;
      })
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200);
  }

  private handleUniqueErr(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new BadRequestException('Product with the same SKU or slug already exists');
    }
    throw error as Error;
  }
}
