import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

import type { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { PasswordService } from '../../auth/password.service';

import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService — staff', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let password: DeepMockProxy<PasswordService>;
  let service: AdminUsersService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    password = mockDeep<PasswordService>();
    password.hash.mockResolvedValue('hashed');
    service = new AdminUsersService(
      prisma as unknown as PrismaService,
      password as unknown as PasswordService,
    );
  });

  describe('createStaff', () => {
    const dto = {
      email: 'M@Domcrat.uz',
      password: 'Secret123',
      role: UserRole.CONTENT_MANAGER,
    };

    it('создаёт сотрудника, нормализует email, верифицирует, хэширует пароль', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.user.create.mockResolvedValue({ id: 'u-1', roles: [] } as any);

      await service.createStaff(dto, 'admin-1');

      expect(password.hash).toHaveBeenCalledWith('Secret123');
      const arg = prisma.user.create.mock.calls[0][0];
      expect(arg.data.email).toBe('m@domcrat.uz');
      expect(arg.data.isEmailVerified).toBe(true);
      expect(arg.data.roles).toEqual({
        create: { role: UserRole.CONTENT_MANAGER, grantedById: 'admin-1' },
      });
    });

    it('отклоняет роль клиента (не staff)', async () => {
      await expect(
        service.createStaff({ ...dto, role: UserRole.CUSTOMER }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('отклоняет дубликат email', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' } as any);

      await expect(service.createStaff(dto, 'admin-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('setStaffRoles', () => {
    it('отклоняет роль мерчанта', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1' } as any);

      await expect(
        service.setStaffRoles('u-1', [UserRole.ADMIN, UserRole.MERCHANT], 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('бросает NotFound для несуществующего пользователя', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.setStaffRoles('nope', [UserRole.ADMIN], 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
