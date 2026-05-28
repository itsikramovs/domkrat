import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';
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
}
