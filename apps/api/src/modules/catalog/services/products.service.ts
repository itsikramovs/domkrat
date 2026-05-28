import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { CreateCompatibilityDto } from '../dto/compatibility.dto';
import type {
  CreateProductDto,
  ModerateProductDto,
  UpdateProductDto,
  UpdateProductStatusDto,
} from '../dto/create-product.dto';
import { ListProductsDto, ProductSort } from '../dto/list-products.dto';

const PRODUCT_INCLUDE = {
  images: { orderBy: { position: 'asc' } },
  brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
  category: { select: { id: true, name: true, slug: true } },
  merchant: { select: { id: true, brandName: true, slug: true } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // PUBLIC
  // -------------------------------------------------------------------------

  async listPublic(query: ListProductsDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      status: ProductStatus.ACTIVE,
    };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.categorySlug) where.category = { slug: query.categorySlug };
    if (query.brandId) where.brandId = query.brandId;
    if (query.brandSlug) where.brand = { slug: query.brandSlug };
    if (query.merchantId) where.merchantId = query.merchantId;
    if (query.featured) where.isFeatured = true;
    if (query.onSale) where.isOnSale = true;
    if (query.isNew) where.isNew = true;
    if (query.priceMin !== undefined || query.priceMax !== undefined) {
      where.price = {};
      if (query.priceMin !== undefined) where.price.gte = new Prisma.Decimal(query.priceMin);
      if (query.priceMax !== undefined) where.price.lte = new Prisma.Decimal(query.priceMax);
    }
    if (query.search) {
      // Простой ILIKE поиск по sku/oem; FTS на name JSONB — Phase 2.
      where.OR = [
        { sku: { contains: query.search, mode: 'insensitive' } },
        { oemNumber: { contains: query.search, mode: 'insensitive' } },
        { manufacturerPartNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = (() => {
      switch (query.sort) {
        case ProductSort.NEW:
          return [{ publishedAt: 'desc' }];
        case ProductSort.PRICE_ASC:
          return [{ price: 'asc' }];
        case ProductSort.PRICE_DESC:
          return [{ price: 'desc' }];
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
      data: items,
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async getBySlugPublic(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null, status: ProductStatus.ACTIVE },
      include: {
        ...PRODUCT_INCLUDE,
        attributes: { include: { attribute: true } },
        oemCodes: true,
        compatibilities: {
          include: {
            carMake: true,
            carModel: { include: { make: true } },
            carModification: { include: { generation: { include: { model: { include: { make: true } } } } } },
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
    return product;
  }

  searchByOem(oem: string) {
    if (!oem || oem.length < 3) {
      throw new BadRequestException('OEM query is too short');
    }
    // Простой ILIKE; pg_trgm для нечёткого — Phase 2 через raw SQL.
    return this.prisma.product.findMany({
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
  }

  // -------------------------------------------------------------------------
  // MERCHANT
  // -------------------------------------------------------------------------

  async listForMerchant(merchantId: string, query: ListProductsDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where: Prisma.ProductWhereInput = { merchantId, deletedAt: null };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.search) {
      where.OR = [
        { sku: { contains: query.search, mode: 'insensitive' } },
        { oemNumber: { contains: query.search, mode: 'insensitive' } },
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
      data: items,
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async getForMerchant(merchantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, merchantId, deletedAt: null },
      include: {
        ...PRODUCT_INCLUDE,
        attributes: { include: { attribute: true } },
        oemCodes: true,
        compatibilities: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(merchantId: string, dto: CreateProductDto) {
    const slug = dto.slug ?? this.toSlug(dto.name.ru) + '-' + dto.sku.toLowerCase().slice(0, 8);

    try {
      return await this.prisma.product.create({
        data: {
          merchantId,
          categoryId: dto.categoryId,
          brandId: dto.brandId,
          sku: dto.sku,
          slug,
          name: dto.name as unknown as Prisma.InputJsonValue,
          description: dto.description as unknown as Prisma.InputJsonValue,
          shortDescription: dto.shortDescription as unknown as Prisma.InputJsonValue,
          oemNumber: dto.oemNumber,
          barcode: dto.barcode,
          manufacturerPartNumber: dto.manufacturerPartNumber,
          weight: dto.weight !== undefined ? new Prisma.Decimal(dto.weight) : undefined,
          price: new Prisma.Decimal(dto.price),
          compareAtPrice:
            dto.compareAtPrice !== undefined ? new Prisma.Decimal(dto.compareAtPrice) : undefined,
          vatRate: dto.vatRate !== undefined ? new Prisma.Decimal(dto.vatRate) : new Prisma.Decimal(12),
          status: dto.status ?? ProductStatus.PENDING_REVIEW,
        },
        include: PRODUCT_INCLUDE,
      });
    } catch (error) {
      this.handleUniqueErr(error);
    }
  }

  async update(merchantId: string, id: string, dto: UpdateProductDto) {
    await this.ensureOwnership(merchantId, id);
    const data: Prisma.ProductUpdateInput = {};
    if (dto.sku !== undefined) data.sku = dto.sku;
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
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    if (dto.compareAtPrice !== undefined)
      data.compareAtPrice = new Prisma.Decimal(dto.compareAtPrice);
    if (dto.vatRate !== undefined) data.vatRate = new Prisma.Decimal(dto.vatRate);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.categoryId !== undefined) data.category = { connect: { id: dto.categoryId } };
    if (dto.brandId !== undefined)
      data.brand = dto.brandId ? { connect: { id: dto.brandId } } : { disconnect: true };

    try {
      return await this.prisma.product.update({
        where: { id },
        data,
        include: PRODUCT_INCLUDE,
      });
    } catch (error) {
      this.handleUniqueErr(error);
    }
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
    return this.prisma.product.update({
      where: { id },
      data: { status: dto.status, publishedAt: dto.status === ProductStatus.ACTIVE ? new Date() : undefined },
    });
  }

  async remove(merchantId: string, id: string): Promise<void> {
    await this.ensureOwnership(merchantId, id);
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
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
      throw new BadRequestException('At least one of car_modification_id / car_model_id / car_make_id required');
    }
    return this.prisma.productCompatibility.create({
      data: { productId, ...dto },
    });
  }

  async removeCompatibility(merchantId: string, productId: string, compatId: string): Promise<void> {
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
    return this.listPublic({ ...query }); // та же выборка но позже можно убрать status filter
  }

  async moderate(id: string, dto: ModerateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return this.prisma.product.update({
      where: { id },
      data: {
        status: dto.status,
        publishedAt: dto.status === ProductStatus.ACTIVE ? new Date() : product.publishedAt,
      },
    });
  }

  // -------------------------------------------------------------------------
  // helpers
  // -------------------------------------------------------------------------

  private async ensureOwnership(merchantId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { merchantId: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.merchantId !== merchantId) throw new ForbiddenException('Not your product');
  }

  private toSlug(s: string): string {
    return s
      .toLowerCase()
      .replace(/[а-я]/g, (c) => {
        const map: Record<string, string> = {
          а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z',
          и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
          с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
          ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
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
