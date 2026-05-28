import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: { role?: UserRole; search?: string; page?: number; perPage?: number }) {
    const page = filter.page ?? 1;
    const perPage = Math.min(filter.perPage ?? 20, 100);
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (filter.role) where.roles = { some: { role: filter.role } };
    if (filter.search) {
      where.OR = [
        { email: { contains: filter.search, mode: 'insensitive' } },
        { phone: { contains: filter.search } },
        { firstName: { contains: filter.search, mode: 'insensitive' } },
        { lastName: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { roles: { select: { role: true, merchantId: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data: items.map(this.toSafe), meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { select: { role: true, merchantId: true } }, addresses: { where: { deletedAt: null } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toSafe(user);
  }

  async setActive(id: string, isActive: boolean) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive },
    });
    return this.toSafe(user);
  }

  private toSafe<T extends { passwordHash?: string | null }>(user: T): Omit<T, 'passwordHash'> {
    const { passwordHash: _ignored, ...safe } = user;
    return safe;
  }
}
