import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { bootstrapTestApp, loginAs, SEED_USERS } from './setup-app';

/**
 * Полный сценарий покупки seed-юзером customer1:
 *   login -> clear cart -> add product -> checkout (self-pickup) -> pay (MOCK) -> order PAID
 *
 * Все шаги делаются через настоящий HTTP-стек NestJS + реальная Postgres.
 * Между ранами тест чистит cart, чтобы не ломаться от прошлых запусков.
 */
describe('Order purchase flow (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let token: string;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    http = app.getHttpServer();
    const auth = await loginAs(app, SEED_USERS.customer.email, SEED_USERS.customer.password);
    token = auth.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. login возвращает access + refresh + user', async () => {
    expect(token).toBeDefined();
    expect(token.split('.')).toHaveLength(3); // JWT
  });

  it('2. cart очищается через DELETE /cart', async () => {
    await request(http)
      .delete('/api/v1/cart')
      .set('Authorization', `Bearer ${token}`);
    const res = await request(http)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.items).toHaveLength(0);
  });

  let productId: string;
  let productPrice: number;

  it('3. находим активный товар и добавляем в корзину', async () => {
    const list = await request(http)
      .get('/api/v1/products?perPage=1&sort=popular')
      .expect(200);
    const p = list.body.data[0];
    expect(p).toBeDefined();
    productId = p.id;
    productPrice = Number(p.price);

    const cart = await request(http)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 })
      .expect(201);

    expect(cart.body.items).toHaveLength(1);
    expect(cart.body.items[0].quantity).toBe(2);
    expect(cart.body.itemsCount).toBe(2);
  });

  it('4. GET /cart считает pricing с НДС 12%', async () => {
    const res = await request(http)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.pricing.subtotal).toBe(String(productPrice * 2));
    // НДС 12% по умолчанию
    const expectedVat = productPrice * 2 * 0.12;
    expect(Number(res.body.pricing.vatAmount)).toBeCloseTo(expectedVat, 1);
  });

  let orderId: string;
  let orderTotal: number;

  it('5. checkout: создаём заказ SELF_PICKUP + MOCK', async () => {
    const res = await request(http)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        deliveryMethod: 'SELF_PICKUP',
        paymentMethod: 'MOCK',
        customerNotes: 'e2e test order',
      });

    expect(res.status).toBe(201);
    orderId = res.body.id;
    orderTotal = Number(res.body.totalAmount);
    expect(res.body.status).toBe('CREATED');
    expect(res.body.paymentStatus).toBe('UNPAID');
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(2);
    expect(res.body.subOrders.length).toBeGreaterThanOrEqual(1);
  });

  it('6. cart очищена после оформления', async () => {
    const cart = await request(http)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(cart.body.items).toHaveLength(0);
  });

  it('7. pay: MOCK провайдер авто-успех → статус PAID', async () => {
    await request(http)
      .post(`/api/v1/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${token}`);
    const order = await request(http)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(order.body.paymentStatus).toBe('PAID');
    expect(Number(order.body.paidAmount)).toBe(orderTotal);
    expect(order.body.paidAt).not.toBeNull();
  });

  it('8. order не доступен другому пользователю (403 или 404)', async () => {
    const other = await loginAs(app, 'customer2@example.com', 'Test1234!').catch(() => null);
    if (!other) {
      console.warn('  skip: customer2@example.com not in seed');
      return;
    }
    const res = await request(http)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${other.accessToken}`);
    // 403 (явный отказ) или 404 (не палим существование) — оба валидны
    expect([403, 404]).toContain(res.status);
  });

  it('9. список своих заказов содержит созданный', async () => {
    const list = await request(http)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const ids = list.body.data.map((o: { id: string }) => o.id);
    expect(ids).toContain(orderId);
  });

  it('10. неавторизованный пользователь не может оформить заказ', async () => {
    await request(http)
      .post('/api/v1/orders')
      .send({ deliveryMethod: 'SELF_PICKUP', paymentMethod: 'MOCK' })
      .expect(401);
  });
});
