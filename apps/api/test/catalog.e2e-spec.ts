import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { bootstrapTestApp } from './setup-app';

describe('Catalog public endpoints (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /categories', () => {
    it('возвращает массив корневых категорий с iconUrl', async () => {
      const res = await request(http).get('/api/v1/categories').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      const fluids = res.body.find((c: { slug: string }) => c.slug === 'fluids');
      expect(fluids).toBeDefined();
      expect(fluids.iconUrl).toMatch(/\/categories\//);
      expect(fluids.name).toEqual(expect.objectContaining({ ru: expect.any(String) }));
    });
  });

  describe('GET /brands', () => {
    it('возвращает активные бренды, отсортированные по position', async () => {
      const res = await request(http).get('/api/v1/brands').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      const positions = res.body.map((b: { position: number }) => b.position);
      expect([...positions]).toEqual([...positions].sort((a, b) => a - b));
    });

    it('GET /brands/toyota — бренд по slug', async () => {
      const res = await request(http).get('/api/v1/brands/toyota').expect(200);
      expect(res.body.slug).toBe('toyota');
      expect(res.body.name).toBe('Toyota');
    });

    it('GET /brands/popular?limit=5', async () => {
      const res = await request(http).get('/api/v1/brands/popular?limit=5').expect(200);
      expect(res.body.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /products', () => {
    it('пагинация: первая страница, perPage=4', async () => {
      const res = await request(http).get('/api/v1/products?perPage=4').expect(200);
      expect(res.body.data.length).toBeLessThanOrEqual(4);
      expect(res.body.meta).toEqual(expect.objectContaining({ page: 1, perPage: 4 }));
      expect(res.body.meta.total).toBeGreaterThan(0);
    });

    it('фильтр featured=true возвращает только избранные', async () => {
      const res = await request(http).get('/api/v1/products?featured=true&perPage=10').expect(200);
      for (const p of res.body.data) {
        expect(p.isFeatured).toBe(true);
      }
    });

    it('фильтр onSale=true возвращает только товары со скидкой', async () => {
      const res = await request(http).get('/api/v1/products?onSale=true&perPage=10').expect(200);
      for (const p of res.body.data) {
        expect(p.isOnSale).toBe(true);
      }
    });

    it('фильтр categorySlug=fluids', async () => {
      const res = await request(http)
        .get('/api/v1/products?categorySlug=fluids&perPage=10')
        .expect(200);
      for (const p of res.body.data) {
        expect(p.category.slug).toBe('fluids');
      }
    });

    it('сортировка price_asc', async () => {
      const res = await request(http).get('/api/v1/products?sort=price_asc&perPage=5').expect(200);
      const prices = res.body.data.map((p: { price: string }) => Number(p.price));
      expect([...prices]).toEqual([...prices].sort((a, b) => a - b));
    });

    it('GET /products/:slug возвращает товар с brand/category/merchant', async () => {
      const list = await request(http).get('/api/v1/products?perPage=1').expect(200);
      const slug = list.body.data[0].slug;
      const res = await request(http).get(`/api/v1/products/${slug}`).expect(200);
      expect(res.body.slug).toBe(slug);
      expect(res.body.category).toBeDefined();
      expect(res.body.merchant).toBeDefined();
    });
  });

  describe('GET /search', () => {
    it('по OEM-номеру', async () => {
      const res = await request(http).get('/api/v1/search/by-oem?oem=1457433721').expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].oemNumber).toContain('1457433721');
    });

    it('full-text /search/q по бренду "bosch"', async () => {
      const res = await request(http).get('/api/v1/search/q?q=bosch').expect(200);
      expect(res.body.hits).toBeDefined();
      // если индекс ещё не построен — может быть 0 хитов
      if (res.body.estimatedTotalHits > 0) {
        const first = res.body.hits[0];
        const text = `${first.nameRu} ${first.brand ?? ''}`.toLowerCase();
        expect(text).toContain('bosch');
      }
    });

    it('VIN known (seed) → находит автомобиль и совместимые товары', async () => {
      const res = await request(http)
        .get('/api/v1/search/by-vin?vin=JTNBE40K003123456')
        .expect(200);
      expect(res.body.vehicle).not.toBeNull();
      expect(res.body.vehicle.carModification.generation.model.make.name).toBe('Toyota');
    });

    it('VIN unknown → vehicle=null, отдаётся общий список товаров', async () => {
      const res = await request(http).get('/api/v1/search/by-vin?vin=ZZZZZZZZZZZZZZZZZ').expect(200);
      expect(res.body.vehicle).toBeNull();
      expect(res.body.meta).toBeDefined();
    });
  });

  describe('GET /cars', () => {
    it('GET /cars/makes?popular=true', async () => {
      const res = await request(http).get('/api/v1/cars/makes?popular=true').expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      for (const m of res.body) {
        expect(m.isPopular).toBe(true);
      }
    });

    it('GET /cars/makes/:id/models', async () => {
      const makes = await request(http).get('/api/v1/cars/makes?popular=true').expect(200);
      const toyota = makes.body.find((m: { slug: string }) => m.slug === 'toyota');
      const res = await request(http)
        .get(`/api/v1/cars/makes/${toyota.id}/models`)
        .expect(200);
      const camry = res.body.find((m: { slug: string }) => m.slug === 'camry');
      expect(camry).toBeDefined();
    });
  });

  describe('GET /banners', () => {
    it('активные баннеры HOME_MAIN', async () => {
      const res = await request(http).get('/api/v1/banners?position=HOME_MAIN').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const b of res.body) {
        expect(b.position).toBe('HOME_MAIN');
        expect(b.isActive).toBe(true);
      }
    });
  });
});
