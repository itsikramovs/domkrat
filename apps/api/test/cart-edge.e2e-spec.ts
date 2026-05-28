import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { bootstrapTestApp, loginAs, SEED_USERS } from './setup-app';

describe('Cart edge cases (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let token: string;
  let productId: string;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    http = app.getHttpServer();
    const auth = await loginAs(app, SEED_USERS.customer.email, SEED_USERS.customer.password);
    token = auth.accessToken;
    const list = await request(http).get('/api/v1/products?perPage=1&sort=popular');
    productId = list.body.data[0].id;
  });

  beforeEach(async () => {
    await request(http).delete('/api/v1/cart').set('Authorization', `Bearer ${token}`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('add same product twice — quantity суммируется (upsert merge)', async () => {
    await request(http)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 })
      .expect(201);
    await request(http)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 })
      .expect(201);
    const cart = await request(http).get('/api/v1/cart').set('Authorization', `Bearer ${token}`);
    expect(cart.body.items).toHaveLength(1);
    expect(cart.body.items[0].quantity).toBe(3);
  });

  it('add unknown productId → 404', async () => {
    const res = await request(http)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: '00000000-0000-4000-8000-deadbeef0001', quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('add quantity=0 — отклоняется валидацией', async () => {
    const res = await request(http)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 0 });
    expect(res.status).toBe(400);
  });

  it('add quantity negative — отклоняется', async () => {
    const res = await request(http)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: -3 });
    expect(res.status).toBe(400);
  });

  it('update чужой cart item → 404 (multi-tenancy)', async () => {
    await request(http)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 })
      .expect(201);
    const myCart = await request(http).get('/api/v1/cart').set('Authorization', `Bearer ${token}`);
    const itemId: string = myCart.body.items[0].id;

    const other = await loginAs(app, 'customer2@example.com', 'Test1234!').catch(() => null);
    if (!other) {
      console.warn('skip: customer2 not in seed');
      return;
    }
    const res = await request(http)
      .patch(`/api/v1/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ quantity: 99 });
    expect(res.status).toBe(404);
  });

  it('VAT расчёт корректен на нестандартных количествах', async () => {
    await request(http)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 7 })
      .expect(201);
    const cart = await request(http).get('/api/v1/cart').set('Authorization', `Bearer ${token}`);
    const subtotal = Number(cart.body.pricing.subtotal);
    const vat = Number(cart.body.pricing.vatAmount);
    expect(vat).toBeCloseTo(subtotal * 0.12, 1);
    expect(subtotal).toBeGreaterThan(0);
  });

  it('пустая корзина возвращает items=[] и итоги=0', async () => {
    const cart = await request(http).get('/api/v1/cart').set('Authorization', `Bearer ${token}`);
    expect(cart.body.items).toHaveLength(0);
    expect(Number(cart.body.pricing.subtotal)).toBe(0);
    expect(Number(cart.body.pricing.total)).toBe(0);
  });

  it('неавторизованный доступ к корзине → 401', async () => {
    await request(http).get('/api/v1/cart').expect(401);
    await request(http).post('/api/v1/cart/items').send({ productId, quantity: 1 }).expect(401);
  });
});
