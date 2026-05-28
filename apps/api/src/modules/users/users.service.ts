import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PasswordService } from '../auth/password.service';
import { TokensService } from '../auth/tokens.service';
import type { UserResponse } from '../auth/types';

import type { ChangePasswordDto } from './dto/change-password.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly tokens: TokensService,
  ) {}

  async getProfile(userId: string): Promise<UserResponse & {
    middleName: string | null;
    birthDate: Date | null;
    gender: string | null;
    avatarUrl: string | null;
    preferredLanguage: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { select: { role: true } } },
    });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      birthDate: user.birthDate,
      gender: user.gender,
      avatarUrl: user.avatarUrl,
      preferredLanguage: user.preferredLanguage,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      roles: user.roles.map((r) => r.role),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: Prisma.UserUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.middleName !== undefined) data.middleName = dto.middleName;
    if (dto.birthDate !== undefined) data.birthDate = new Date(dto.birthDate);
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.preferredLanguage !== undefined) data.preferredLanguage = dto.preferredLanguage;

    await this.prisma.user.update({ where: { id: userId }, data });
    return this.getProfile(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) throw new NotFoundException('User not found');

    const ok = await this.password.verify(user.passwordHash, dto.currentPassword);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');

    const newHash = await this.password.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Отзываем все refresh tokens — клиенту придётся залогиниться заново на всех устройствах
    await this.tokens.revokeAllForUser(userId);
  }
}
