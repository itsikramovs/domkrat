import { ConflictException } from '@nestjs/common';
import { LegalType, MerchantStatus, MerchantType, UserRole } from '@prisma/client';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

import type { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { PasswordService } from '../../auth/password.service';
import type { CreateMerchantDto } from '../dto/create-merchant.dto';

import { AdminMerchantsService } from './admin-merchants.service';

describe('AdminMerchantsService.create', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let password: DeepMockProxy<PasswordService>;
  let service: AdminMerchantsService;

  const dto: CreateMerchantDto = {
    ownerEmail: 'seller@example.com',
    ownerPassword: 'StrongPass1',
    ownerFirstName: 'Иван',
    ownerLastName: 'Петров',
    merchantType: MerchantType.TYPE_2,
    legalType: LegalType.LLC,
    legalName: 'ООО «Автозапчасти»',
    brandName: 'AutoParts UZ',
  };

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    password = mockDeep<PasswordService>();
    service = new AdminMerchantsService(prisma, password);
    // $transaction выполняет колбэк против того же мока
    prisma.$transaction.mockImplementation((cb: (tx: PrismaService) => unknown) =>
      Promise.resolve(cb(prisma)),
    );
  });

  it('бросает ConflictException, если email владельца занят', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' } as never);
    await expect(service.create(dto, 'admin-1')).rejects.toThrow(ConflictException);
    expect(prisma.merchant.create).not.toHaveBeenCalled();
  });

  it('создаёт владельца, мерчанта (ACTIVE), роль MERCHANT и баланс', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.merchant.findUnique.mockResolvedValue(null); // slug свободен
    password.hash.mockResolvedValue('hashed-pass');
    prisma.user.create.mockResolvedValue({ id: 'u1', email: dto.ownerEmail } as never);
    prisma.merchant.create.mockResolvedValue({
      id: 'm1',
      slug: 'autoparts-uz',
      brandName: dto.brandName,
      status: MerchantStatus.ACTIVE,
    } as never);
    prisma.userRoleAssignment.create.mockResolvedValue({} as never);
    prisma.merchantBalance.create.mockResolvedValue({} as never);

    const result = await service.create(dto, 'admin-1');

    expect(result).toEqual({
      id: 'm1',
      slug: 'autoparts-uz',
      brandName: dto.brandName,
      status: MerchantStatus.ACTIVE,
      owner: { id: 'u1', email: dto.ownerEmail },
    });
    // владелец создан как доверенный, пароль захэширован
    expect(password.hash).toHaveBeenCalledWith('StrongPass1');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: dto.ownerEmail,
          passwordHash: 'hashed-pass',
          isEmailVerified: true,
        }),
      }),
    );
    // мерчант сразу ACTIVE + APPROVED, привязан к админу
    expect(prisma.merchant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          status: MerchantStatus.ACTIVE,
          verifiedById: 'admin-1',
        }),
      }),
    );
    // роль MERCHANT с merchantId
    expect(prisma.userRoleAssignment.create).toHaveBeenCalledWith({
      data: { userId: 'u1', role: UserRole.MERCHANT, merchantId: 'm1' },
    });
    expect(prisma.merchantBalance.create).toHaveBeenCalledWith({ data: { merchantId: 'm1' } });
  });

  it('добавляет суффикс к slug, если он занят', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    // первый slug занят, второй свободен
    prisma.merchant.findUnique
      .mockResolvedValueOnce({ id: 'taken' } as never)
      .mockResolvedValueOnce(null);
    password.hash.mockResolvedValue('h');
    prisma.user.create.mockResolvedValue({ id: 'u1', email: dto.ownerEmail } as never);
    prisma.merchant.create.mockResolvedValue({
      id: 'm1',
      slug: 'autoparts-uz-2',
      brandName: dto.brandName,
      status: MerchantStatus.ACTIVE,
    } as never);
    prisma.userRoleAssignment.create.mockResolvedValue({} as never);
    prisma.merchantBalance.create.mockResolvedValue({} as never);

    await service.create(dto, 'admin-1');

    expect(prisma.merchant.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'autoparts-uz-2' }) }),
    );
  });
});

describe('AdminMerchantsService.setCommission', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: AdminMerchantsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new AdminMerchantsService(prisma, mockDeep<PasswordService>());
  });

  it('отклоняет ставку вне диапазона 0..100', async () => {
    await expect(service.setCommission('m1', 150)).rejects.toThrow();
    await expect(service.setCommission('m1', -1)).rejects.toThrow();
    expect(prisma.merchant.update).not.toHaveBeenCalled();
  });

  it('обновляет ставку валидного мерчанта', async () => {
    prisma.merchant.findUnique.mockResolvedValue({ id: 'm1' } as never);
    prisma.merchant.update.mockResolvedValue({ id: 'm1', commissionRate: '12.5' } as never);

    await service.setCommission('m1', 12.5);

    expect(prisma.merchant.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'm1' }, data: { commissionRate: '12.5' } }),
    );
  });
});
