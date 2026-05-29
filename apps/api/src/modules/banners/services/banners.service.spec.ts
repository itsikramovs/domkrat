import { NotFoundException } from '@nestjs/common';
import { BannerPosition } from '@prisma/client';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

import type { PrismaService } from '../../../infrastructure/database/prisma.service';

import { BannersService } from './banners.service';
import type { CreateBannerDto } from '../dto/create-banner.dto';

describe('BannersService — admin', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: BannersService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new BannersService(prisma as unknown as PrismaService);
  });

  const dto: CreateBannerDto = {
    title: { ru: 'Распродажа', uz: 'Aksiya' },
    imageUrlDesktop: 'https://cdn/banner.jpg',
    position: BannerPosition.HOME_MAIN,
    validFrom: '2026-05-29T00:00:00.000Z',
  };

  it('create мапит даты в Date и передаёт поля', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.banner.create.mockResolvedValue({ id: 'b-1' } as any);

    await service.create(dto);

    const arg = prisma.banner.create.mock.calls[0][0];
    expect(arg.data.position).toBe(BannerPosition.HOME_MAIN);
    expect(arg.data.validFrom).toBeInstanceOf(Date);
    expect(arg.data.imageUrlDesktop).toBe('https://cdn/banner.jpg');
  });

  it('update бросает NotFound для несуществующего баннера', async () => {
    prisma.banner.findUnique.mockResolvedValue(null);
    await expect(service.update('nope', { sortOrder: 1 })).rejects.toThrow(NotFoundException);
  });

  it('remove бросает NotFound для несуществующего баннера', async () => {
    prisma.banner.findUnique.mockResolvedValue(null);
    await expect(service.remove('nope')).rejects.toThrow(NotFoundException);
  });
});
