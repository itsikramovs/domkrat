import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { CreateProductVariantDto, UpdateProductVariantDto } from '../dto/variant.dto';

/** Управление вариантами (простой список): ярлык + позиция, ровно один дефолтный. */
@Injectable()
export class ProductVariantsService {
  constructor(private readonly prisma: PrismaService) {}

  listForProduct(productId: string) {
    return this.prisma.productVariant.findMany({
      where: { productId },
      orderBy: [{ isDefault: 'desc' }, { position: 'asc' }],
    });
  }

  /** Гарантирует наличие ровно одного дефолтного варианта (для create карточки). */
  async ensureDefault(tx: Prisma.TransactionClient, productId: string): Promise<string> {
    const existing = await tx.productVariant.findFirst({
      where: { productId, isDefault: true },
      select: { id: true },
    });
    if (existing) return existing.id;
    const v = await tx.productVariant.create({
      data: { productId, name: Prisma.JsonNull, position: 0, isDefault: true },
      select: { id: true },
    });
    return v.id;
  }

  async create(productId: string, dto: CreateProductVariantDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Карточка не найдена');

    return this.prisma.$transaction(async (tx) => {
      const [count, max] = await Promise.all([
        tx.productVariant.count({ where: { productId } }),
        tx.productVariant.aggregate({ where: { productId }, _max: { position: true } }),
      ]);
      const makeDefault = dto.isDefault === true || count === 0;
      if (makeDefault) {
        await tx.productVariant.updateMany({ where: { productId }, data: { isDefault: false } });
      }
      return tx.productVariant.create({
        data: {
          productId,
          name: dto.name ? (dto.name as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          barcode: dto.barcode,
          position: dto.position ?? (max._max.position ?? -1) + 1,
          isDefault: makeDefault,
        },
      });
    });
  }

  async update(productId: string, variantId: string, dto: UpdateProductVariantDto) {
    await this.ensureBelongs(productId, variantId);
    const data: Prisma.ProductVariantUpdateInput = {};
    if (dto.name !== undefined)
      data.name = dto.name ? (dto.name as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
    if (dto.barcode !== undefined) data.barcode = dto.barcode;
    if (dto.position !== undefined) data.position = dto.position;

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.productVariant.updateMany({ where: { productId }, data: { isDefault: false } });
        data.isDefault = true;
      }
      return tx.productVariant.update({ where: { id: variantId }, data });
    });
  }

  async setDefault(productId: string, variantId: string) {
    await this.ensureBelongs(productId, variantId);
    return this.prisma.$transaction(async (tx) => {
      await tx.productVariant.updateMany({ where: { productId }, data: { isDefault: false } });
      return tx.productVariant.update({ where: { id: variantId }, data: { isDefault: true } });
    });
  }

  async remove(productId: string, variantId: string): Promise<void> {
    const variant = await this.ensureBelongs(productId, variantId);
    const [count, offers] = await Promise.all([
      this.prisma.productVariant.count({ where: { productId } }),
      this.prisma.productOffer.count({ where: { variantId, deletedAt: null } }),
    ]);
    if (count <= 1) throw new BadRequestException('Нельзя удалить единственный вариант');
    if (offers > 0)
      throw new BadRequestException('Сначала удалите предложения продавцов у этого варианта');

    await this.prisma.$transaction(async (tx) => {
      await tx.productVariant.delete({ where: { id: variantId } });
      if (variant.isDefault) {
        const next = await tx.productVariant.findFirst({
          where: { productId },
          orderBy: { position: 'asc' },
          select: { id: true },
        });
        if (next)
          await tx.productVariant.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
  }

  private async ensureBelongs(productId: string, variantId: string) {
    const v = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
      select: { id: true, isDefault: true },
    });
    if (!v) throw new NotFoundException('Вариант не найден у этой карточки');
    return v;
  }
}
