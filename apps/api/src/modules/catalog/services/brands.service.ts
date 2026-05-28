import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { CreateBrandDto, UpdateBrandDto } from '../dto/create-brand.dto';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  list(includeInactive = false) {
    return this.prisma.brand.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
  }

  popular(limit = 10) {
    return this.prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
      take: limit,
    });
  }

  async getBySlug(slug: string) {
    const brand = await this.prisma.brand.findUnique({ where: { slug } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async create(dto: CreateBrandDto) {
    try {
      return await this.prisma.brand.create({
        data: {
          ...dto,
          description: dto.description as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.handleUniqueErr(error);
    }
  }

  async update(id: string, dto: UpdateBrandDto) {
    const existing = await this.prisma.brand.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Brand not found');
    try {
      return await this.prisma.brand.update({
        where: { id },
        data: {
          ...dto,
          description: dto.description as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.handleUniqueErr(error);
    }
  }

  async remove(id: string): Promise<void> {
    const productsCount = await this.prisma.product.count({ where: { brandId: id } });
    if (productsCount > 0) {
      throw new ConflictException('Cannot delete brand with products');
    }
    await this.prisma.brand.delete({ where: { id } });
  }

  private handleUniqueErr(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Brand with this name or slug already exists');
    }
    throw error as Error;
  }
}
