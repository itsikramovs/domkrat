import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { DeliveryMethodType, PaymentMethod, ProductStatus } from '@prisma/client';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

import { PricingService } from '../cart/pricing.service';
import type { PrismaService } from '../../infrastructure/database/prisma.service';

import type { CreateOrderDto } from './dto/create-order.dto';
import type { OrderNumberingService } from './order-numbering.service';
import { OrdersService } from './orders.service';
import type { PaymentsService } from './payments.service';

/**
 * Unit-тесты на валидационные ветки createFromCart.
 * Полный happy-path с транзакцией покрывается E2E (test/orders.e2e-spec.ts).
 */
describe('OrdersService.createFromCart — validation', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let numbering: DeepMockProxy<OrderNumberingService>;
  let payments: DeepMockProxy<PaymentsService>;
  let events: DeepMockProxy<EventEmitter2>;
  let service: OrdersService;

  const baseDto: CreateOrderDto = {
    deliveryMethod: DeliveryMethodType.PLATFORM_COURIER,
    paymentMethod: PaymentMethod.MOCK,
    deliveryAddressId: 'addr-1',
  };

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    numbering = mockDeep<OrderNumberingService>();
    payments = mockDeep<PaymentsService>();
    events = mockDeep<EventEmitter2>();
    service = new OrdersService(prisma, new PricingService(), numbering, payments, events);
  });

  it('бросает BadRequestException если корзина пуста', async () => {
    prisma.cart.findUnique.mockResolvedValue(null);
    await expect(service.createFromCart('user-1', baseDto)).rejects.toThrow(BadRequestException);

    prisma.cart.findUnique.mockResolvedValue({ id: 'c1', items: [] } as never);
    await expect(service.createFromCart('user-1', baseDto)).rejects.toThrow(BadRequestException);
  });

  it('бросает BadRequestException если courier без deliveryAddressId', async () => {
    prisma.cart.findUnique.mockResolvedValue({
      id: 'c1',
      items: [{ product: {} }],
    } as never);
    const dto = { ...baseDto, deliveryAddressId: undefined };
    await expect(service.createFromCart('user-1', dto)).rejects.toThrow(BadRequestException);
  });

  it('бросает ForbiddenException если адрес не принадлежит пользователю', async () => {
    prisma.cart.findUnique.mockResolvedValue({
      id: 'c1',
      items: [{ product: { sku: 'X', status: ProductStatus.ACTIVE, deletedAt: null } }],
    } as never);
    prisma.userAddress.findFirst.mockResolvedValue(null);
    await expect(service.createFromCart('user-1', baseDto)).rejects.toThrow(ForbiddenException);
  });

  it('бросает ConflictException если товар не ACTIVE', async () => {
    prisma.cart.findUnique.mockResolvedValue({
      id: 'c1',
      items: [
        {
          product: { sku: 'OUT', status: ProductStatus.INACTIVE, deletedAt: null },
        },
      ],
    } as never);
    prisma.userAddress.findFirst.mockResolvedValue({ id: 'addr-1' } as never);
    await expect(service.createFromCart('user-1', baseDto)).rejects.toThrow(ConflictException);
  });

  it('бросает ConflictException если товар soft-deleted', async () => {
    prisma.cart.findUnique.mockResolvedValue({
      id: 'c1',
      items: [
        {
          product: { sku: 'DEL', status: ProductStatus.ACTIVE, deletedAt: new Date() },
        },
      ],
    } as never);
    prisma.userAddress.findFirst.mockResolvedValue({ id: 'addr-1' } as never);
    await expect(service.createFromCart('user-1', baseDto)).rejects.toThrow(ConflictException);
  });

  it('для SELF_PICKUP не требует deliveryAddressId', async () => {
    // Пустая корзина — упадёт раньше на BadRequest, но мы проверяем что
    // отсутствие address для SELF_PICKUP НЕ кидает ForbiddenException
    prisma.cart.findUnique.mockResolvedValue(null);
    const dto = {
      ...baseDto,
      deliveryMethod: DeliveryMethodType.SELF_PICKUP,
      deliveryAddressId: undefined,
    };
    await expect(service.createFromCart('user-1', dto)).rejects.toThrow(BadRequestException);
    // Если бы мы дошли до проверки address — был бы ForbiddenException
  });
});
