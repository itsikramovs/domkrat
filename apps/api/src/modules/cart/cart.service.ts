import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import Decimal from 'decimal.js';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PromoCodesService, type PromoEvaluation } from '../promo-codes/promo-codes.service';

import type { AddCartItemDto, UpdateCartItemDto } from './dto/add-cart-item.dto';
import { PricingService } from './pricing.service';

const CART_TTL_DAYS = 30;

const CART_ITEMS_INCLUDE = Prisma.validator<Prisma.CartInclude>()({
  items: {
    include: {
      product: {
        select: {
          id: true,
          merchantId: true,
          categoryId: true,
          sku: true,
          slug: true,
          name: true,
          price: true,
          vatRate: true,
          status: true,
          deletedAt: true,
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { url: true, thumbnailUrl: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
});

type CartWithItems = Prisma.CartGetPayload<{ include: typeof CART_ITEMS_INCLUDE }>;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly promoCodes: PromoCodesService,
  ) {}

  /** Возвращает текущую корзину пользователя (создаёт пустую если нет). */
  async getOrCreate(userId: string) {
    const expiresAt = new Date(Date.now() + CART_TTL_DAYS * 86400_000);

    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: CART_ITEMS_INCLUDE,
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId, expiresAt },
        include: CART_ITEMS_INCLUDE,
      });
    } else if (cart.expiresAt < new Date()) {
      // Срок истёк — очистим
      cart = await this.prisma.cart.update({
        where: { id: cart.id },
        data: { expiresAt, items: { deleteMany: {} } },
        include: CART_ITEMS_INCLUDE,
      });
    }

    return this.withBreakdown(cart);
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null, status: ProductStatus.ACTIVE },
      select: { id: true, price: true },
    });
    if (!product) throw new NotFoundException('Product not available');

    const cart = await this.getOrCreateRaw(userId);

    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: dto.productId } },
      update: { quantity: { increment: dto.quantity }, priceAtAdded: product.price },
      create: {
        cartId: cart.id,
        productId: dto.productId,
        quantity: dto.quantity,
        priceAtAdded: product.price,
      },
    });

    return this.getOrCreate(userId);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: { select: { userId: true } } },
    });
    if (!item || item.cart.userId !== userId) throw new NotFoundException('Cart item not found');

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
    });
    return this.getOrCreate(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: { select: { userId: true } } },
    });
    if (!item || item.cart.userId !== userId) throw new NotFoundException('Cart item not found');

    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.getOrCreate(userId);
  }

  async clear(userId: string) {
    const cart = await this.getOrCreateRaw(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getOrCreate(userId);
  }

  // -------------------------------------------------------------------------
  /** Применить промокод к корзине. @throws {BadRequestException} если код невалиден. */
  async applyPromo(userId: string, rawCode: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: CART_ITEMS_INCLUDE,
    });
    if (!cart || cart.items.length === 0) throw new BadRequestException('Cart is empty');

    const evaluation = await this.promoCodes.evaluate(rawCode, userId, this.toEvalItems(cart));
    if (!evaluation.valid) {
      throw new BadRequestException(evaluation.message ?? 'Promo code is not valid');
    }

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { promoCode: evaluation.code },
    });
    return this.getOrCreate(userId);
  }

  /** Снять промокод с корзины. */
  async removePromo(userId: string) {
    const cart = await this.getOrCreateRaw(userId);
    await this.prisma.cart.update({ where: { id: cart.id }, data: { promoCode: null } });
    return this.getOrCreate(userId);
  }

  // -------------------------------------------------------------------------
  private async getOrCreateRaw(userId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (cart) return cart;
    return this.prisma.cart.create({
      data: { userId, expiresAt: new Date(Date.now() + CART_TTL_DAYS * 86400_000) },
    });
  }

  private toEvalItems(cart: CartWithItems) {
    return cart.items.map((i) => ({
      categoryId: i.product.categoryId,
      merchantId: i.product.merchantId,
      lineSubtotal: new Decimal(i.product.price.toString()).times(i.quantity),
    }));
  }

  private async withBreakdown(cart: CartWithItems) {
    const priceable = cart.items.map((i) => ({
      unitPrice: i.product.price,
      quantity: i.quantity,
      vatRate: i.product.vatRate,
    }));

    // Если в корзине лежит промокод — пересчитываем скидку (код мог истечь/исчерпаться).
    let promo: PromoEvaluation | null = null;
    if (cart.promoCode && cart.items.length > 0 && cart.userId) {
      promo = await this.promoCodes.evaluate(cart.promoCode, cart.userId, this.toEvalItems(cart));
    }

    const breakdown = this.pricing.calculate(priceable, { discount: promo?.discount });

    return {
      id: cart.id,
      userId: cart.userId,
      currency: cart.currency,
      expiresAt: cart.expiresAt,
      itemsCount: cart.items.reduce((n, i) => n + i.quantity, 0),
      items: cart.items,
      promo: promo
        ? {
            code: promo.code,
            valid: promo.valid,
            reason: promo.reason ?? null,
            message: promo.message ?? null,
            discount: promo.discount.toString(),
          }
        : null,
      pricing: {
        subtotal: breakdown.subtotal.toString(),
        vatAmount: breakdown.vatAmount.toString(),
        discount: breakdown.discount.toString(),
        deliveryCost: breakdown.deliveryCost.toString(),
        total: breakdown.total.toString(),
      },
    };
  }
}
