import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductOfferStatus, ProductStatus } from '@prisma/client';
import Decimal from 'decimal.js';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PromoCodesService, type PromoEvaluation } from '../promo-codes/promo-codes.service';

import type { AddCartItemDto, UpdateCartItemDto } from './dto/add-cart-item.dto';
import { PricingService } from './pricing.service';

const CART_TTL_DAYS = 30;

const CART_ITEMS_INCLUDE = Prisma.validator<Prisma.CartInclude>()({
  items: {
    include: {
      offer: {
        select: {
          id: true,
          merchantId: true,
          sku: true,
          price: true,
          vatRate: true,
          status: true,
          deletedAt: true,
          variant: { select: { id: true, name: true } },
          product: {
            select: {
              id: true,
              categoryId: true,
              slug: true,
              name: true,
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
      },
    },
    orderBy: { createdAt: 'asc' },
  },
});

type CartWithItems = Prisma.CartGetPayload<{ include: typeof CART_ITEMS_INCLUDE }>;
type CartItemRow = CartWithItems['items'][number];

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
      cart = await this.prisma.cart.update({
        where: { id: cart.id },
        data: { expiresAt, items: { deleteMany: {} } },
        include: CART_ITEMS_INCLUDE,
      });
    }

    return this.withBreakdown(cart);
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    // Принимаем новый offerId либо legacy productId (→ основное предложение).
    const offerId = dto.offerId ?? (await this.resolvePrimaryOfferId(dto.productId));
    if (!offerId) throw new NotFoundException('Product not available');

    const offer = await this.prisma.productOffer.findFirst({
      where: {
        id: offerId,
        deletedAt: null,
        status: ProductOfferStatus.ACTIVE,
        product: { status: ProductStatus.ACTIVE, deletedAt: null },
      },
      select: { id: true, price: true, productId: true },
    });
    if (!offer) throw new NotFoundException('Product not available');

    const cart = await this.getOrCreateRaw(userId);

    await this.prisma.cartItem.upsert({
      where: { cartId_offerId: { cartId: cart.id, offerId: offer.id } },
      update: { quantity: { increment: dto.quantity }, priceAtAdded: offer.price },
      create: {
        cartId: cart.id,
        offerId: offer.id,
        productId: offer.productId,
        quantity: dto.quantity,
        priceAtAdded: offer.price,
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

  /** Резолвит «основное предложение» по productId: ACTIVE, сначала с остатком, затем дешевле. */
  private async resolvePrimaryOfferId(productId?: string): Promise<string | null> {
    if (!productId) return null;
    const offers = await this.prisma.productOffer.findMany({
      where: {
        productId,
        status: ProductOfferStatus.ACTIVE,
        deletedAt: null,
        product: { status: ProductStatus.ACTIVE, deletedAt: null },
      },
      orderBy: [{ price: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    if (offers.length === 0) return null;
    const stock = await this.prisma.inventoryBalance.groupBy({
      by: ['offerId'],
      where: { offerId: { in: offers.map((o) => o.id) }, cellId: null },
      _sum: { quantityAvailable: true },
    });
    const inStock = new Set(
      stock.filter((s) => (s._sum.quantityAvailable ?? 0) > 0).map((s) => s.offerId),
    );
    return (offers.find((o) => inStock.has(o.id)) ?? offers[0]).id;
  }

  private toEvalItems(cart: CartWithItems) {
    return cart.items
      .filter((i) => i.offer)
      .map((i) => ({
        categoryId: i.offer!.product.categoryId,
        merchantId: i.offer!.merchantId,
        lineSubtotal: new Decimal(i.offer!.price.toString()).times(i.quantity),
      }));
  }

  /** Собирает legacy-форму product (name/slug/images + price/sku/vatRate из предложения). */
  private mapItem(i: CartItemRow) {
    const o = i.offer;
    const product = o
      ? {
          id: o.product.id,
          sku: o.sku,
          slug: o.product.slug,
          name: o.product.name,
          price: o.price,
          vatRate: o.vatRate,
          merchantId: o.merchantId,
          categoryId: o.product.categoryId,
          status: o.product.status,
          deletedAt: o.product.deletedAt,
          images: o.product.images,
        }
      : null;
    return {
      id: i.id,
      cartId: i.cartId,
      offerId: i.offerId,
      productId: i.productId,
      quantity: i.quantity,
      priceAtAdded: i.priceAtAdded,
      createdAt: i.createdAt,
      product,
      variant: o?.variant ?? null,
    };
  }

  private async withBreakdown(cart: CartWithItems) {
    const live = cart.items.filter((i) => i.offer);
    const priceable = live.map((i) => ({
      unitPrice: i.offer!.price,
      quantity: i.quantity,
      vatRate: i.offer!.vatRate,
    }));

    // Если в корзине лежит промокод — пересчитываем скидку (код мог истечь/исчерпаться).
    let promo: PromoEvaluation | null = null;
    if (cart.promoCode && live.length > 0 && cart.userId) {
      promo = await this.promoCodes.evaluate(cart.promoCode, cart.userId, this.toEvalItems(cart));
    }

    const breakdown = this.pricing.calculate(priceable, { discount: promo?.discount });

    return {
      id: cart.id,
      userId: cart.userId,
      currency: cart.currency,
      expiresAt: cart.expiresAt,
      itemsCount: cart.items.reduce((n, i) => n + i.quantity, 0),
      items: cart.items.map((i) => this.mapItem(i)),
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
