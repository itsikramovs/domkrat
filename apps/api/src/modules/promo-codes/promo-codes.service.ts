import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PromoCode, PromoDiscountType } from '@prisma/client';
import Decimal from 'decimal.js';

import { PrismaService } from '../../infrastructure/database/prisma.service';

import type { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import type { UpdatePromoCodeDto } from './dto/update-promo-code.dto';

/** Позиция корзины/заказа для расчёта скидки. */
export interface PromoEvalItem {
  categoryId: string | null;
  merchantId: string;
  lineSubtotal: Decimal | number | string;
}

export type PromoReason =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'USAGE_LIMIT'
  | 'USER_LIMIT'
  | 'MIN_ORDER'
  | 'NOT_APPLICABLE';

export interface PromoEvaluation {
  valid: boolean;
  reason?: PromoReason;
  message?: string;
  code: string;
  promoCodeId?: string;
  discountType?: PromoDiscountType;
  /** Рассчитанная сумма скидки (0 если невалидно). */
  discount: Decimal;
  /** Сумма позиций, на которые распространяется промокод. */
  eligibleSubtotal: Decimal;
}

const REASON_MESSAGES: Record<PromoReason, string> = {
  NOT_FOUND: 'Промокод не найден',
  INACTIVE: 'Промокод неактивен',
  NOT_STARTED: 'Промокод ещё не начал действовать',
  EXPIRED: 'Срок действия промокода истёк',
  USAGE_LIMIT: 'Промокод исчерпан',
  USER_LIMIT: 'Вы уже использовали этот промокод максимальное число раз',
  MIN_ORDER: 'Сумма заказа меньше минимальной для этого промокода',
  NOT_APPLICABLE: 'Промокод не применим к товарам в корзине',
};

@Injectable()
export class PromoCodesService {
  private readonly logger = new Logger(PromoCodesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===================================================================== Admin
  async list(params: { search?: string; active?: boolean; page?: number; perPage?: number } = {}) {
    const { search, active, page = 1, perPage = 50 } = params;
    const where: Prisma.PromoCodeWhereInput = {};
    if (typeof active === 'boolean') where.isActive = active;
    if (search) where.code = { contains: search.trim().toUpperCase() };

    const [items, total] = await Promise.all([
      this.prisma.promoCode.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { _count: { select: { usages: true } } },
      }),
      this.prisma.promoCode.count({ where }),
    ]);
    return { data: items, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
  }

  async get(id: string) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { id },
      include: { _count: { select: { usages: true } } },
    });
    if (!promo) throw new NotFoundException('Promo code not found');
    return promo;
  }

  async create(dto: CreatePromoCodeDto) {
    const code = dto.code.trim().toUpperCase();
    const exists = await this.prisma.promoCode.findUnique({ where: { code } });
    if (exists) throw new ConflictException('Promo code with this code already exists');

    this.assertDates(dto.validFrom, dto.validUntil);
    this.assertPercentage(dto.discountType, dto.discountValue);

    return this.prisma.promoCode.create({
      data: {
        code,
        description: (dto.description ?? undefined) as Prisma.InputJsonValue | undefined,
        discountType: dto.discountType,
        discountValue: dto.discountValue.toString(),
        maxDiscountAmount: dto.maxDiscountAmount?.toString() ?? null,
        minOrderAmount: dto.minOrderAmount?.toString() ?? null,
        usageLimit: dto.usageLimit ?? null,
        perUserLimit: dto.perUserLimit ?? null,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
        isActive: dto.isActive ?? true,
        applicableCategories: dto.applicableCategories ?? [],
        applicableMerchants: dto.applicableMerchants ?? [],
      },
    });
  }

  async update(id: string, dto: UpdatePromoCodeDto) {
    await this.get(id);

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const clash = await this.prisma.promoCode.findFirst({ where: { code, id: { not: id } } });
      if (clash) throw new ConflictException('Promo code with this code already exists');
    }
    if (dto.validFrom && dto.validUntil) this.assertDates(dto.validFrom, dto.validUntil);
    if (dto.discountType && dto.discountValue !== undefined) {
      this.assertPercentage(dto.discountType, dto.discountValue);
    }

    return this.prisma.promoCode.update({
      where: { id },
      data: {
        code: dto.code ? dto.code.trim().toUpperCase() : undefined,
        description: (dto.description ?? undefined) as Prisma.InputJsonValue | undefined,
        discountType: dto.discountType,
        discountValue: dto.discountValue?.toString(),
        maxDiscountAmount:
          dto.maxDiscountAmount === undefined
            ? undefined
            : (dto.maxDiscountAmount?.toString() ?? null),
        minOrderAmount:
          dto.minOrderAmount === undefined ? undefined : (dto.minOrderAmount?.toString() ?? null),
        usageLimit: dto.usageLimit === undefined ? undefined : (dto.usageLimit ?? null),
        perUserLimit: dto.perUserLimit === undefined ? undefined : (dto.perUserLimit ?? null),
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        isActive: dto.isActive,
        applicableCategories: dto.applicableCategories,
        applicableMerchants: dto.applicableMerchants,
      },
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.promoCode.delete({ where: { id } });
  }

  // ================================================================ Evaluation
  /**
   * Проверяет промокод и считает скидку для набора позиций.
   * НЕ бросает исключение на бизнес-невалидность — возвращает `valid:false` + причину,
   * чтобы корзина не падала из-за просроченного кода. Бросает только на системных ошибках.
   */
  async evaluate(
    rawCode: string,
    userId: string,
    items: PromoEvalItem[],
  ): Promise<PromoEvaluation> {
    const code = rawCode.trim().toUpperCase();
    const promo = await this.prisma.promoCode.findUnique({ where: { code } });

    const empty = (reason: PromoReason): PromoEvaluation => ({
      valid: false,
      reason,
      message: REASON_MESSAGES[reason],
      code,
      discount: new Decimal(0),
      eligibleSubtotal: new Decimal(0),
    });

    if (!promo) return empty('NOT_FOUND');
    if (!promo.isActive) return empty('INACTIVE');

    const now = new Date();
    if (now < promo.validFrom) return empty('NOT_STARTED');
    if (now > promo.validUntil) return empty('EXPIRED');

    if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
      return empty('USAGE_LIMIT');
    }

    if (promo.perUserLimit !== null) {
      const used = await this.prisma.promoCodeUsage.count({
        where: { promoCodeId: promo.id, userId },
      });
      if (used >= promo.perUserLimit) return empty('USER_LIMIT');
    }

    const subtotal = items.reduce(
      (acc, i) => acc.plus(new Decimal(i.lineSubtotal)),
      new Decimal(0),
    );
    if (promo.minOrderAmount && subtotal.lessThan(new Decimal(promo.minOrderAmount.toString()))) {
      return { ...empty('MIN_ORDER'), eligibleSubtotal: subtotal };
    }

    const eligibleSubtotal = this.eligibleSubtotal(promo, items);
    if (eligibleSubtotal.lessThanOrEqualTo(0)) return empty('NOT_APPLICABLE');

    const discount = this.computeDiscount(promo, eligibleSubtotal);

    return {
      valid: true,
      code,
      promoCodeId: promo.id,
      discountType: promo.discountType,
      discount,
      eligibleSubtotal,
    };
  }

  /**
   * Атомарно фиксирует использование промокода внутри транзакции заказа.
   * Условный `updateMany` с литералом usageLimit + row-lock защищают от гонки за
   * последнее использование (под READ COMMITTED предикат пере-проверяется на коммит-версии строки).
   * @throws {ConflictException} если код исчерпан в момент оформления.
   */
  async recordUsage(
    tx: Prisma.TransactionClient,
    params: {
      promoCodeId: string;
      userId: string;
      orderId: string;
      discountAmount: Decimal;
    },
  ): Promise<void> {
    const { promoCodeId, userId, orderId, discountAmount } = params;

    const promo = await tx.promoCode.findUnique({
      where: { id: promoCodeId },
      select: { usageLimit: true },
    });
    if (!promo) throw new NotFoundException('Promo code not found');

    if (promo.usageLimit !== null) {
      const claimed = await tx.promoCode.updateMany({
        where: { id: promoCodeId, usageCount: { lt: promo.usageLimit } },
        data: { usageCount: { increment: 1 } },
      });
      if (claimed.count === 0) throw new ConflictException('Promo code is exhausted');
    } else {
      await tx.promoCode.update({
        where: { id: promoCodeId },
        data: { usageCount: { increment: 1 } },
      });
    }

    await tx.promoCodeUsage.create({
      data: { promoCodeId, userId, orderId, discountAmount: discountAmount.toString() },
    });
  }

  // ===================================================================== Helpers
  private eligibleSubtotal(promo: PromoCode, items: PromoEvalItem[]): Decimal {
    const cats = promo.applicableCategories;
    const merchants = promo.applicableMerchants;
    return items.reduce((acc, i) => {
      const catOk = cats.length === 0 || (i.categoryId !== null && cats.includes(i.categoryId));
      const merchOk = merchants.length === 0 || merchants.includes(i.merchantId);
      return catOk && merchOk ? acc.plus(new Decimal(i.lineSubtotal)) : acc;
    }, new Decimal(0));
  }

  private computeDiscount(promo: PromoCode, eligibleSubtotal: Decimal): Decimal {
    let discount: Decimal;
    if (promo.discountType === PromoDiscountType.PERCENTAGE) {
      discount = eligibleSubtotal.times(new Decimal(promo.discountValue.toString())).dividedBy(100);
      if (promo.maxDiscountAmount) {
        const cap = new Decimal(promo.maxDiscountAmount.toString());
        if (discount.greaterThan(cap)) discount = cap;
      }
    } else {
      discount = new Decimal(promo.discountValue.toString());
    }
    // Скидка не может превышать применимую сумму.
    if (discount.greaterThan(eligibleSubtotal)) discount = eligibleSubtotal;
    return discount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  private assertDates(validFrom: string, validUntil: string): void {
    if (new Date(validUntil) <= new Date(validFrom)) {
      throw new BadRequestException('validUntil must be after validFrom');
    }
  }

  private assertPercentage(type: PromoDiscountType, value: number): void {
    if (type === PromoDiscountType.PERCENTAGE && (value <= 0 || value > 100)) {
      throw new BadRequestException('Percentage discountValue must be between 0 and 100');
    }
  }
}
