import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { bootstrapTestApp, loginAs, SEED_USERS } from './setup-app';

/**
 * Проверяем что мерчант видит только свои данные и может работать с заказами.
 * Полный flow заказ → confirm → ready → ship — слишком завязан на состояние seed:
 * нужен PAID заказ к мерчанту. Тестируем то, что проверяемо без сетапа.
 */
describe('Merchant flow (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let merchantToken: string;
  let merchant2Token: string;
  let customerToken: string;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    http = app.getHttpServer();
    const m = await loginAs(app, SEED_USERS.merchant.email, SEED_USERS.merchant.password);
    merchantToken = m.accessToken;
    const m2 = await loginAs(app, SEED_USERS.merchant2.email, SEED_USERS.merchant2.password);
    merchant2Token = m2.accessToken;
    const c = await loginAs(app, SEED_USERS.customer.email, SEED_USERS.customer.password);
    customerToken = c.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('merchant видит /merchant/orders', async () => {
    const res = await request(http)
      .get('/api/v1/merchant/orders')
      .set('Authorization', `Bearer ${merchantToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('customer не имеет доступа к /merchant/orders (403)', async () => {
    const res = await request(http)
      .get('/api/v1/merchant/orders')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('неавторизованный → 401 на /merchant/orders', async () => {
    await request(http).get('/api/v1/merchant/orders').expect(401);
  });

  it('merchant видит свой баланс', async () => {
    const res = await request(http)
      .get('/api/v1/merchant/balance')
      .set('Authorization', `Bearer ${merchantToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('availableBalance');
    expect(res.body).toHaveProperty('pendingBalance');
  });

  it('customer не видит чужой баланс мерчанта (403)', async () => {
    const res = await request(http)
      .get('/api/v1/merchant/balance')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('merchant analytics summary возвращает структуру', async () => {
    const res = await request(http)
      .get('/api/v1/merchant/analytics/summary?range=7')
      .set('Authorization', `Bearer ${merchantToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders');
    expect(res.body).toHaveProperty('revenue');
    expect(res.body).toHaveProperty('dailyRevenue');
    expect(res.body).toHaveProperty('inventory');
    expect(res.body.rangeDays).toBe(7);
    // range=7 даёт диапазон из 7 дней; в зависимости от перехода полуночи может быть 7 или 8 buckets
    expect(res.body.dailyRevenue.length).toBeGreaterThanOrEqual(7);
    expect(res.body.dailyRevenue.length).toBeLessThanOrEqual(8);
  });

  it('merchant analytics range > 365 — клампится', async () => {
    const res = await request(http)
      .get('/api/v1/merchant/analytics/summary?range=9999')
      .set('Authorization', `Bearer ${merchantToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rangeDays).toBe(365);
  });

  // --- Маркетплейс-модель: мерчант управляет СВОИМИ предложениями (offer),
  //     товары/контент не создаёт (ведёт админ). ---

  it('merchant видит /merchant/offers — список своих предложений с ценой/статусом/остатком', async () => {
    const res = await request(http)
      .get('/api/v1/merchant/offers')
      .set('Authorization', `Bearer ${merchantToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const offer = res.body[0];
    expect(offer).toHaveProperty('id');
    expect(offer).toHaveProperty('price');
    expect(offer).toHaveProperty('status');
    expect(offer).toHaveProperty('stock');
    expect(offer.product).toHaveProperty('name');
    expect(offer.product.name).toEqual(expect.objectContaining({ ru: expect.any(String) }));
  });

  it('customer не имеет доступа к /merchant/offers (403)', async () => {
    const res = await request(http)
      .get('/api/v1/merchant/offers')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('неавторизованный → 401 на /merchant/offers', async () => {
    await request(http).get('/api/v1/merchant/offers').expect(401);
  });

  it('merchant правит цену своего предложения и видит изменение в списке', async () => {
    const before = await request(http)
      .get('/api/v1/merchant/offers')
      .set('Authorization', `Bearer ${merchantToken}`);
    expect(before.status).toBe(200);
    const offer = before.body[0] as { id: string; price: string };
    const original = Number(offer.price);
    const newPrice = original + 1;

    const patch = await request(http)
      .patch(`/api/v1/merchant/offers/${offer.id}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ price: newPrice });
    expect(patch.status).toBe(200);
    expect(Number(patch.body.price)).toBe(newPrice);

    // восстанавливаем исходную цену за собой
    const restore = await request(http)
      .patch(`/api/v1/merchant/offers/${offer.id}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ price: original });
    expect(restore.status).toBe(200);
    expect(Number(restore.body.price)).toBe(original);
  });

  it('merchant НЕ может править чужое предложение (403, multi-tenancy)', async () => {
    // берём предложение второго мерчанта…
    const other = await request(http)
      .get('/api/v1/merchant/offers')
      .set('Authorization', `Bearer ${merchant2Token}`);
    expect(other.status).toBe(200);
    expect(other.body.length).toBeGreaterThan(0);
    const foreignOfferId = (other.body[0] as { id: string }).id;

    // …и пытаемся изменить его токеном первого мерчанта
    const res = await request(http)
      .patch(`/api/v1/merchant/offers/${foreignOfferId}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ price: 999999 });
    expect(res.status).toBe(403);
  });
});
