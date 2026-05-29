import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PasswordService } from '../../auth/password.service';
import { STAFF_ROLES } from '../dto/create-staff.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
  ) {}

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
    return {
      data: items.map(this.toSafe),
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: { select: { role: true, merchantId: true } },
        addresses: { where: { deletedAt: null } },
      },
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

  // ====================================================== System users (staff)
  /** Список системных пользователей (внутренние роли платформы, не клиенты/мерчанты). */
  async listStaff(filter: { role?: UserRole; search?: string; page?: number; perPage?: number }) {
    const page = filter.page ?? 1;
    const perPage = Math.min(filter.perPage ?? 50, 100);

    const roleFilter =
      filter.role && STAFF_ROLES.includes(filter.role) ? filter.role : { in: STAFF_ROLES };
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      roles: { some: { role: roleFilter } },
    };
    if (filter.search) {
      where.OR = [
        { email: { contains: filter.search, mode: 'insensitive' } },
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
    return {
      data: items.map(this.toSafe),
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  /** Создаёт системного пользователя с одной staff-ролью. Только для SUPER_ADMIN (см. controller). */
  async createStaff(
    dto: { email: string; password: string; role: UserRole; firstName?: string; lastName?: string },
    grantedById: string,
  ) {
    this.assertStaffRole(dto.role);
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Пользователь с таким email уже существует');

    const passwordHash = await this.password.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isEmailVerified: true,
        isActive: true,
        roles: { create: { role: dto.role, grantedById } },
      },
      include: { roles: { select: { role: true, merchantId: true } } },
    });
    return this.toSafe(user);
  }

  /**
   * Заменяет платформенные staff-роли пользователя на переданный набор.
   * Мерчант-ролей (merchantId != null) не касается. Только для SUPER_ADMIN.
   */
  async setStaffRoles(userId: string, roles: UserRole[], grantedById: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    roles.forEach((r) => this.assertStaffRole(r));

    const unique = Array.from(new Set(roles));
    await this.prisma.$transaction(async (tx) => {
      await tx.userRoleAssignment.deleteMany({
        where: { userId, merchantId: null, role: { in: STAFF_ROLES } },
      });
      for (const role of unique) {
        await tx.userRoleAssignment.create({ data: { userId, role, grantedById } });
      }
    });
    return this.get(userId);
  }

  private assertStaffRole(role: UserRole): void {
    if (!STAFF_ROLES.includes(role)) {
      throw new BadRequestException(`Роль ${role} не относится к системным пользователям`);
    }
  }

  private toSafe<T extends { passwordHash?: string | null }>(user: T): Omit<T, 'passwordHash'> {
    const { passwordHash: _ignored, ...safe } = user;
    return safe;
  }
}
