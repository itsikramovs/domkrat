import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, ReviewStatus } from '@prisma/client';
import Decimal from 'decimal.js';

import { PrismaService } from '../../infrastructure/database/prisma.service';

import type { CreateReviewDto, MerchantReplyDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Customer оставляет отзыв.
   * Verified purchase: должен быть COMPLETED заказ этого пользователя с этим товаром.
   * Один отзыв на пару (user, product) — повторно нельзя.
   */
  async create(userId: string, productId: string, dto: CreateReviewDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const existing = await this.prisma.productReview.findFirst({
      where: { productId, userId },
    });
    if (existing) throw new ConflictException('You already reviewed this product');

    // Verified purchase check
    const verifiedItem = await this.prisma.orderItem.findFirst({
      where: {
        productId,
        order: { userId, status: OrderStatus.COMPLETED },
      },
      select: { orderId: true },
    });
    const isVerified = Boolean(verifiedItem);
    if (!isVerified) {
      throw new ForbiddenException(
        'Only customers who completed an order with this product can review',
      );
    }

    return this.prisma.productReview.create({
      data: {
        productId,
        userId,
        orderId: verifiedItem!.orderId,
        rating: dto.rating,
        title: dto.title,
        comment: dto.comment,
        pros: dto.pros,
        cons: dto.cons,
        images: dto.images ?? [],
        status: ReviewStatus.PENDING,
        isVerifiedPurchase: true,
      },
    });
  }

  /** Public: только APPROVED отзывы товара. */
  async listPublic(productSlug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug: productSlug, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.productReview.findMany({
      where: { productId: product.id, status: ReviewStatus.APPROVED },
      orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }],
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });
  }

  /** Admin: PATCH /admin/reviews/:id/moderate */
  async moderate(id: string, reviewerId: string, status: 'APPROVED' | 'REJECTED') {
    const review = await this.prisma.productReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.productReview.update({
        where: { id },
        data: {
          status: status as ReviewStatus,
          approvedById: status === 'APPROVED' ? reviewerId : undefined,
        },
      });

      // Пересчёт рейтинга только для APPROVED
      if (status === 'APPROVED' || review.status === 'APPROVED') {
        await this.recalcProductRating(tx, review.productId);
      }
      return updated;
    });
  }

  /** Merchant отвечает на отзыв на свой товар. */
  async reply(merchantId: string, reviewId: string, dto: MerchantReplyDto) {
    const review = await this.prisma.productReview.findUnique({
      where: { id: reviewId },
      include: {
        product: { select: { offers: { where: { merchantId }, select: { id: true }, take: 1 } } },
      },
    });
    if (!review) throw new NotFoundException('Review not found');
    // Любой продавец карточки может ответить на отзыв (мультипродавец).
    if (review.product.offers.length === 0) {
      throw new ForbiddenException('Not your product');
    }
    return this.prisma.productReview.update({
      where: { id: reviewId },
      data: { merchantReply: dto.reply, merchantRepliedAt: new Date() },
    });
  }

  /** Admin/Merchant: список отзывов с фильтром */
  listForAdmin(filter: { status?: ReviewStatus; page?: number; perPage?: number }) {
    const page = filter.page ?? 1;
    const perPage = Math.min(filter.perPage ?? 20, 100);
    const where: Prisma.ProductReviewWhereInput = {};
    if (filter.status) where.status = filter.status;
    return Promise.all([
      this.prisma.productReview.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          product: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.productReview.count({ where }),
    ]).then(([data, total]) => ({
      data,
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    }));
  }

  listForMerchant(merchantId: string) {
    return this.prisma.productReview.findMany({
      where: { product: { offers: { some: { merchantId } } } },
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { name: true, slug: true } } },
    });
  }

  private async recalcProductRating(
    tx: Prisma.TransactionClient,
    productId: string,
  ): Promise<void> {
    const stats = await tx.productReview.aggregate({
      where: { productId, status: ReviewStatus.APPROVED },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const avg = stats._avg.rating ?? 0;
    await tx.product.update({
      where: { id: productId },
      data: {
        rating: new Decimal(avg).toDecimalPlaces(2).toString(),
        reviewsCount: stats._count.rating,
      },
    });
  }
}
