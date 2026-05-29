import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { CreateBannerDto, UpdateBannerDto } from '../dto/create-banner.dto';
import type { ListBannersDto } from '../dto/list-banners.dto';

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListBannersDto) {
    const now = new Date();
    const where: Prisma.BannerWhereInput = {
      isActive: true,
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gte: now } }],
    };
    if (query.position) where.position = query.position;

    return this.prisma.banner.findMany({
      where,
      orderBy: [{ position: 'asc' }, { sortOrder: 'asc' }],
      take: query.limit ?? 10,
      include: { category: { select: { id: true, slug: true, name: true } } },
    });
  }

  async trackClick(id: string): Promise<void> {
    await this.prisma.banner.update({ where: { id }, data: { clickCount: { increment: 1 } } });
  }

  async trackView(id: string): Promise<void> {
    await this.prisma.banner.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  }

  // ===================================================================== Admin
  /** Все баннеры (включая неактивные/просроченные) — для админки. */
  listAll(position?: string) {
    const where: Prisma.BannerWhereInput = {};
    if (position) where.position = position as Prisma.BannerWhereInput['position'];
    return this.prisma.banner.findMany({
      where,
      orderBy: [{ position: 'asc' }, { sortOrder: 'asc' }],
      include: { category: { select: { id: true, slug: true, name: true } } },
    });
  }

  async create(dto: CreateBannerDto) {
    return this.prisma.banner.create({ data: this.toData(dto, true) });
  }

  async update(id: string, dto: UpdateBannerDto) {
    await this.getOrFail(id);
    return this.prisma.banner.update({ where: { id }, data: this.toData(dto, false) });
  }

  async remove(id: string): Promise<void> {
    await this.getOrFail(id);
    await this.prisma.banner.delete({ where: { id } });
  }

  private async getOrFail(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    return banner;
  }

  /** Маппинг DTO → Prisma data. На create обязательные поля гарантированы валидацией DTO. */
  private toData(
    dto: Partial<CreateBannerDto>,
    isCreate: boolean,
  ): Prisma.BannerUncheckedCreateInput {
    const data: Record<string, unknown> = {
      title: dto.title as unknown as Prisma.InputJsonValue,
      subtitle: (dto.subtitle ?? undefined) as Prisma.InputJsonValue | undefined,
      imageUrlDesktop: dto.imageUrlDesktop,
      imageUrlMobile: dto.imageUrlMobile,
      linkUrl: dto.linkUrl,
      position: dto.position,
      categoryId: dto.categoryId,
      sortOrder: dto.sortOrder,
      isActive: dto.isActive,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : isCreate ? new Date() : undefined,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
    };
    // На create sortOrder/isActive получают дефолты схемы, если не заданы.
    return data as Prisma.BannerUncheckedCreateInput;
  }
}
