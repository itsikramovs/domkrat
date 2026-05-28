import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { MeiliSearch, type Index } from 'meilisearch';

import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface ProductIndexDoc {
  id: string;
  sku: string;
  slug: string;
  nameRu: string;
  nameUz: string;
  description: string;
  oemNumber: string | null;
  brand: string | null;
  category: string | null;
  categorySlug: string;
  price: number;
  rating: number;
  reviewsCount: number;
  isFeatured: boolean;
  isOnSale: boolean;
  imageUrl: string | null;
}

/**
 * Обёртка над Meilisearch. Индекс products обновляется реактивно через события
 * (product.created/updated/deleted), а также может быть пересобран целиком
 * через rebuild() — вызвать из скрипта или админ-эндпоинта.
 */
@Injectable()
export class MeiliService implements OnModuleInit {
  private readonly logger = new Logger(MeiliService.name);
  private client!: MeiliSearch;
  private index!: Index<ProductIndexDoc>;
  private indexName!: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    const host = this.config.get<string>('MEILI_HOST', 'http://localhost:7700');
    const apiKey = this.config.get<string>('MEILI_API_KEY', '');
    this.indexName = this.config.get<string>('MEILI_PRODUCTS_INDEX', 'products');

    this.client = new MeiliSearch({ host, apiKey });

    try {
      await this.ensureIndex();
    } catch (error) {
      this.logger.error(`Meili init failed: ${(error as Error).message}`);
    }
  }

  private async ensureIndex(): Promise<void> {
    try {
      await this.client.getIndex(this.indexName);
    } catch {
      const task = await this.client.createIndex(this.indexName, { primaryKey: 'id' });
      await this.client.waitForTask(task.taskUid);
      this.logger.log(`Created Meili index ${this.indexName}`);
    }
    this.index = this.client.index<ProductIndexDoc>(this.indexName);

    await this.index.updateSettings({
      searchableAttributes: [
        'nameRu',
        'nameUz',
        'sku',
        'oemNumber',
        'brand',
        'category',
        'description',
      ],
      filterableAttributes: ['categorySlug', 'brand', 'isFeatured', 'isOnSale'],
      sortableAttributes: ['price', 'rating', 'reviewsCount'],
      displayedAttributes: [
        'id',
        'sku',
        'slug',
        'nameRu',
        'nameUz',
        'oemNumber',
        'brand',
        'category',
        'categorySlug',
        'price',
        'rating',
        'reviewsCount',
        'isFeatured',
        'isOnSale',
        'imageUrl',
      ],
      typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 } },
    });
  }

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  async search(query: string, opts: { limit?: number; categorySlug?: string } = {}) {
    if (!this.index) return { hits: [] as ProductIndexDoc[], estimatedTotalHits: 0 };
    const filter: string[] = [];
    if (opts.categorySlug) filter.push(`categorySlug = "${opts.categorySlug}"`);
    const res = await this.index.search<ProductIndexDoc>(query, {
      limit: Math.min(opts.limit ?? 20, 50),
      filter: filter.length ? filter.join(' AND ') : undefined,
    });
    return { hits: res.hits, estimatedTotalHits: res.estimatedTotalHits };
  }

  // -------------------------------------------------------------------------
  // Indexing (events + manual rebuild)
  // -------------------------------------------------------------------------

  @OnEvent('product.indexed')
  async upsertById(productId: string): Promise<void> {
    const doc = await this.buildDoc(productId);
    if (!doc) {
      await this.deleteById(productId);
      return;
    }
    if (!this.index) return;
    await this.index.addDocuments([doc]);
  }

  @OnEvent('product.removed')
  async deleteById(productId: string): Promise<void> {
    if (!this.index) return;
    try {
      await this.index.deleteDocument(productId);
    } catch (error) {
      this.logger.warn(`Delete from Meili failed: ${(error as Error).message}`);
    }
  }

  async rebuild(): Promise<{ count: number }> {
    if (!this.index) await this.ensureIndex();
    await this.index.deleteAllDocuments();
    const products = await this.prisma.product.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      include: {
        brand: true,
        category: true,
        images: { orderBy: { position: 'asc' }, take: 1 },
      },
    });
    const docs = products.map((p) => this.toDoc(p));
    if (docs.length > 0) {
      const task = await this.index.addDocuments(docs);
      await this.client.waitForTask(task.taskUid);
    }
    return { count: docs.length };
  }

  private async buildDoc(productId: string): Promise<ProductIndexDoc | null> {
    const p = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null, status: 'ACTIVE' },
      include: {
        brand: true,
        category: true,
        images: { orderBy: { position: 'asc' }, take: 1 },
      },
    });
    return p ? this.toDoc(p) : null;
  }

  private toDoc(p: {
    id: string;
    sku: string;
    slug: string;
    name: unknown;
    description: unknown;
    oemNumber: string | null;
    price: unknown;
    rating: unknown;
    reviewsCount: number;
    isFeatured: boolean;
    isOnSale: boolean;
    brand: { name: string } | null;
    category: { name: unknown; slug: string };
    images: Array<{ url: string }>;
  }): ProductIndexDoc {
    const name = (p.name as { ru?: string; uz?: string }) ?? {};
    const desc = (p.description as { ru?: string; uz?: string } | null) ?? {};
    const categoryName = (p.category.name as { ru?: string; uz?: string }) ?? {};
    return {
      id: p.id,
      sku: p.sku,
      slug: p.slug,
      nameRu: name.ru ?? '',
      nameUz: name.uz ?? '',
      description: [desc.ru, desc.uz].filter(Boolean).join(' '),
      oemNumber: p.oemNumber,
      brand: p.brand?.name ?? null,
      category: categoryName.ru ?? null,
      categorySlug: p.category.slug,
      price: Number(p.price),
      rating: Number(p.rating),
      reviewsCount: p.reviewsCount,
      isFeatured: p.isFeatured,
      isOnSale: p.isOnSale,
      imageUrl: p.images[0]?.url ?? null,
    };
  }
}
